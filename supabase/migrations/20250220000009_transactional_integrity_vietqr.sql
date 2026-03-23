-- Transactional integrity (P1):
-- - Create checkout order atomically (orders + order_items) via trusted RPC.
-- - Block direct INSERT from authenticated users to orders.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.create_checkout_order(p_document_id UUID)
RETURNS TABLE (
  order_id UUID,
  total_amount NUMERIC,
  document_title TEXT
) AS $$
DECLARE
  v_user_id UUID;
  v_price NUMERIC;
  v_title TEXT;
  v_order_id UUID;
  v_external_id TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT price, title
  INTO v_price, v_title
  FROM documents
  WHERE id = p_document_id;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;
  IF v_price <= 0 THEN
    RAISE EXCEPTION 'Invalid document price';
  END IF;
  IF v_price <> trunc(v_price) THEN
    RAISE EXCEPTION 'Price must be integer VND for bank transfer';
  END IF;

  v_order_id := gen_random_uuid();
  v_external_id := 'VQR-' || UPPER(REPLACE(gen_random_uuid()::text, '-', ''));

  INSERT INTO orders (
    id, user_id, total_amount, status, external_id, order_items, created_at, updated_at
  )
  VALUES (
    v_order_id,
    v_user_id,
    v_price,
    'pending',
    v_external_id,
    jsonb_build_array(jsonb_build_object('document_id', p_document_id, 'quantity', 1, 'price', v_price)),
    NOW(),
    NOW()
  );

  INSERT INTO order_items (order_id, document_id, quantity, price)
  VALUES (v_order_id, p_document_id, 1, v_price);

  RETURN QUERY
  SELECT v_order_id, v_price, v_title;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_checkout_order(UUID) TO authenticated;

-- Do not allow direct client insert to orders; use RPC above instead.
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
CREATE POLICY "Users cannot directly insert orders"
  ON orders FOR INSERT TO authenticated
  WITH CHECK (false);
