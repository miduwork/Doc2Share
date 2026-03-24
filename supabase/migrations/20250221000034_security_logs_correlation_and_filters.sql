-- P1 investigation hardening:
-- - dedicated correlation_id columns
-- - best-effort backfill from metadata.request_id
-- - indexes for filtering and cursor pagination

ALTER TABLE access_logs
  ADD COLUMN IF NOT EXISTS correlation_id TEXT;

ALTER TABLE security_logs
  ADD COLUMN IF NOT EXISTS correlation_id TEXT;

ALTER TABLE admin_security_actions
  ADD COLUMN IF NOT EXISTS correlation_id TEXT;

UPDATE access_logs
SET correlation_id = COALESCE(metadata->>'correlation_id', metadata->>'request_id')
WHERE correlation_id IS NULL
  AND metadata IS NOT NULL
  AND (metadata ? 'correlation_id' OR metadata ? 'request_id');

UPDATE security_logs
SET correlation_id = COALESCE(metadata->>'correlation_id', metadata->>'request_id')
WHERE correlation_id IS NULL
  AND metadata IS NOT NULL
  AND (metadata ? 'correlation_id' OR metadata ? 'request_id');

UPDATE admin_security_actions
SET correlation_id = COALESCE(metadata->>'correlation_id', metadata->>'request_id')
WHERE correlation_id IS NULL
  AND metadata IS NOT NULL
  AND (metadata ? 'correlation_id' OR metadata ? 'request_id');

CREATE INDEX IF NOT EXISTS idx_access_logs_created_at_id_desc
  ON access_logs (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_correlation_created_desc
  ON access_logs (correlation_id, created_at DESC)
  WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_logs_user_created_desc
  ON access_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_document_created_desc
  ON access_logs (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_status_created_desc
  ON access_logs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_ip_created_desc
  ON access_logs (ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_logs_created_at_id_desc
  ON security_logs (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_correlation_created_desc
  ON security_logs (correlation_id, created_at DESC)
  WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_logs_user_created_desc
  ON security_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity_created_desc
  ON security_logs (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_created_desc
  ON security_logs (ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_security_actions_correlation_created_desc
  ON admin_security_actions (correlation_id, created_at DESC)
  WHERE correlation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.panic_user_atomic(
  p_user_id UUID,
  p_actor_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
  v_is_super_admin BOOLEAN := false;
  v_metadata JSONB := COALESCE(p_metadata, '{}'::jsonb);
BEGIN
  IF auth.uid() IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'actor mismatch';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND admin_role = 'super_admin'
      AND is_active = true
      AND (banned_until IS NULL OR banned_until <= NOW())
  ) INTO v_is_super_admin;

  IF NOT v_is_super_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM permissions WHERE user_id = p_user_id;
  UPDATE profiles SET is_active = false, updated_at = NOW() WHERE id = p_user_id;
  DELETE FROM active_sessions WHERE user_id = p_user_id;
  DELETE FROM device_logs WHERE user_id = p_user_id;

  IF COALESCE((v_metadata->>'simulate_error')::BOOLEAN, false) THEN
    RAISE EXCEPTION 'simulated_panic_failure';
  END IF;

  INSERT INTO admin_security_actions (action_type, target_user_id, actor_user_id, reason, correlation_id, metadata)
  VALUES ('panic', p_user_id, p_actor_id, p_reason, NULLIF(v_metadata->>'correlation_id', ''), v_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
