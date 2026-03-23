-- P3.5: Capacity planning helpers
-- - Storage/row estimate overview for hot backend tables
-- - Dedicated cleanup for observability + webhook idempotency history

CREATE OR REPLACE VIEW backend_capacity_overview AS
SELECT
  t.table_name,
  pg_total_relation_size(format('%I.%I', t.table_schema, t.table_name)::regclass) AS total_bytes,
  pg_relation_size(format('%I.%I', t.table_schema, t.table_name)::regclass) AS table_bytes,
  pg_indexes_size(format('%I.%I', t.table_schema, t.table_name)::regclass) AS index_bytes,
  COALESCE(s.n_live_tup::BIGINT, 0) AS est_live_rows,
  COALESCE(s.n_dead_tup::BIGINT, 0) AS est_dead_rows,
  s.last_vacuum,
  s.last_autovacuum,
  s.last_analyze,
  s.last_autoanalyze
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s
  ON s.relname = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_name IN (
    'access_logs',
    'security_logs',
    'observability_events',
    'webhook_events',
    'orders',
    'order_items',
    'permissions'
  )
ORDER BY total_bytes DESC;

CREATE OR REPLACE FUNCTION public.cleanup_observability_history(
  p_observability_keep INTERVAL DEFAULT INTERVAL '30 days',
  p_webhook_keep INTERVAL DEFAULT INTERVAL '90 days'
)
RETURNS TABLE (
  observability_deleted BIGINT,
  webhook_deleted BIGINT
) AS $$
DECLARE
  v_obs BIGINT := 0;
  v_wh BIGINT := 0;
BEGIN
  WITH del_obs AS (
    DELETE FROM observability_events
    WHERE created_at < NOW() - p_observability_keep
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_obs FROM del_obs;

  WITH del_wh AS (
    DELETE FROM webhook_events
    WHERE first_seen_at < NOW() - p_webhook_keep
      AND status IN ('processed', 'ignored', 'error')
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_wh FROM del_wh;

  RETURN QUERY SELECT v_obs, v_wh;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.cleanup_observability_history(INTERVAL, INTERVAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_observability_history(INTERVAL, INTERVAL) TO service_role;
