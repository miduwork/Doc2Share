-- P4: Documents upload 2-phase commit + trusted-only CRUD + async post-process queue

CREATE TABLE IF NOT EXISTS document_upload_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  idempotency_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subject_id INT REFERENCES categories(id) ON DELETE SET NULL,
  grade_id INT REFERENCES categories(id) ON DELETE SET NULL,
  exam_id INT REFERENCES categories(id) ON DELETE SET NULL,
  is_downloadable BOOLEAN NOT NULL DEFAULT false,
  main_file_path TEXT NOT NULL,
  cover_file_path TEXT NOT NULL,
  preview_file_path TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded | finalized | failed | aborted
  error_message TEXT,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_upload_sessions_status_check'
  ) THEN
    ALTER TABLE document_upload_sessions
      ADD CONSTRAINT document_upload_sessions_status_check
      CHECK (status IN ('uploaded', 'finalized', 'failed', 'aborted'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_document_upload_sessions_creator_idempotency
  ON document_upload_sessions (created_by, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_upload_sessions_status_created
  ON document_upload_sessions (status, created_at DESC);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS upload_session_id UUID REFERENCES document_upload_sessions(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_status_check'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_status_check
      CHECK (status IN ('draft', 'processing', 'ready', 'failed', 'archived', 'deleted'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS document_processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  upload_session_id UUID REFERENCES document_upload_sessions(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL DEFAULT 'document_postprocess',
  status TEXT NOT NULL DEFAULT 'queued', -- queued | processing | done | failed
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, job_type)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_processing_jobs_status_check'
  ) THEN
    ALTER TABLE document_processing_jobs
      ADD CONSTRAINT document_processing_jobs_status_check
      CHECK (status IN ('queued', 'processing', 'done', 'failed'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_status_run_after
  ON document_processing_jobs (status, run_after, created_at);

ALTER TABLE document_upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_processing_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view document upload sessions" ON document_upload_sessions;
CREATE POLICY "Admin can view document upload sessions"
  ON document_upload_sessions FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can view document processing jobs" ON document_processing_jobs;
CREATE POLICY "Admin can view document processing jobs"
  ON document_processing_jobs FOR SELECT
  USING (public.is_admin());

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
BEGIN
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;
  IF p_main_file_path IS NULL OR trim(p_main_file_path) = '' THEN
    RAISE EXCEPTION 'main_file_path is required';
  END IF;
  IF p_cover_file_path IS NULL OR trim(p_cover_file_path) = '' THEN
    RAISE EXCEPTION 'cover_file_path is required';
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
    main_file_path, cover_file_path, preview_file_path, status
  )
  VALUES (
    p_created_by, p_idempotency_key, p_title, p_description, COALESCE(p_price, 0),
    p_subject_id, p_grade_id, p_exam_id, COALESCE(p_is_downloadable, false),
    p_main_file_path, p_cover_file_path, p_preview_file_path, 'uploaded'
  )
  RETURNING id INTO v_session_id;

  RETURN QUERY SELECT v_session_id, false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.create_document_from_upload_session(
  p_session_id UUID
)
RETURNS TABLE (
  document_id UUID,
  job_id UUID,
  already_finalized BOOLEAN
) AS $$
DECLARE
  v_session document_upload_sessions%ROWTYPE;
  v_document_id UUID;
  v_job_id UUID;
BEGIN
  SELECT * INTO v_session
  FROM document_upload_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'upload session not found';
  END IF;

  IF v_session.status = 'finalized' THEN
    SELECT id INTO v_document_id
    FROM documents
    WHERE upload_session_id = v_session.id
    ORDER BY created_at DESC
    LIMIT 1;

    SELECT j.id INTO v_job_id
    FROM document_processing_jobs j
    WHERE j.document_id = v_document_id
      AND j.job_type = 'document_postprocess'
    LIMIT 1;

    RETURN QUERY SELECT v_document_id, v_job_id, true;
    RETURN;
  END IF;

  INSERT INTO documents (
    title, description, price, file_path, preview_url, preview_text,
    subject_id, grade_id, exam_id, is_downloadable, thumbnail_url, status, upload_session_id
  )
  VALUES (
    v_session.title,
    v_session.description,
    v_session.price,
    v_session.main_file_path,
    v_session.preview_file_path,
    NULL,
    v_session.subject_id,
    v_session.grade_id,
    v_session.exam_id,
    v_session.is_downloadable,
    v_session.cover_file_path,
    'processing',
    v_session.id
  )
  RETURNING id INTO v_document_id;

  INSERT INTO document_processing_jobs (
    document_id, upload_session_id, job_type, status, run_after
  )
  VALUES (
    v_document_id, v_session.id, 'document_postprocess', 'queued', NOW()
  )
  ON CONFLICT ON CONSTRAINT document_processing_jobs_document_id_job_type_key DO NOTHING
  RETURNING id INTO v_job_id;

  IF v_job_id IS NULL THEN
    SELECT j.id INTO v_job_id
    FROM document_processing_jobs j
    WHERE j.document_id = v_document_id
      AND j.job_type = 'document_postprocess'
    LIMIT 1;
  END IF;

  UPDATE document_upload_sessions
  SET status = 'finalized', finalized_at = NOW(), error_message = NULL
  WHERE id = v_session.id;

  RETURN QUERY SELECT v_document_id, v_job_id, false;
EXCEPTION WHEN OTHERS THEN
  UPDATE document_upload_sessions
  SET status = 'failed', error_message = SQLERRM
  WHERE id = p_session_id;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_document_admin(
  p_document_id UUID,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_price NUMERIC DEFAULT NULL,
  p_subject_id INT DEFAULT NULL,
  p_grade_id INT DEFAULT NULL,
  p_exam_id INT DEFAULT NULL,
  p_is_downloadable BOOLEAN DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  updated BOOLEAN
) AS $$
DECLARE
  v_rows INT;
BEGIN
  IF p_status IS NOT NULL AND p_status NOT IN ('draft', 'processing', 'ready', 'failed', 'archived', 'deleted') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE documents
  SET
    title = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    price = COALESCE(p_price, price),
    subject_id = COALESCE(p_subject_id, subject_id),
    grade_id = COALESCE(p_grade_id, grade_id),
    exam_id = COALESCE(p_exam_id, exam_id),
    is_downloadable = COALESCE(p_is_downloadable, is_downloadable),
    status = COALESCE(p_status, status),
    updated_at = NOW()
  WHERE id = p_document_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.delete_document_admin(
  p_document_id UUID,
  p_hard_delete BOOLEAN DEFAULT false
)
RETURNS TABLE (
  deleted BOOLEAN
) AS $$
DECLARE
  v_rows INT;
BEGIN
  IF COALESCE(p_hard_delete, false) THEN
    DELETE FROM documents WHERE id = p_document_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN QUERY SELECT (v_rows > 0);
    RETURN;
  END IF;

  UPDATE documents
  SET status = 'deleted', is_downloadable = false, updated_at = NOW()
  WHERE id = p_document_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.claim_document_processing_jobs(
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  job_id UUID,
  document_id UUID,
  upload_session_id UUID,
  attempts INT,
  job_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM document_processing_jobs j
    WHERE j.status IN ('queued', 'failed')
      AND j.run_after <= NOW()
    ORDER BY j.run_after ASC, j.created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 100))
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE document_processing_jobs j
    SET
      status = 'processing',
      attempts = j.attempts + 1,
      updated_at = NOW()
    FROM candidates c
    WHERE j.id = c.id
    RETURNING j.id, j.document_id, j.upload_session_id, j.attempts, j.job_type
  )
  SELECT claimed.id, claimed.document_id, claimed.upload_session_id, claimed.attempts, claimed.job_type
  FROM claimed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.complete_document_processing_job(
  p_job_id UUID,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL,
  p_mark_document_ready BOOLEAN DEFAULT true,
  p_retry_delay_seconds INT DEFAULT 120
)
RETURNS VOID AS $$
DECLARE
  v_document_id UUID;
BEGIN
  SELECT document_id INTO v_document_id
  FROM document_processing_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF COALESCE(p_success, false) THEN
    UPDATE document_processing_jobs
    SET status = 'done', last_error = NULL, updated_at = NOW()
    WHERE id = p_job_id;

    IF COALESCE(p_mark_document_ready, true) THEN
      UPDATE documents
      SET status = 'ready', updated_at = NOW()
      WHERE id = v_document_id
        AND status <> 'deleted';
    END IF;
    RETURN;
  END IF;

  UPDATE document_processing_jobs
  SET
    status = 'failed',
    last_error = p_error,
    run_after = NOW() + make_interval(secs => GREATEST(COALESCE(p_retry_delay_seconds, 120), 30)),
    updated_at = NOW()
  WHERE id = p_job_id;

  UPDATE documents
  SET status = 'failed', updated_at = NOW()
  WHERE id = v_document_id
    AND status <> 'deleted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_document_upload_session(UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_document_from_upload_session(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_document_admin(UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_document_admin(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_document_processing_jobs(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_document_processing_job(UUID, BOOLEAN, TEXT, BOOLEAN, INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_document_upload_session(UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_document_from_upload_session(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_document_admin(UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_document_admin(UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_document_processing_jobs(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_document_processing_job(UUID, BOOLEAN, TEXT, BOOLEAN, INT) TO service_role;
