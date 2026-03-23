-- P1: Atomic webhook completion via RPC transaction
-- Complete order + grant permissions in one database transaction.

CREATE OR REPLACE FUNCTION public.complete_order_and_grant_permissions(
  p_order_id UUID,
  p_external_ref TEXT DEFAULT NULL,
  p_raw_webhook JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  already_completed BOOLEAN,
  granted_count INT
) AS $$
DECLARE
  v_user_id UUID;
  v_status order_status;
  v_now TIMESTAMPTZ := NOW();
  v_granted INT := 0;
BEGIN
  SELECT user_id, status
  INTO v_user_id, v_status
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_status = 'completed' THEN
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  UPDATE orders
  SET
    status = 'completed',
    payment_ref = COALESCE(p_external_ref, payment_ref),
    external_id = COALESCE(external_id, p_external_ref),
    raw_webhook_log = COALESCE(raw_webhook_log, '{}'::jsonb) || jsonb_build_object(
      'completed_at', v_now,
      'webhook', p_raw_webhook
    ),
    updated_at = v_now
  WHERE id = p_order_id;

  -- Primary source: order_items table
  INSERT INTO permissions (user_id, document_id, granted_at, expires_at)
  SELECT v_user_id, oi.document_id, v_now, NULL
  FROM order_items oi
  WHERE oi.order_id = p_order_id
  ON CONFLICT (user_id, document_id)
  DO UPDATE SET
    granted_at = LEAST(permissions.granted_at, EXCLUDED.granted_at),
    expires_at = NULL;

  GET DIAGNOSTICS v_granted = ROW_COUNT;

  -- Fallback: orders.order_items JSON snapshot
  IF v_granted = 0 THEN
    INSERT INTO permissions (user_id, document_id, granted_at, expires_at)
    SELECT
      v_user_id,
      (item->>'document_id')::UUID,
      v_now,
      NULL
    FROM orders o,
         jsonb_array_elements(COALESCE(o.order_items, '[]'::jsonb)) AS item
    WHERE o.id = p_order_id
      AND item ? 'document_id'
      AND (item->>'document_id') ~* '^[0-9a-f-]{36}$'
    ON CONFLICT (user_id, document_id)
    DO UPDATE SET
      granted_at = LEAST(permissions.granted_at, EXCLUDED.granted_at),
      expires_at = NULL;

    GET DIAGNOSTICS v_granted = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT false, v_granted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.complete_order_and_grant_permissions(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_order_and_grant_permissions(UUID, TEXT, JSONB) TO service_role;
