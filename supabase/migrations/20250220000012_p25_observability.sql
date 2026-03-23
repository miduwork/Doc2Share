-- P2.5: Observability (structured logs + metrics + alert checks)

CREATE TABLE IF NOT EXISTS observability_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id TEXT,
  source TEXT NOT NULL,          -- e.g. 'edge.get_secure_link', 'edge.payment_webhook'
  event_type TEXT NOT NULL,      -- e.g. 'success', 'blocked', 'error'
  severity TEXT NOT NULL DEFAULT 'info', -- info|warn|error
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  session_id TEXT,
  device_id TEXT,
  status_code INT,
  latency_ms INT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_observability_events_created
  ON observability_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observability_events_source_created
  ON observability_events (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observability_events_event_created
  ON observability_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observability_events_severity_created
  ON observability_events (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observability_events_request
  ON observability_events (request_id);
CREATE INDEX IF NOT EXISTS idx_observability_events_created_brin
  ON observability_events USING brin (created_at);

ALTER TABLE observability_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view observability events" ON observability_events;
CREATE POLICY "Admin can view observability events"
  ON observability_events FOR SELECT
  USING (public.is_admin());

CREATE OR REPLACE VIEW observability_metrics_24h AS
WITH ev AS (
  SELECT *
  FROM observability_events
  WHERE created_at >= NOW() - INTERVAL '24 hours'
),
acc AS (
  SELECT *
  FROM access_logs
  WHERE created_at >= NOW() - INTERVAL '24 hours'
)
SELECT
  (SELECT COUNT(*) FROM ev) AS events_24h,
  (SELECT COUNT(*) FROM ev WHERE severity = 'error') AS errors_24h,
  (SELECT COUNT(*) FROM ev WHERE source = 'edge.payment_webhook') AS webhook_events_24h,
  (SELECT COUNT(*) FROM ev WHERE source = 'edge.payment_webhook' AND severity = 'error') AS webhook_errors_24h,
  (SELECT COUNT(*) FROM ev WHERE source = 'edge.get_secure_link') AS secure_link_events_24h,
  (SELECT COUNT(*) FROM ev WHERE source = 'edge.get_secure_link' AND event_type = 'blocked') AS secure_link_blocked_24h,
  (SELECT COALESCE(AVG(latency_ms), 0) FROM ev WHERE source = 'edge.payment_webhook' AND latency_ms IS NOT NULL) AS webhook_avg_latency_ms_24h,
  (SELECT COALESCE(AVG(latency_ms), 0) FROM ev WHERE source = 'edge.get_secure_link' AND latency_ms IS NOT NULL) AS secure_link_avg_latency_ms_24h,
  (SELECT COUNT(*) FROM acc WHERE action = 'payment_webhook') AS payment_webhook_access_logs_24h;

CREATE OR REPLACE FUNCTION public.check_observability_alerts(
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  alert_key TEXT,
  alert_level TEXT,
  metric_value BIGINT,
  threshold BIGINT,
  window_text TEXT,
  message TEXT
) AS $$
DECLARE
  v_webhook_errors_15m BIGINT;
  v_secure_blocked_10m BIGINT;
  v_security_high_10m BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_webhook_errors_15m
  FROM observability_events
  WHERE source = 'edge.payment_webhook'
    AND severity = 'error'
    AND created_at >= p_now - INTERVAL '15 minutes';

  SELECT COUNT(*) INTO v_secure_blocked_10m
  FROM observability_events
  WHERE source = 'edge.get_secure_link'
    AND event_type = 'blocked'
    AND created_at >= p_now - INTERVAL '10 minutes';

  SELECT COUNT(*) INTO v_security_high_10m
  FROM security_logs
  WHERE severity = 'high'
    AND created_at >= p_now - INTERVAL '10 minutes';

  IF v_webhook_errors_15m >= 5 THEN
    RETURN QUERY SELECT
      'webhook_errors_spike'::TEXT,
      'high'::TEXT,
      v_webhook_errors_15m,
      5::BIGINT,
      '15m'::TEXT,
      'Webhook errors increased in last 15 minutes'::TEXT;
  END IF;

  IF v_secure_blocked_10m >= 25 THEN
    RETURN QUERY SELECT
      'secure_link_blocked_spike'::TEXT,
      'medium'::TEXT,
      v_secure_blocked_10m,
      25::BIGINT,
      '10m'::TEXT,
      'Secure-link blocked requests increased in last 10 minutes'::TEXT;
  END IF;

  IF v_security_high_10m >= 8 THEN
    RETURN QUERY SELECT
      'security_high_events_spike'::TEXT,
      'high'::TEXT,
      v_security_high_10m,
      8::BIGINT,
      '10m'::TEXT,
      'High severity security events increased in last 10 minutes'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.check_observability_alerts(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_observability_alerts(TIMESTAMPTZ) TO service_role;
