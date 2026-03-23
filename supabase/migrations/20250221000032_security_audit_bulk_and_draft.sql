-- Security & audit: bulk operation logs; draft metadata for documents

-- ========== 1. Admin bulk operation audit log ==========
CREATE TABLE IF NOT EXISTS admin_bulk_operation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operation TEXT NOT NULL,
  target_table TEXT NOT NULL DEFAULT 'documents',
  document_ids UUID[] NOT NULL DEFAULT '{}',
  affected_count BIGINT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_bulk_operation_logs_actor_created
  ON admin_bulk_operation_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_bulk_operation_logs_operation_created
  ON admin_bulk_operation_logs (operation, created_at DESC);

ALTER TABLE admin_bulk_operation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view bulk operation logs" ON admin_bulk_operation_logs;
CREATE POLICY "Admin can view bulk operation logs"
  ON admin_bulk_operation_logs FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

-- Only service_role (and backend) can insert
CREATE POLICY "Service role can insert bulk operation logs"
  ON admin_bulk_operation_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ========== 2. Bulk RPCs: add p_actor_id and write audit row ==========
CREATE OR REPLACE FUNCTION public.bulk_set_document_status(
  p_document_ids UUID[],
  p_target_status TEXT,
  p_actor_id UUID DEFAULT NULL
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

  INSERT INTO admin_bulk_operation_logs (actor_id, operation, document_ids, affected_count, metadata)
  VALUES (
    p_actor_id,
    'bulk_set_status',
    p_document_ids,
    v_count,
    jsonb_build_object('target_status', p_target_status)
  );

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.bulk_delete_document_soft(
  p_document_ids UUID[],
  p_actor_id UUID DEFAULT NULL
)
RETURNS TABLE (updated_count BIGINT) AS $$
DECLARE
  v_count BIGINT := 0;
BEGIN
  UPDATE documents
  SET status = 'deleted', is_downloadable = false, updated_at = NOW()
  WHERE id = ANY(p_document_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO admin_bulk_operation_logs (actor_id, operation, document_ids, affected_count, metadata)
  VALUES (p_actor_id, 'bulk_delete_soft', p_document_ids, v_count, '{}'::jsonb);

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.bulk_retry_document_processing(
  p_document_ids UUID[],
  p_actor_id UUID DEFAULT NULL
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

  INSERT INTO admin_bulk_operation_logs (actor_id, operation, document_ids, affected_count, metadata)
  VALUES (p_actor_id, 'bulk_retry_processing', p_document_ids, v_count, '{}'::jsonb);

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ========== 3. Draft metadata: allow sessions without files ==========
ALTER TABLE document_upload_sessions
  ALTER COLUMN main_file_path DROP NOT NULL,
  ALTER COLUMN cover_file_path DROP NOT NULL;

ALTER TABLE document_upload_sessions
  DROP CONSTRAINT IF EXISTS document_upload_sessions_status_check;
ALTER TABLE document_upload_sessions
  ADD CONSTRAINT document_upload_sessions_status_check
  CHECK (status IN ('draft', 'uploaded', 'finalized', 'failed', 'aborted'));

CREATE OR REPLACE FUNCTION public.create_document_upload_session(
  p_created_by UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_price NUMERIC DEFAULT 0,
  p_subject_id INT DEFAULT NULL,
  p_grade_id INT DEFAULT NULL,
  p_exam_id INT DEFAULT NULL,
  p_is_downloadable BOOLEAN DEFAULT false,
  p_main_file_path TEXT DEFAULT NULL,
  p_cover_file_path TEXT DEFAULT NULL,
  p_preview_file_path TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  session_id UUID,
  already_exists BOOLEAN
) AS $$
DECLARE
  v_session_id UUID;
  v_is_draft BOOLEAN;
BEGIN
  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;

  v_is_draft := (p_main_file_path IS NULL OR btrim(p_main_file_path) = '')
    AND (p_cover_file_path IS NULL OR btrim(p_cover_file_path) = '');

  IF NOT v_is_draft THEN
    IF p_main_file_path IS NULL OR btrim(p_main_file_path) = '' THEN
      RAISE EXCEPTION 'main_file_path is required when not creating draft';
    END IF;
    IF p_cover_file_path IS NULL OR btrim(p_cover_file_path) = '' THEN
      RAISE EXCEPTION 'cover_file_path is required when not creating draft';
    END IF;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_session_id
    FROM document_upload_sessions
    WHERE created_by IS NOT DISTINCT FROM p_created_by
      AND idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_session_id IS NOT NULL THEN
      RETURN QUERY SELECT v_session_id, true;
      RETURN;
    END IF;
  END IF;

  INSERT INTO document_upload_sessions (
    created_by, idempotency_key, title, description, price,
    subject_id, grade_id, exam_id, is_downloadable,
    main_file_path, cover_file_path, preview_file_path,
    status
  )
  VALUES (
    p_created_by, p_idempotency_key, p_title, p_description, COALESCE(p_price, 0),
    p_subject_id, p_grade_id, p_exam_id, COALESCE(p_is_downloadable, false),
    NULLIF(btrim(p_main_file_path), ''), NULLIF(btrim(p_cover_file_path), ''), NULLIF(btrim(p_preview_file_path), ''),
    CASE WHEN v_is_draft THEN 'draft'::TEXT ELSE 'uploaded'::TEXT END
  )
  RETURNING id INTO v_session_id;

  RETURN QUERY SELECT v_session_id, false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_document_upload_session_metadata(
  p_session_id UUID,
  p_created_by UUID,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_price NUMERIC DEFAULT NULL,
  p_subject_id INT DEFAULT NULL,
  p_grade_id INT DEFAULT NULL,
  p_exam_id INT DEFAULT NULL,
  p_is_downloadable BOOLEAN DEFAULT NULL
)
RETURNS TABLE (updated BOOLEAN) AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE document_upload_sessions
  SET
    title = COALESCE(NULLIF(btrim(p_title), ''), title),
    description = CASE WHEN p_description IS NOT NULL THEN p_description ELSE description END,
    price = COALESCE(p_price, price),
    subject_id = COALESCE(p_subject_id, subject_id),
    grade_id = COALESCE(p_grade_id, grade_id),
    exam_id = COALESCE(p_exam_id, exam_id),
    is_downloadable = COALESCE(p_is_downloadable, is_downloadable)
  WHERE id = p_session_id
    AND created_by IS NOT DISTINCT FROM p_created_by
    AND status = 'draft';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_document_upload_session_files(
  p_session_id UUID,
  p_created_by UUID,
  p_main_file_path TEXT,
  p_cover_file_path TEXT,
  p_preview_file_path TEXT DEFAULT NULL
)
RETURNS TABLE (updated BOOLEAN) AS $$
DECLARE
  v_rows INT;
BEGIN
  IF p_main_file_path IS NULL OR btrim(p_main_file_path) = '' THEN
    RAISE EXCEPTION 'main_file_path is required';
  END IF;
  IF p_cover_file_path IS NULL OR btrim(p_cover_file_path) = '' THEN
    RAISE EXCEPTION 'cover_file_path is required';
  END IF;

  UPDATE document_upload_sessions
  SET
    main_file_path = p_main_file_path,
    cover_file_path = p_cover_file_path,
    preview_file_path = NULLIF(btrim(COALESCE(p_preview_file_path, '')), ''),
    status = 'uploaded'
  WHERE id = p_session_id
    AND created_by IS NOT DISTINCT FROM p_created_by
    AND status = 'draft';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.bulk_set_document_status(UUID[], TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_delete_document_soft(UUID[], UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_retry_document_processing(UUID[], UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_set_document_status(UUID[], TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.bulk_delete_document_soft(UUID[], UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.bulk_retry_document_processing(UUID[], UUID) TO service_role;

REVOKE ALL ON FUNCTION public.update_document_upload_session_metadata(UUID, UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_document_upload_session_files(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_document_upload_session_metadata(UUID, UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_document_upload_session_files(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
