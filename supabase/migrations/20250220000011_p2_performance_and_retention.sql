-- P2: Performance & scale optimization
-- 1) Add composite indexes for hot query paths
-- 2) Add BRIN indexes for append-only logs
-- 3) Add maintenance function for log retention

-- Documents listing filters + sorting
CREATE INDEX IF NOT EXISTS idx_documents_grade_created
  ON documents (grade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_subject_created
  ON documents (subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_exam_created
  ON documents (exam_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_grade_price
  ON documents (grade_id, price);
CREATE INDEX IF NOT EXISTS idx_documents_subject_price
  ON documents (subject_id, price);
CREATE INDEX IF NOT EXISTS idx_documents_exam_price
  ON documents (exam_id, price);

-- Webhook/order resolution
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items (order_id);

-- Secure-link / admin logs query patterns
CREATE INDEX IF NOT EXISTS idx_access_logs_user_action_status_created
  ON access_logs (user_id, action, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_action_created
  ON access_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_brin
  ON access_logs USING brin (created_at);

-- Security log time-range scans
CREATE INDEX IF NOT EXISTS idx_security_logs_created_brin
  ON security_logs USING brin (created_at);

-- Reviews/comments detail page sorting
CREATE INDEX IF NOT EXISTS idx_document_reviews_doc_created
  ON document_reviews (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_comments_doc_created
  ON document_comments (document_id, created_at ASC);

-- Remove redundant index (code already UNIQUE in coupons table)
DROP INDEX IF EXISTS idx_coupons_code;

-- Maintenance: run manually or via scheduler (pg_cron / external job)
CREATE OR REPLACE FUNCTION public.cleanup_old_logs(
  p_access_logs_keep INTERVAL DEFAULT INTERVAL '90 days',
  p_security_logs_keep INTERVAL DEFAULT INTERVAL '180 days'
)
RETURNS TABLE (access_deleted BIGINT, security_deleted BIGINT) AS $$
DECLARE
  v_access BIGINT := 0;
  v_security BIGINT := 0;
BEGIN
  WITH del_access AS (
    DELETE FROM access_logs
    WHERE created_at < NOW() - p_access_logs_keep
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_access FROM del_access;

  WITH del_security AS (
    DELETE FROM security_logs
    WHERE created_at < NOW() - p_security_logs_keep
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_security FROM del_security;

  RETURN QUERY SELECT v_access, v_security;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.cleanup_old_logs(INTERVAL, INTERVAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_logs(INTERVAL, INTERVAL) TO service_role;
