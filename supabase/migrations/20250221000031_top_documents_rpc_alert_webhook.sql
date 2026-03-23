-- Tối ưu truy vấn / báo cáo: RPC trả về top tài liệu bán chạy (một truy vấn thay vì nhiều)
-- Webhook cảnh báo: không thêm ở DB; app sẽ gọi webhook sau khi maintenance trả về alerts

-- Top documents by sales (completed orders) in the last N days. Requires admin.
CREATE OR REPLACE FUNCTION public.get_top_documents_by_sales(
  p_days INT DEFAULT 30,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  document_id UUID,
  title TEXT,
  quantity_sold BIGINT,
  revenue NUMERIC
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  p_days := GREATEST(1, LEAST(COALESCE(p_days, 30), 365));
  p_limit := GREATEST(1, LEAST(COALESCE(p_limit, 10), 100));

  RETURN QUERY
  SELECT
    oi.document_id,
    d.title,
    SUM(oi.quantity)::BIGINT AS quantity_sold,
    SUM(oi.price * oi.quantity) AS revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
  JOIN documents d ON d.id = oi.document_id
  WHERE o.created_at >= (NOW() - (p_days || ' days')::INTERVAL)
  GROUP BY oi.document_id, d.title
  ORDER BY SUM(oi.quantity) DESC, SUM(oi.price * oi.quantity) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.get_top_documents_by_sales(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_documents_by_sales(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_documents_by_sales(INT, INT) TO service_role;
