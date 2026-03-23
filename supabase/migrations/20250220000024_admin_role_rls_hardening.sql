-- P0-hardening follow-up: align legacy admin RLS with app guard (is_active + admin_role).

CREATE OR REPLACE FUNCTION public.has_admin_role(p_roles admin_role[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
      AND admin_role = ANY(p_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Admin can manage coupons" ON coupons;
CREATE POLICY "Admin can manage coupons"
  ON coupons FOR ALL
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]))
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role]));

DROP POLICY IF EXISTS "Admin can manage support_notes" ON support_notes;
CREATE POLICY "Admin can manage support_notes"
  ON support_notes FOR ALL
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'support_agent'::admin_role]))
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role, 'support_agent'::admin_role]));

DROP POLICY IF EXISTS "Admin can view all active_sessions" ON active_sessions;
CREATE POLICY "Admin can view all active_sessions"
  ON active_sessions FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));
