-- P0 admin security hardening:
-- 1) Time-bound ban via profiles.banned_until
-- 2) Dedicated admin security audit table
-- 3) Atomic panic RPC to prevent half-failed states

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_banned_until
  ON profiles (banned_until)
  WHERE banned_until IS NOT NULL;

-- Keep RLS helper aligned with new account status semantics.
CREATE OR REPLACE FUNCTION public.has_admin_role(p_roles admin_role[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
      AND (banned_until IS NULL OR banned_until <= NOW())
      AND admin_role = ANY(p_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE TABLE IF NOT EXISTS admin_security_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_security_actions_target_created
  ON admin_security_actions (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_security_actions_actor_created
  ON admin_security_actions (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_security_actions_type_created
  ON admin_security_actions (action_type, created_at DESC);

ALTER TABLE admin_security_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin can view admin security actions" ON admin_security_actions;
CREATE POLICY "Super admin can view admin security actions"
  ON admin_security_actions FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));

DROP POLICY IF EXISTS "Super admin can insert admin security actions" ON admin_security_actions;
CREATE POLICY "Super admin can insert admin security actions"
  ON admin_security_actions FOR INSERT
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role]));

CREATE OR REPLACE FUNCTION public.panic_user_atomic(
  p_user_id UUID,
  p_actor_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
  v_is_super_admin BOOLEAN := false;
BEGIN
  -- Prevent actor spoofing.
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
  UPDATE profiles
    SET is_active = false,
        updated_at = NOW()
    WHERE id = p_user_id;
  DELETE FROM active_sessions WHERE user_id = p_user_id;
  DELETE FROM device_logs WHERE user_id = p_user_id;

  IF COALESCE((p_metadata->>'simulate_error')::BOOLEAN, false) THEN
    RAISE EXCEPTION 'simulated_panic_failure';
  END IF;

  INSERT INTO admin_security_actions (action_type, target_user_id, actor_user_id, reason, metadata)
  VALUES ('panic', p_user_id, p_actor_id, p_reason, COALESCE(p_metadata, '{}'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.panic_user_atomic(UUID, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.panic_user_atomic(UUID, UUID, TEXT, JSONB) TO authenticated;
