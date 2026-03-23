-- P4.1: Document versions + admin rollback

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_no INT NOT NULL,
  snapshot JSONB NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_doc_created
  ON document_versions (document_id, created_at DESC);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view document versions" ON document_versions;
CREATE POLICY "Admin can view document versions"
  ON document_versions FOR SELECT
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.create_document_version_snapshot(
  p_document_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (
  version_id UUID,
  version_no INT
) AS $$
DECLARE
  v_doc documents%ROWTYPE;
  v_next_version INT;
  v_version_id UUID;
BEGIN
  SELECT * INTO v_doc
  FROM documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'document not found';
  END IF;

  SELECT COALESCE(MAX(dv.version_no), 0) + 1
  INTO v_next_version
  FROM document_versions dv
  WHERE dv.document_id = p_document_id;

  INSERT INTO document_versions (
    document_id, version_no, snapshot, reason, created_by
  )
  VALUES (
    p_document_id,
    v_next_version,
    jsonb_build_object(
      'title', v_doc.title,
      'description', v_doc.description,
      'price', v_doc.price,
      'file_path', v_doc.file_path,
      'preview_url', v_doc.preview_url,
      'preview_text', v_doc.preview_text,
      'thumbnail_url', v_doc.thumbnail_url,
      'subject_id', v_doc.subject_id,
      'grade_id', v_doc.grade_id,
      'exam_id', v_doc.exam_id,
      'is_downloadable', v_doc.is_downloadable,
      'status', v_doc.status
    ),
    p_reason,
    p_created_by
  )
  RETURNING id INTO v_version_id;

  RETURN QUERY SELECT v_version_id, v_next_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.rollback_document_to_version(
  p_document_id UUID,
  p_version_id UUID,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (
  rolled_back BOOLEAN,
  restored_from_version INT,
  new_version_id UUID
) AS $$
DECLARE
  v_snapshot JSONB;
  v_version_no INT;
  v_rows INT;
  v_new_version_id UUID;
BEGIN
  SELECT dv.snapshot, dv.version_no
  INTO v_snapshot, v_version_no
  FROM document_versions dv
  WHERE dv.id = p_version_id
    AND dv.document_id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::INT, NULL::UUID;
    RETURN;
  END IF;

  SELECT version_id INTO v_new_version_id
  FROM public.create_document_version_snapshot(
    p_document_id,
    format('rollback_backup_from_v%s', v_version_no),
    p_created_by
  );

  UPDATE documents
  SET
    title = v_snapshot->>'title',
    description = NULLIF(v_snapshot->>'description', ''),
    price = COALESCE((v_snapshot->>'price')::NUMERIC, price),
    file_path = v_snapshot->>'file_path',
    preview_url = NULLIF(v_snapshot->>'preview_url', ''),
    preview_text = NULLIF(v_snapshot->>'preview_text', ''),
    thumbnail_url = NULLIF(v_snapshot->>'thumbnail_url', ''),
    subject_id = CASE WHEN (v_snapshot ? 'subject_id') AND v_snapshot->>'subject_id' <> '' THEN (v_snapshot->>'subject_id')::INT ELSE NULL END,
    grade_id = CASE WHEN (v_snapshot ? 'grade_id') AND v_snapshot->>'grade_id' <> '' THEN (v_snapshot->>'grade_id')::INT ELSE NULL END,
    exam_id = CASE WHEN (v_snapshot ? 'exam_id') AND v_snapshot->>'exam_id' <> '' THEN (v_snapshot->>'exam_id')::INT ELSE NULL END,
    is_downloadable = COALESCE((v_snapshot->>'is_downloadable')::BOOLEAN, false),
    status = COALESCE(NULLIF(v_snapshot->>'status', ''), 'ready'),
    updated_at = NOW()
  WHERE id = p_document_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0), v_version_no, v_new_version_id;
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

  PERFORM public.create_document_version_snapshot(p_document_id, 'admin_update', NULL);

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
  PERFORM public.create_document_version_snapshot(
    p_document_id,
    CASE WHEN COALESCE(p_hard_delete, false) THEN 'admin_hard_delete' ELSE 'admin_soft_delete' END,
    NULL
  );

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

REVOKE ALL ON FUNCTION public.create_document_version_snapshot(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_document_to_version(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_document_admin(UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_document_admin(UUID, BOOLEAN) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_document_version_snapshot(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rollback_document_to_version(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_document_admin(UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_document_admin(UUID, BOOLEAN) TO service_role;
