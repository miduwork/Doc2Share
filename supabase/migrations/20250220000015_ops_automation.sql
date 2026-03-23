-- P4 (next): Backend operations automation
-- - Unified maintenance runner
-- - Maintenance run history
-- - Optional pg_cron scheduler bootstrap

CREATE TABLE IF NOT EXISTS backend_maintenance_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  triggered_by TEXT NOT NULL DEFAULT 'manual', -- manual | cron
  success BOOLEAN NOT NULL DEFAULT false,
  alerts_count INT NOT NULL DEFAULT 0,
  access_deleted BIGINT NOT NULL DEFAULT 0,
  security_deleted BIGINT NOT NULL DEFAULT 0,
  observability_deleted BIGINT NOT NULL DEFAULT 0,
  webhook_deleted BIGINT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_backend_maintenance_runs_started
  ON backend_maintenance_runs (started_at DESC);

ALTER TABLE backend_maintenance_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view backend maintenance runs" ON backend_maintenance_runs;
CREATE POLICY "Admin can view backend maintenance runs"
  ON backend_maintenance_runs FOR SELECT
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.run_backend_maintenance(
  p_triggered_by TEXT DEFAULT 'manual',
  p_access_logs_keep INTERVAL DEFAULT INTERVAL '90 days',
  p_security_logs_keep INTERVAL DEFAULT INTERVAL '180 days',
  p_observability_keep INTERVAL DEFAULT INTERVAL '30 days',
  p_webhook_keep INTERVAL DEFAULT INTERVAL '90 days'
)
RETURNS TABLE (
  run_id UUID,
  alerts_count INT,
  access_deleted BIGINT,
  security_deleted BIGINT,
  observability_deleted BIGINT,
  webhook_deleted BIGINT
) AS $$
DECLARE
  v_run_id UUID;
  v_access BIGINT := 0;
  v_security BIGINT := 0;
  v_observability BIGINT := 0;
  v_webhook BIGINT := 0;
  v_alerts INT := 0;
  v_alert_rows JSONB := '[]'::jsonb;
BEGIN
  INSERT INTO backend_maintenance_runs (triggered_by)
  VALUES (COALESCE(NULLIF(p_triggered_by, ''), 'manual'))
  RETURNING id INTO v_run_id;

  SELECT c.access_deleted, c.security_deleted
  INTO v_access, v_security
  FROM public.cleanup_old_logs(p_access_logs_keep, p_security_logs_keep) c;

  SELECT c.observability_deleted, c.webhook_deleted
  INTO v_observability, v_webhook
  FROM public.cleanup_observability_history(p_observability_keep, p_webhook_keep) c;

  SELECT COUNT(*), COALESCE(jsonb_agg(row_to_json(a)), '[]'::jsonb)
  INTO v_alerts, v_alert_rows
  FROM public.check_observability_alerts() a;

  UPDATE backend_maintenance_runs
  SET
    finished_at = NOW(),
    success = true,
    alerts_count = v_alerts,
    access_deleted = v_access,
    security_deleted = v_security,
    observability_deleted = v_observability,
    webhook_deleted = v_webhook,
    details = jsonb_build_object(
      'alerts', v_alert_rows,
      'retention', jsonb_build_object(
        'access_logs_keep', p_access_logs_keep::TEXT,
        'security_logs_keep', p_security_logs_keep::TEXT,
        'observability_keep', p_observability_keep::TEXT,
        'webhook_keep', p_webhook_keep::TEXT
      )
    )
  WHERE id = v_run_id;

  INSERT INTO observability_events (
    source, event_type, severity, status_code, metadata
  ) VALUES (
    'db.maintenance',
    'maintenance_completed',
    CASE WHEN v_alerts > 0 THEN 'warn' ELSE 'info' END,
    200,
    jsonb_build_object(
      'run_id', v_run_id,
      'alerts_count', v_alerts,
      'access_deleted', v_access,
      'security_deleted', v_security,
      'observability_deleted', v_observability,
      'webhook_deleted', v_webhook
    )
  );

  RETURN QUERY SELECT v_run_id, v_alerts, v_access, v_security, v_observability, v_webhook;
EXCEPTION WHEN OTHERS THEN
  UPDATE backend_maintenance_runs
  SET
    finished_at = NOW(),
    success = false,
    details = jsonb_build_object('error', SQLERRM)
  WHERE id = v_run_id;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.ensure_backend_cron_jobs()
RETURNS TABLE (
  job_name TEXT,
  status TEXT,
  detail TEXT
) AS $$
DECLARE
  v_has_pg_cron BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_namespace
    WHERE nspname = 'cron'
  ) INTO v_has_pg_cron;

  IF NOT v_has_pg_cron THEN
    RETURN QUERY SELECT
      'doc2share:maintenance_hourly'::TEXT,
      'skipped'::TEXT,
      'cron schema not available; use external scheduler'::TEXT;
    RETURN QUERY SELECT
      'doc2share:alerts_10m'::TEXT,
      'skipped'::TEXT,
      'cron schema not available; use external scheduler'::TEXT;
    RETURN;
  END IF;

  -- Keep job names stable and idempotent.
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN ('doc2share:maintenance_hourly', 'doc2share:alerts_10m');

  PERFORM cron.schedule(
    'doc2share:maintenance_hourly',
    '5 * * * *',
    $job$SELECT public.run_backend_maintenance('cron');$job$
  );

  PERFORM cron.schedule(
    'doc2share:alerts_10m',
    '*/10 * * * *',
    $job$INSERT INTO observability_events (source, event_type, severity, status_code, metadata)
      SELECT
        'db.alerts',
        'alert_check',
        CASE WHEN COUNT(*) > 0 THEN 'warn' ELSE 'info' END,
        200,
        jsonb_build_object('alerts', COALESCE(jsonb_agg(row_to_json(a)), '[]'::jsonb))
      FROM public.check_observability_alerts() a;$job$
  );

  RETURN QUERY SELECT 'doc2share:maintenance_hourly'::TEXT, 'scheduled'::TEXT, 'runs hourly at minute 5'::TEXT;
  RETURN QUERY SELECT 'doc2share:alerts_10m'::TEXT, 'scheduled'::TEXT, 'runs every 10 minutes'::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT
    'doc2share:maintenance_hourly'::TEXT,
    'error'::TEXT,
    SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.run_backend_maintenance(TEXT, INTERVAL, INTERVAL, INTERVAL, INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_backend_cron_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_backend_maintenance(TEXT, INTERVAL, INTERVAL, INTERVAL, INTERVAL) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_backend_cron_jobs() TO service_role;
