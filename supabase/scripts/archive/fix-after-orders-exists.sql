-- ============================================
-- Chạy script này khi đã lỗi "relation orders already exists"
-- (tức là các bảng trước orders đã có, chỉ thiếu phần từ orders trở đi)
-- Chạy trong Supabase SQL Editor.
-- ============================================

-- Hàm helper (cần cho policies)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS profile_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Orders & order_items (bỏ qua nếu đã có)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  payment_ref TEXT,
  external_id TEXT UNIQUE,
  payment_link TEXT,
  raw_webhook_log JSONB,
  order_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL
);

-- Indexes (bỏ qua nếu đã có)
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_external ON orders(external_id);

-- RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Policies cho orders (xóa cũ rồi tạo lại để tránh trùng)
DROP POLICY IF EXISTS "Users see own orders" ON orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
DROP POLICY IF EXISTS "Only system updates orders" ON orders;
DROP POLICY IF EXISTS "Admin can update orders" ON orders;

CREATE POLICY "Users see own orders"
  ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders"
  ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Only system updates orders"
  ON orders FOR UPDATE USING (false);
CREATE POLICY "Admin can update orders"
  ON orders FOR UPDATE USING (is_admin());

-- Policies cho order_items
DROP POLICY IF EXISTS "Users see own order_items" ON order_items;
DROP POLICY IF EXISTS "Admin or system manage order_items" ON order_items;

CREATE POLICY "Users see own order_items"
  ON order_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
  );
CREATE POLICY "Admin or system manage order_items"
  ON order_items FOR ALL USING (is_admin());
