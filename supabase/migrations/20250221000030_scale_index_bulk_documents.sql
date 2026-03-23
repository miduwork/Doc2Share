-- Scale & index: (document_id, status) for document_processing_jobs lookups
-- Bulk at DB: RPCs that process arrays in one transaction

-- Index for "get jobs by document_id (and optionally status)" — complements existing (document_id, status, updated_at DESC)
CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_document_id_status
  ON document_processing_jobs (document_id, status);

-- Bulk set document status (ready | archived). For 'ready' only updates docs that are approved and have required fields.
CREATE OR REPLACE FUNCTION public.bulk_set_document_status(
  p_document_ids UUID[],
  p_target_status TEXT
)
RETURNS TABLE (updated_count BIGINT) AS $$
DECLARE
  v_count BIGINT := 0;
BEGIN
  IF p_target_status NOT IN ('ready', 'archived') THEN
    RAISE EXCEPTION 'invalid target_status: %', p_target_status;
  END IF;

  IF p_target_status = 'ready' THEN
    UPDATE documents
    SET status = 'ready', updated_at = NOW()
    WHERE id = ANY(p_document_ids)
      AND status <> 'deleted'
      AND approval_status = 'approved'
      AND title IS NOT NULL AND btrim(title) <> ''
      AND file_path IS NOT NULL AND btrim(file_path) <> ''
      AND thumbnail_url IS NOT NULL AND btrim(thumbnail_url) <> '';
  ELSE
    UPDATE documents
    SET status = 'archived', updated_at = NOW()
    WHERE id = ANY(p_document_ids)
      AND status <> 'deleted';
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bulk soft-delete (status = deleted)
CREATE OR REPLACE FUNCTION public.bulk_delete_document_soft(
  p_document_ids UUID[]
)
RETURNS TABLE (updated_count BIGINT) AS $$
DECLARE
  v_count BIGINT := 0;
BEGIN
  UPDATE documents
  SET status = 'deleted', is_downloadable = false, updated_at = NOW()
  WHERE id = ANY(p_document_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bulk retry processing: requeue jobs and set document status to processing
CREATE OR REPLACE FUNCTION public.bulk_retry_document_processing(
  p_document_ids UUID[]
)
RETURNS TABLE (updated_count BIGINT) AS $$
DECLARE
  v_count BIGINT := 0;
BEGIN
  UPDATE document_processing_jobs
  SET status = 'queued', last_error = NULL, run_after = NOW(), updated_at = NOW()
  WHERE document_id = ANY(p_document_ids)
    AND job_type = 'document_postprocess';

  UPDATE documents
  SET status = 'processing', updated_at = NOW()
  WHERE id = ANY(p_document_ids)
    AND status IN ('failed', 'draft')
    AND upload_session_id IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bulk submit for approval (calls existing function per doc for audit)
CREATE OR REPLACE FUNCTION public.bulk_submit_document_for_approval(
  p_document_ids UUID[],
  p_actor_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE (success_count BIGINT, failed_count BIGINT) AS $$
DECLARE
  v_id UUID;
  v_ok BOOLEAN;
  v_success BIGINT := 0;
  v_failed BIGINT := 0;
BEGIN
  FOREACH v_id IN ARRAY p_document_ids
  LOOP
    BEGIN
      SELECT submitted INTO v_ok
      FROM public.submit_document_for_approval(v_id, p_actor_id, p_note)
      LIMIT 1;
      IF COALESCE(v_ok, false) THEN
        v_success := v_success + 1;
      ELSE
        v_failed := v_failed + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
    END;
  END LOOP;
  RETURN QUERY SELECT v_success, v_failed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bulk approve (calls existing function per doc for audit)
CREATE OR REPLACE FUNCTION public.bulk_approve_document_publish(
  p_document_ids UUID[],
  p_actor_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE (success_count BIGINT, failed_count BIGINT) AS $$
DECLARE
  v_id UUID;
  v_ok BOOLEAN;
  v_success BIGINT := 0;
  v_failed BIGINT := 0;
BEGIN
  FOREACH v_id IN ARRAY p_document_ids
  LOOP
    BEGIN
      SELECT approved INTO v_ok
      FROM public.approve_document_publish(v_id, p_actor_id, p_note)
      LIMIT 1;
      IF COALESCE(v_ok, false) THEN
        v_success := v_success + 1;
      ELSE
        v_failed := v_failed + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
    END;
  END LOOP;
  RETURN QUERY SELECT v_success, v_failed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bulk reject (note required; calls existing function per doc for audit)
CREATE OR REPLACE FUNCTION public.bulk_reject_document_publish(
  p_document_ids UUID[],
  p_actor_id UUID,
  p_note TEXT
)
RETURNS TABLE (success_count BIGINT, failed_count BIGINT) AS $$
DECLARE
  v_id UUID;
  v_ok BOOLEAN;
  v_success BIGINT := 0;
  v_failed BIGINT := 0;
BEGIN
  IF p_note IS NULL OR btrim(p_note) = '' THEN
    RAISE EXCEPTION 'reject note is required';
  END IF;

  FOREACH v_id IN ARRAY p_document_ids
  LOOP
    BEGIN
      SELECT rejected INTO v_ok
      FROM public.reject_document_publish(v_id, p_actor_id, p_note)
      LIMIT 1;
      IF COALESCE(v_ok, false) THEN
        v_success := v_success + 1;
      ELSE
        v_failed := v_failed + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
    END;
  END LOOP;
  RETURN QUERY SELECT v_success, v_failed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.bulk_set_document_status(UUID[], TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_delete_document_soft(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_retry_document_processing(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_submit_document_for_approval(UUID[], UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_approve_document_publish(UUID[], UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_reject_document_publish(UUID[], UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.bulk_set_document_status(UUID[], TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.bulk_delete_document_soft(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.bulk_retry_document_processing(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.bulk_submit_document_for_approval(UUID[], UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.bulk_approve_document_publish(UUID[], UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.bulk_reject_document_publish(UUID[], UUID, TEXT) TO service_role;
