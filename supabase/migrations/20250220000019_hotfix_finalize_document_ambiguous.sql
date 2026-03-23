-- Hotfix: finalize document function ambiguous "document_id"

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
    SELECT d.id INTO v_document_id
    FROM documents d
    WHERE d.upload_session_id = v_session.id
    ORDER BY d.created_at DESC
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
  ON CONFLICT ON CONSTRAINT document_processing_jobs_document_id_job_type_key
  DO NOTHING
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
