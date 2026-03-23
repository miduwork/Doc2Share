-- Allow super_admin to SELECT all orders (for Admin Overview / reporting).
-- Without this, overview only showed the current admin's own orders.
DROP POLICY IF EXISTS "Admin can view all orders" ON orders;
CREATE POLICY "Admin can view all orders"
  ON orders FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));
