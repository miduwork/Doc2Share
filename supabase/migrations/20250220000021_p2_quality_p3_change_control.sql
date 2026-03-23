-- P2 + P3: Data quality, revenue guidance, change control and safety
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS quality_score INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS data_quality_status TEXT NOT NULL DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approval_note TEXT,
  ADD COLUMN IF NOT EXISTS approval_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_quality_score_check') THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_quality_score_check
      CHECK (quality_score >= 0 AND quality_score <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_quality_status_check') THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_quality_status_check
      CHECK (data_quality_status IN ('good', 'review', 'needs_review'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_approval_status_check') THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_approval_status_check
      CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_documents_quality_status_created
  ON documents (data_quality_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_approval_status_created
  ON documents (approval_status, created_at DESC);

CREATE TABLE IF NOT EXISTS document_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- insert | update | delete | approval_submit | approval_approve | approval_reject
  old_data JSONB,
  new_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_audit_logs_doc_created
  ON document_audit_logs (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_audit_logs_action_created
  ON document_audit_logs (action, created_at DESC);

ALTER TABLE document_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can view document audit logs" ON document_audit_logs;
CREATE POLICY "Admin can view document audit logs"
  ON document_audit_logs FOR SELECT
  USING (public.is_admin());

CREATE TABLE IF NOT EXISTS document_edit_locks (
  document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lock_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_edit_locks_expires
  ON document_edit_locks (expires_at);

ALTER TABLE document_edit_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can view document edit locks" ON document_edit_locks;
CREATE POLICY "Admin can view document edit locks"
  ON document_edit_locks FOR SELECT
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.apply_document_quality_fields()
RETURNS TRIGGER AS $$
DECLARE
  v_score INT := 100;
  v_flags JSONB := '[]'::jsonb;
  v_duplicate_exists BOOLEAN := false;
BEGIN
  IF NEW.title IS NULL OR btrim(NEW.title) = '' THEN
    v_score := v_score - 30;
    v_flags := v_flags || '["missing_title"]'::jsonb;
  ELSIF char_length(NEW.title) < 8 THEN
    v_score := v_score - 10;
    v_flags := v_flags || '["title_too_short"]'::jsonb;
  END IF;

  IF NEW.description IS NULL OR btrim(COALESCE(NEW.description, '')) = '' THEN
    v_score := v_score - 10;
    v_flags := v_flags || '["missing_description"]'::jsonb;
  END IF;
  IF NEW.thumbnail_url IS NULL OR btrim(COALESCE(NEW.thumbnail_url, '')) = '' THEN
    v_score := v_score - 20;
    v_flags := v_flags || '["missing_thumbnail"]'::jsonb;
  END IF;
  IF NEW.preview_url IS NULL OR btrim(COALESCE(NEW.preview_url, '')) = '' THEN
    v_score := v_score - 10;
    v_flags := v_flags || '["missing_preview"]'::jsonb;
  END IF;
  IF NEW.price IS NULL OR NEW.price <= 0 THEN
    v_score := v_score - 20;
    v_flags := v_flags || '["non_positive_price"]'::jsonb;
  END IF;
  IF NEW.subject_id IS NULL OR NEW.grade_id IS NULL OR NEW.exam_id IS NULL THEN
    v_score := v_score - 10;
    v_flags := v_flags || '["incomplete_category_mapping"]'::jsonb;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM documents d
    WHERE d.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND lower(d.title) = lower(COALESCE(NEW.title, ''))
      AND COALESCE(d.status, '') <> 'deleted'
  ) INTO v_duplicate_exists;
  IF v_duplicate_exists THEN
    v_score := v_score - 20;
    v_flags := v_flags || '["possible_duplicate_title"]'::jsonb;
  END IF;

  v_score := GREATEST(0, LEAST(100, v_score));
  NEW.quality_score := v_score;
  NEW.quality_flags := v_flags;
  NEW.data_quality_status := CASE
    WHEN v_score >= 85 THEN 'good'
    WHEN v_score >= 65 THEN 'review'
    ELSE 'needs_review'
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_documents_apply_quality ON documents;
CREATE TRIGGER trg_documents_apply_quality
BEFORE INSERT OR UPDATE OF
  title, description, price, preview_url, thumbnail_url, subject_id, grade_id, exam_id, status
ON documents
FOR EACH ROW
EXECUTE FUNCTION public.apply_document_quality_fields();

CREATE OR REPLACE FUNCTION public.log_document_audit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO document_audit_logs (
    document_id,
    actor_id,
    action,
    old_data,
    new_data,
    metadata
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    TG_OP::TEXT,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    jsonb_build_object('table', TG_TABLE_NAME)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_documents_audit ON documents;
CREATE TRIGGER trg_documents_audit
AFTER INSERT OR UPDATE OR DELETE ON documents
FOR EACH ROW
EXECUTE FUNCTION public.log_document_audit();

CREATE OR REPLACE FUNCTION public.submit_document_for_approval(
  p_document_id UUID,
  p_actor_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE (submitted BOOLEAN) AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE documents
  SET
    approval_status = 'pending',
    approval_note = p_note,
    approval_requested_by = p_actor_id,
    approval_requested_at = NOW(),
    approval_reviewed_by = NULL,
    approval_reviewed_at = NULL,
    updated_at = NOW()
  WHERE id = p_document_id
    AND status <> 'deleted';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    INSERT INTO document_audit_logs (document_id, actor_id, action, metadata)
    VALUES (p_document_id, p_actor_id, 'approval_submit', jsonb_build_object('note', p_note));
  END IF;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.approve_document_publish(
  p_document_id UUID,
  p_actor_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE (approved BOOLEAN) AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE documents
  SET
    approval_status = 'approved',
    approval_note = p_note,
    approval_reviewed_by = p_actor_id,
    approval_reviewed_at = NOW(),
    status = CASE WHEN status = 'archived' THEN status ELSE 'ready' END,
    updated_at = NOW()
  WHERE id = p_document_id
    AND status <> 'deleted';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    INSERT INTO document_audit_logs (document_id, actor_id, action, metadata)
    VALUES (p_document_id, p_actor_id, 'approval_approve', jsonb_build_object('note', p_note));
  END IF;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reject_document_publish(
  p_document_id UUID,
  p_actor_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE (rejected BOOLEAN) AS $$
DECLARE
  v_rows INT;
BEGIN
  IF p_note IS NULL OR btrim(p_note) = '' THEN
    RAISE EXCEPTION 'reject note is required';
  END IF;

  UPDATE documents
  SET
    approval_status = 'rejected',
    approval_note = p_note,
    approval_reviewed_by = p_actor_id,
    approval_reviewed_at = NOW(),
    status = CASE WHEN status = 'deleted' THEN status ELSE 'draft' END,
    updated_at = NOW()
  WHERE id = p_document_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    INSERT INTO document_audit_logs (document_id, actor_id, action, metadata)
    VALUES (p_document_id, p_actor_id, 'approval_reject', jsonb_build_object('note', p_note));
  END IF;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_document_pricing_recommendation(
  p_document_id UUID
)
RETURNS TABLE (
  suggested_min NUMERIC,
  suggested_max NUMERIC,
  suggested_price NUMERIC,
  basis_count BIGINT
) AS $$
DECLARE
  v_subject_id INT;
  v_grade_id INT;
  v_exam_id INT;
BEGIN
  SELECT subject_id, grade_id, exam_id
  INTO v_subject_id, v_grade_id, v_exam_id
  FROM documents
  WHERE id = p_document_id;

  RETURN QUERY
  WITH peers AS (
    SELECT d.price
    FROM documents d
    WHERE d.status IN ('ready', 'archived')
      AND d.approval_status = 'approved'
      AND d.id <> p_document_id
      AND (v_subject_id IS NULL OR d.subject_id = v_subject_id)
      AND (v_grade_id IS NULL OR d.grade_id = v_grade_id)
      AND (v_exam_id IS NULL OR d.exam_id = v_exam_id)
      AND d.price > 0
  )
  SELECT
    COALESCE(percentile_cont(0.25) WITHIN GROUP (ORDER BY price), 10000)::NUMERIC AS suggested_min,
    COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY price), 50000)::NUMERIC AS suggested_max,
    COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY price), 30000)::NUMERIC AS suggested_price,
    COUNT(*)::BIGINT AS basis_count
  FROM peers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.acquire_document_edit_lock(
  p_document_id UUID,
  p_actor_id UUID,
  p_ttl_seconds INT DEFAULT 300
)
RETURNS TABLE (
  lock_acquired BOOLEAN,
  lock_token TEXT
) AS $$
DECLARE
  v_token TEXT := encode(gen_random_bytes(16), 'hex');
BEGIN
  DELETE FROM document_edit_locks
  WHERE document_id = p_document_id
    AND expires_at < NOW();

  INSERT INTO document_edit_locks (document_id, locked_by, lock_token, expires_at)
  VALUES (
    p_document_id,
    p_actor_id,
    v_token,
    NOW() + make_interval(secs => GREATEST(COALESCE(p_ttl_seconds, 300), 30))
  )
  ON CONFLICT (document_id)
  DO NOTHING;

  IF EXISTS (SELECT 1 FROM document_edit_locks WHERE document_id = p_document_id AND lock_token = v_token) THEN
    RETURN QUERY SELECT true, v_token;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.release_document_edit_lock(
  p_document_id UUID,
  p_actor_id UUID,
  p_lock_token TEXT
)
RETURNS TABLE (released BOOLEAN) AS $$
DECLARE
  v_rows INT;
BEGIN
  DELETE FROM document_edit_locks
  WHERE document_id = p_document_id
    AND locked_by = p_actor_id
    AND lock_token = p_lock_token;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.submit_document_for_approval(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_document_publish(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_document_publish(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_document_pricing_recommendation(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acquire_document_edit_lock(UUID, UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_document_edit_lock(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_document_version_snapshot(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_document_to_version(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_document_audit() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_document_for_approval(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_document_publish(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_document_publish(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_document_pricing_recommendation(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_document_edit_lock(UUID, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_document_edit_lock(UUID, UUID, TEXT) TO service_role;
