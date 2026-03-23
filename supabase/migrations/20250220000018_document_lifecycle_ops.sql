-- P4.2: Document lifecycle ops (orphan cleanup + cron + metrics/alerts)

CREATE OR REPLACE FUNCTION public.extract_public_asset_path(p_url TEXT)
RETURNS TEXT AS $$
DECLARE
  v TEXT;
BEGIN
  IF p_url IS NULL OR btrim(p_url) = '' THEN
    RETURN NULL;
  END IF;

  IF p_url !~ '/object/public/public_assets/' THEN
    RETURN p_url;
  END IF;

  v := regexp_replace(p_url, '^.*?/object/public/public_assets/', '');
  v := split_part(v, '?', 1);
  RETURN NULLIF(v, '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.cleanup_orphan_document_assets(
  p_grace INTERVAL DEFAULT INTERVAL '48 hours',
  p_limit INT DEFAULT 500
)
RETURNS TABLE (
  private_deleted BIGINT,
  public_deleted BIGINT
) AS $$
DECLARE
  v_private BIGINT := 0;
  v_public BIGINT := 0;
BEGIN
  WITH referenced_private AS (
    SELECT file_path AS object_name
    FROM documents
    WHERE file_path IS NOT NULL AND file_path <> ''
    UNION
    SELECT main_file_path
    FROM document_upload_sessions
    WHERE main_file_path IS NOT NULL AND main_file_path <> ''
      AND status IN ('uploaded', 'finalized')
  ),
  candidates_private AS (
    SELECT o.id
    FROM storage.objects o
    LEFT JOIN referenced_private rp ON rp.object_name = o.name
    WHERE o.bucket_id = 'private_documents'
      AND o.created_at < NOW() - p_grace
      AND rp.object_name IS NULL
    ORDER BY o.created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 5000))
  ),
  del_private AS (
    DELETE FROM storage.objects o
    USING candidates_private c
    WHERE o.id = c.id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_private FROM del_private;

  WITH referenced_public AS (
    SELECT public.extract_public_asset_path(thumbnail_url) AS object_name
    FROM documents
    WHERE thumbnail_url IS NOT NULL AND thumbnail_url <> ''
    UNION
    SELECT public.extract_public_asset_path(preview_url)
    FROM documents
    WHERE preview_url IS NOT NULL AND preview_url <> ''
    UNION
    SELECT public.extract_public_asset_path(cover_file_path)
    FROM document_upload_sessions
    WHERE cover_file_path IS NOT NULL AND cover_file_path <> ''
      AND status IN ('uploaded', 'finalized')
    UNION
    SELECT public.extract_public_asset_path(preview_file_path)
    FROM document_upload_sessions
    WHERE preview_file_path IS NOT NULL AND preview_file_path <> ''
      AND status IN ('uploaded', 'finalized')
  ),
  candidates_public AS (
    SELECT o.id
    FROM storage.objects o
    LEFT JOIN referenced_public rp ON rp.object_name = o.name
    WHERE o.bucket_id = 'public_assets'
      AND o.created_at < NOW() - p_grace
      AND rp.object_name IS NULL
    ORDER BY o.created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 5000))
  ),
  del_public AS (
    DELETE FROM storage.objects o
    USING candidates_public c
    WHERE o.id = c.id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_public FROM del_public;

  INSERT INTO observability_events (source, event_type, severity, status_code, metadata)
  VALUES (
    'db.document_lifecycle',
    'orphan_cleanup',
    CASE WHEN v_private + v_public > 0 THEN 'info' ELSE 'warn' END,
    200,
    jsonb_build_object(
      'private_deleted', v_private,
      'public_deleted', v_public,
      'grace', p_grace::TEXT,
      'limit', p_limit
    )
  );

  RETURN QUERY SELECT v_private, v_public;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.run_document_pipeline_tick(
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  claimed BIGINT,
  completed BIGINT,
  failed BIGINT
) AS $$
DECLARE
  v_claimed BIGINT := 0;
  v_completed BIGINT := 0;
  v_failed BIGINT := 0;
  v_job RECORD;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS tmp_claimed_jobs(
    job_id UUID,
    document_id UUID,
    upload_session_id UUID,
    attempts INT,
    job_type TEXT
  ) ON COMMIT DROP;
  TRUNCATE TABLE tmp_claimed_jobs;

  INSERT INTO tmp_claimed_jobs (job_id, document_id, upload_session_id, attempts, job_type)
  SELECT * FROM public.claim_document_processing_jobs(p_limit);

  SELECT COUNT(*) INTO v_claimed FROM tmp_claimed_jobs;

  FOR v_job IN SELECT * FROM tmp_claimed_jobs LOOP
    BEGIN
      -- Placeholder: run lightweight post-process pipeline.
      PERFORM public.complete_document_processing_job(
        v_job.job_id,
        true,
        NULL,
        true,
        120
      );
      v_completed := v_completed + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.complete_document_processing_job(
        v_job.job_id,
        false,
        SQLERRM,
        false,
        120
      );
      v_failed := v_failed + 1;
    END;
  END LOOP;

  INSERT INTO observability_events (source, event_type, severity, status_code, metadata)
  VALUES (
    'db.document_lifecycle',
    'pipeline_tick',
    CASE WHEN v_failed > 0 THEN 'warn' ELSE 'info' END,
    200,
    jsonb_build_object('claimed', v_claimed, 'completed', v_completed, 'failed', v_failed)
  );

  RETURN QUERY SELECT v_claimed, v_completed, v_failed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE VIEW document_lifecycle_metrics_24h AS
WITH jobs AS (
  SELECT *
  FROM document_processing_jobs
  WHERE created_at >= NOW() - INTERVAL '24 hours'
),
events AS (
  SELECT *
  FROM observability_events
  WHERE created_at >= NOW() - INTERVAL '24 hours'
)
SELECT
  (SELECT COUNT(*) FROM document_processing_jobs WHERE status = 'queued') AS queued_now,
  (SELECT COUNT(*) FROM document_processing_jobs WHERE status = 'processing') AS processing_now,
  (SELECT COUNT(*) FROM document_processing_jobs WHERE status = 'failed') AS failed_now,
  (SELECT COUNT(*) FROM jobs WHERE status = 'done') AS jobs_done_24h,
  (SELECT COUNT(*) FROM jobs WHERE status = 'failed') AS jobs_failed_24h,
  (SELECT COUNT(*) FROM events WHERE source = 'db.document_lifecycle' AND event_type = 'pipeline_tick') AS pipeline_ticks_24h,
  (SELECT COUNT(*) FROM events WHERE source = 'db.document_lifecycle' AND event_type = 'orphan_cleanup') AS orphan_cleanup_runs_24h,
  (SELECT COALESCE(SUM((metadata->>'private_deleted')::BIGINT), 0) FROM events WHERE source = 'db.document_lifecycle' AND event_type = 'orphan_cleanup') AS orphan_private_deleted_24h,
  (SELECT COALESCE(SUM((metadata->>'public_deleted')::BIGINT), 0) FROM events WHERE source = 'db.document_lifecycle' AND event_type = 'orphan_cleanup') AS orphan_public_deleted_24h;

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
  v_pipeline_failed_30m BIGINT;
  v_pipeline_backlog BIGINT;
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

  SELECT COUNT(*) INTO v_pipeline_failed_30m
  FROM document_processing_jobs
  WHERE status = 'failed'
    AND updated_at >= p_now - INTERVAL '30 minutes';

  SELECT COUNT(*) INTO v_pipeline_backlog
  FROM document_processing_jobs
  WHERE status IN ('queued', 'processing');

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

  IF v_pipeline_failed_30m >= 10 THEN
    RETURN QUERY SELECT
      'document_pipeline_failed_spike'::TEXT,
      'high'::TEXT,
      v_pipeline_failed_30m,
      10::BIGINT,
      '30m'::TEXT,
      'Document processing failed jobs increased in last 30 minutes'::TEXT;
  END IF;

  IF v_pipeline_backlog >= 200 THEN
    RETURN QUERY SELECT
      'document_pipeline_backlog_high'::TEXT,
      'medium'::TEXT,
      v_pipeline_backlog,
      200::BIGINT,
      'now'::TEXT,
      'Document processing backlog is high (queued + processing)'::TEXT;
  END IF;
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
    RETURN QUERY SELECT 'doc2share:maintenance_hourly'::TEXT, 'skipped'::TEXT, 'cron schema not available; use external scheduler'::TEXT;
    RETURN QUERY SELECT 'doc2share:alerts_10m'::TEXT, 'skipped'::TEXT, 'cron schema not available; use external scheduler'::TEXT;
    RETURN QUERY SELECT 'doc2share:document_pipeline_5m'::TEXT, 'skipped'::TEXT, 'cron schema not available; use external scheduler'::TEXT;
    RETURN QUERY SELECT 'doc2share:orphan_cleanup_daily'::TEXT, 'skipped'::TEXT, 'cron schema not available; use external scheduler'::TEXT;
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN (
    'doc2share:maintenance_hourly',
    'doc2share:alerts_10m',
    'doc2share:document_pipeline_5m',
    'doc2share:orphan_cleanup_daily'
  );

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

  PERFORM cron.schedule(
    'doc2share:document_pipeline_5m',
    '*/5 * * * *',
    $job$SELECT public.run_document_pipeline_tick(25);$job$
  );

  PERFORM cron.schedule(
    'doc2share:orphan_cleanup_daily',
    '25 2 * * *',
    $job$SELECT public.cleanup_orphan_document_assets(INTERVAL '48 hours', 2000);$job$
  );

  RETURN QUERY SELECT 'doc2share:maintenance_hourly'::TEXT, 'scheduled'::TEXT, 'runs hourly at minute 5'::TEXT;
  RETURN QUERY SELECT 'doc2share:alerts_10m'::TEXT, 'scheduled'::TEXT, 'runs every 10 minutes'::TEXT;
  RETURN QUERY SELECT 'doc2share:document_pipeline_5m'::TEXT, 'scheduled'::TEXT, 'runs every 5 minutes'::TEXT;
  RETURN QUERY SELECT 'doc2share:orphan_cleanup_daily'::TEXT, 'scheduled'::TEXT, 'runs daily at 02:25'::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 'doc2share:maintenance_hourly'::TEXT, 'error'::TEXT, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.cleanup_orphan_document_assets(INTERVAL, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_document_pipeline_tick(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.extract_public_asset_path(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cleanup_orphan_document_assets(INTERVAL, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_document_pipeline_tick(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.extract_public_asset_path(TEXT) TO service_role;
