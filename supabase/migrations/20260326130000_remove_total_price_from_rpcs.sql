-- Phase B (cleanup): remove total_price dependency from payment reconciliation RPCs.
-- 1) match_orders_by_id_prefix: stop returning total_price.
-- 2) create_checkout_order: stop inserting total_price.

-- 1) match_orders_by_id_prefix
CREATE OR REPLACE FUNCTION public.match_orders_by_id_prefix(p_prefix TEXT)
RETURNS TABLE (
  id UUID,
  status order_status,
  total_amount NUMERIC,
  payment_status TEXT,
  external_id TEXT
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.status,
    o.total_amount,
    o.payment_status,
    o.external_id
  FROM public.orders o
  WHERE o.id::text ILIKE p_prefix || '%'
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.match_orders_by_id_prefix(TEXT) TO service_role;

-- 2) create_checkout_order
CREATE OR REPLACE FUNCTION public.create_checkout_order(p_document_id UUID)
RETURNS TABLE (
  order_id UUID,
  total_amount NUMERIC,
  document_title TEXT
)
AS $$
DECLARE
  v_user_id UUID;
  v_price NUMERIC;
  v_title TEXT;
  v_order_id UUID;
  v_external_id TEXT;
  v_user_hex TEXT;
  v_order_hex TEXT;
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
  v_user_hex := UPPER(REPLACE(v_user_id::text, '-', ''));
  v_order_hex := UPPER(REPLACE(v_order_id::text, '-', ''));
  v_external_id := 'D2S-' || SUBSTRING(v_user_hex, 1, 4) || '-' || SUBSTRING(v_order_hex, 1, 8);

  INSERT INTO orders (
    id,
    user_id,
    total_amount,
    status,
    external_id,
    order_items,
    created_at,
    updated_at
  )
  VALUES (
    v_order_id,
    v_user_id,
    v_price,
    'pending',
    v_external_id,
    jsonb_build_array(
      jsonb_build_object(
        'document_id', p_document_id,
        'quantity', 1,
        'price', v_price
      )
    ),
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

