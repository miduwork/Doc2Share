-- Update update_document_admin RPC to include p_is_high_value
CREATE OR REPLACE FUNCTION public.update_document_admin(
  p_document_id UUID,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_price NUMERIC DEFAULT NULL,
  p_subject_id INT DEFAULT NULL,
  p_grade_id INT DEFAULT NULL,
  p_exam_id INT DEFAULT NULL,
  p_is_downloadable BOOLEAN DEFAULT NULL,
  p_is_high_value BOOLEAN DEFAULT NULL,
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
    is_high_value = COALESCE(p_is_high_value, is_high_value),
    status = COALESCE(p_status, status),
    updated_at = NOW()
  WHERE id = p_document_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke and Grant again to be safe
REVOKE ALL ON FUNCTION public.update_document_admin(UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_document_admin(UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN, BOOLEAN, TEXT) TO service_role;
