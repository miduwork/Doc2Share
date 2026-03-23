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
