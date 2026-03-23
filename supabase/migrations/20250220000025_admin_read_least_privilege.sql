-- Least-privilege: restrict admin read/insert for security, observability, and webhook to super_admin only.
-- Requires public.has_admin_role(admin_role[]) from 20250220000024_admin_role_rls_hardening.sql.

-- Access logs: only super_admin can view
DROP POLICY IF EXISTS "Admin can view access_logs" ON access_logs;
CREATE POLICY "Admin can view access_logs"
  ON access_logs FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));

-- Security logs: only super_admin can view; restrict insert to super_admin where policy exists
DROP POLICY IF EXISTS "Admin can view security_logs" ON security_logs;
CREATE POLICY "Admin can view security_logs"
  ON security_logs FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));

DROP POLICY IF EXISTS "System can insert security_logs" ON security_logs;
CREATE POLICY "System can insert security_logs"
  ON security_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role]));

-- Users can insert own low/medium; only super_admin can insert high (or on behalf of others)
DROP POLICY IF EXISTS "Users can insert own security_logs" ON security_logs;
CREATE POLICY "Users can insert own security_logs"
  ON security_logs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (severity IN ('low', 'medium') OR public.has_admin_role(ARRAY['super_admin'::admin_role]))
  );

-- Observability: only super_admin can view
DROP POLICY IF EXISTS "Admin can view observability events" ON observability_events;
CREATE POLICY "Admin can view observability events"
  ON observability_events FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));

-- Webhook events: only super_admin can view
DROP POLICY IF EXISTS "Admin can view webhook events" ON webhook_events;
CREATE POLICY "Admin can view webhook events"
  ON webhook_events FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));

-- Backend maintenance runs: only super_admin can view
DROP POLICY IF EXISTS "Admin can view backend maintenance runs" ON backend_maintenance_runs;
CREATE POLICY "Admin can view backend maintenance runs"
  ON backend_maintenance_runs FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));
