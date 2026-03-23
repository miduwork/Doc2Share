-- P3: Webhook idempotency + replay resilience

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,              -- e.g. 'vietqr'
  event_id TEXT NOT NULL,              -- provider event id or deterministic fallback id
  request_id TEXT,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received', -- received | processing | processed | ignored | error
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  error_message TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_provider_event
  ON webhook_events (provider, event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status_seen
  ON webhook_events (status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_seen
  ON webhook_events (provider, last_seen_at DESC);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view webhook events" ON webhook_events;
CREATE POLICY "Admin can view webhook events"
  ON webhook_events FOR SELECT
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.register_webhook_event(
  p_provider TEXT,
  p_event_id TEXT,
  p_payload_hash TEXT,
  p_request_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  should_process BOOLEAN,
  current_status TEXT
) AS $$
DECLARE
  v_status TEXT;
  v_hash TEXT;
  v_rows INT;
BEGIN
  IF p_provider IS NULL OR p_provider = '' OR p_event_id IS NULL OR p_event_id = '' THEN
    RAISE EXCEPTION 'provider and event_id are required';
  END IF;

  INSERT INTO webhook_events (provider, event_id, request_id, payload_hash, status)
  VALUES (p_provider, p_event_id, p_request_id, p_payload_hash, 'received')
  ON CONFLICT (provider, event_id)
  DO UPDATE SET
    last_seen_at = NOW(),
    request_id = COALESCE(EXCLUDED.request_id, webhook_events.request_id);

  SELECT status, payload_hash
  INTO v_status, v_hash
  FROM webhook_events
  WHERE provider = p_provider AND event_id = p_event_id
  FOR UPDATE;

  IF v_hash IS DISTINCT FROM p_payload_hash THEN
    UPDATE webhook_events
    SET
      status = 'error',
      error_message = 'payload_hash_mismatch',
      last_seen_at = NOW()
    WHERE provider = p_provider AND event_id = p_event_id;

    RETURN QUERY SELECT false, 'hash_mismatch'::TEXT;
    RETURN;
  END IF;

  IF v_status IN ('processed', 'ignored') THEN
    RETURN QUERY SELECT false, v_status;
    RETURN;
  END IF;

  UPDATE webhook_events
  SET
    status = 'processing',
    error_message = NULL,
    last_seen_at = NOW()
  WHERE provider = p_provider
    AND event_id = p_event_id
    AND status IN ('received', 'error');

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 1 THEN
    RETURN QUERY SELECT true, 'processing'::TEXT;
  ELSE
    RETURN QUERY SELECT false, 'processing'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.complete_webhook_event(
  p_provider TEXT,
  p_event_id TEXT,
  p_status TEXT,
  p_order_id UUID DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE webhook_events
  SET
    status = p_status,
    order_id = COALESCE(p_order_id, order_id),
    error_message = p_error_message,
    processed_at = CASE WHEN p_status IN ('processed', 'ignored') THEN NOW() ELSE processed_at END,
    last_seen_at = NOW()
  WHERE provider = p_provider
    AND event_id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.register_webhook_event(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_webhook_event(TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_webhook_event(TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_webhook_event(TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;
