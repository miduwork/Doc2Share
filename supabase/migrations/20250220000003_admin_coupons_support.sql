-- Coupons & Support notes for Admin Dashboard
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(12,2) NOT NULL,
  min_order_amount NUMERIC(12,2),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  max_uses INT,
  used_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE support_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_support_notes_user ON support_notes(user_id);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage coupons"
  ON coupons FOR ALL USING ((
    SELECT role FROM profiles WHERE id = auth.uid()
  ) = 'admin');

CREATE POLICY "Admin can manage support_notes"
  ON support_notes FOR ALL USING ((
    SELECT role FROM profiles WHERE id = auth.uid()
  ) = 'admin');

-- Admin can view all active_sessions (for Session Management)
CREATE POLICY "Admin can view all active_sessions"
  ON active_sessions FOR SELECT USING ((
    SELECT role FROM profiles WHERE id = auth.uid()
  ) = 'admin');
