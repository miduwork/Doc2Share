-- P0 Security hardening
-- 1) Remove self-grant path for permissions
-- 2) Restrict security_logs insert policy
-- 3) Prevent self-escalation on sensitive profile fields
-- 4) Prevent anon/authenticated direct select on documents.file_path

-- 1) permissions: admin-only insert policy for authenticated role
DROP POLICY IF EXISTS "Only admin or system can insert permissions" ON permissions;
DROP POLICY IF EXISTS "Admin can insert permissions" ON permissions;
CREATE POLICY "Admin can insert permissions"
  ON permissions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- 2) security_logs: only admin-authenticated inserts (service role bypasses RLS)
DROP POLICY IF EXISTS "System can insert security_logs" ON security_logs;
CREATE POLICY "System can insert security_logs"
  ON security_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- 3) Block non-admin users from changing sensitive profile fields on self-update
CREATE OR REPLACE FUNCTION public.prevent_profile_sensitive_self_update()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.admin_role IS DISTINCT FROM OLD.admin_role
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.two_fa_enabled IS DISTINCT FROM OLD.two_fa_enabled THEN
      RAISE EXCEPTION 'Not allowed to update sensitive profile fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_sensitive_update_guard ON profiles;
CREATE TRIGGER on_profile_sensitive_update_guard
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.prevent_profile_sensitive_self_update();

-- 4) Prevent direct file_path exposure for anon/authenticated roles
REVOKE SELECT (file_path) ON TABLE documents FROM anon, authenticated;
