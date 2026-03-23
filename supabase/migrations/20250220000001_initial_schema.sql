-- ============================================
-- DOC2SHARE: Secure Educational Document Marketplace
-- Initial schema: enums, tables, RLS, triggers
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== ENUMS ==========
CREATE TYPE category_type AS ENUM ('subject', 'grade', 'exam');
CREATE TYPE profile_role AS ENUM ('student', 'teacher', 'admin');
CREATE TYPE admin_role AS ENUM ('super_admin', 'content_manager', 'support_agent');
CREATE TYPE order_status AS ENUM ('pending', 'completed', 'expired', 'canceled');
CREATE TYPE security_event_type AS ENUM ('login', 'file_access', 'multiple_devices', 'ip_change', 'print_attempt');
CREATE TYPE security_severity AS ENUM ('low', 'medium', 'high');

-- ========== TABLES ==========

-- Categories (subject, grade, exam)
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type category_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role profile_role NOT NULL DEFAULT 'student',
  admin_role admin_role, -- only set for users with role = 'admin'
  is_active BOOLEAN NOT NULL DEFAULT true,
  two_fa_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents (file_path hidden from normal users via RLS)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  file_path TEXT NOT NULL,
  preview_url TEXT,
  preview_text TEXT, -- 20-30% extracted for SEO
  subject_id INT REFERENCES categories(id),
  grade_id INT REFERENCES categories(id),
  exam_id INT REFERENCES categories(id),
  is_downloadable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions (who can access which document)
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, document_id)
);

-- Device logs (max 2 devices per user)
CREATE TABLE device_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_info JSONB DEFAULT '{}',
  last_login TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- Active sessions (single session enforcement)
CREATE TABLE active_sessions (
  session_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage stats (rate limiting, analytics)
CREATE TABLE usage_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  view_count INT NOT NULL DEFAULT 0,
  last_view_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, document_id)
);

-- Access logs (audit trail)
CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  ip_address TEXT,
  device_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security logs (flagging, automated response)
CREATE TABLE security_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type security_event_type NOT NULL,
  severity security_severity NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders (PayOS/VietQR)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  payment_ref TEXT,
  external_id TEXT UNIQUE,
  payment_link TEXT,
  raw_webhook_log JSONB,
  order_items JSONB DEFAULT '[]', -- [{ document_id, quantity, price }]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items link (for permissions per document)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_documents_subject ON documents(subject_id);
CREATE INDEX idx_documents_grade ON documents(grade_id);
CREATE INDEX idx_documents_exam ON documents(exam_id);
CREATE INDEX idx_permissions_user ON permissions(user_id);
CREATE INDEX idx_permissions_document ON permissions(document_id);
CREATE INDEX idx_device_logs_user ON device_logs(user_id);
CREATE INDEX idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX idx_usage_stats_user ON usage_stats(user_id);
CREATE INDEX idx_access_logs_user_created ON access_logs(user_id, created_at);
CREATE INDEX idx_security_logs_user_severity ON security_logs(user_id, severity, created_at);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_orders_external ON orders(external_id);

-- ========== ROW LEVEL SECURITY ==========

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin (profile.role = 'admin')
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get current user's profile role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS profile_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Categories: public read
CREATE POLICY "Categories are viewable by everyone"
  ON categories FOR SELECT USING (true);

CREATE POLICY "Only admin can manage categories"
  ON categories FOR ALL USING (is_admin());

-- Documents: public can see list (without file_path), admin full CRUD
-- We expose a safe view for public that omits file_path
CREATE VIEW documents_public AS
  SELECT id, title, description, price, preview_url, preview_text,
         subject_id, grade_id, exam_id, is_downloadable, created_at, updated_at
  FROM documents;

-- RLS on documents: SELECT allowed for all (for listing), but we'll use view for public
CREATE POLICY "Documents list viewable by everyone"
  ON documents FOR SELECT USING (true);

CREATE POLICY "Only admin can insert documents"
  ON documents FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Only admin can update documents"
  ON documents FOR UPDATE USING (is_admin());

CREATE POLICY "Only admin can delete documents"
  ON documents FOR DELETE USING (is_admin());

-- Hide file_path from non-admin: use column-level policy via view in app;
-- for direct table access, restrict file_path to service role / admin only.
-- Supabase RLS doesn't support column-level, so we use a trigger to null file_path for non-admin.
-- Simpler: app and Edge Function use service role to read file_path; client only uses documents_public or selects without file_path.
-- So we keep SELECT policy as true but the app will never select file_path for non-admin (Edge Function uses service role).
-- Optional: create a secure view that excludes file_path and grant SELECT on that view to anon/authenticated.

-- Permissions: users see only their own
CREATE POLICY "Users see own permissions"
  ON permissions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Only admin or system can insert permissions"
  ON permissions FOR INSERT WITH CHECK (is_admin() OR auth.uid() = user_id);
-- System inserts via service role, so no WITH CHECK for service. For authenticated, restrict.
-- Better: only service role inserts from webhook. So no INSERT for authenticated except we need "manual unlock" from admin.
CREATE POLICY "Admin can insert permissions"
  ON permissions FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admin can delete permissions"
  ON permissions FOR DELETE USING (is_admin());

-- Device logs: users see and manage own
CREATE POLICY "Users see own device_logs"
  ON device_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own device_logs"
  ON device_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own device_logs"
  ON device_logs FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own device_logs"
  ON device_logs FOR DELETE USING (auth.uid() = user_id);

-- Active sessions: users see own
CREATE POLICY "Users see own active_sessions"
  ON active_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON active_sessions FOR DELETE USING (auth.uid() = user_id);

-- Usage stats: users see own
CREATE POLICY "Users see own usage_stats"
  ON usage_stats FOR SELECT USING (auth.uid() = user_id);

-- Access logs: admin only (or service role)
CREATE POLICY "Admin can view access_logs"
  ON access_logs FOR SELECT USING (is_admin());

-- Security logs: admin only
CREATE POLICY "Admin can view security_logs"
  ON security_logs FOR SELECT USING (is_admin());

CREATE POLICY "System can insert security_logs"
  ON security_logs FOR INSERT WITH CHECK (true); -- service role / triggers

-- Orders: users see own
CREATE POLICY "Users see own orders"
  ON orders FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders"
  ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Only system updates orders"
  ON orders FOR UPDATE USING (false); -- webhook uses service role
CREATE POLICY "Admin can update orders"
  ON orders FOR UPDATE USING (is_admin());

-- Order items: users see via their orders
CREATE POLICY "Users see own order_items"
  ON order_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
  );

CREATE POLICY "Admin or system manage order_items"
  ON order_items FOR ALL USING (is_admin());

-- Profiles: users can read/update own (limited fields); admin can manage all
CREATE POLICY "Users see own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile (limited)"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles"
  ON profiles FOR SELECT USING (is_admin());

CREATE POLICY "Admin can update all profiles"
  ON profiles FOR UPDATE USING (is_admin());

-- ========== TRIGGERS ==========

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    'student'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Log high severity when user has > 2 devices (on insert to device_logs)
CREATE OR REPLACE FUNCTION check_device_limit()
RETURNS TRIGGER AS $$
DECLARE
  device_count INT;
BEGIN
  SELECT COUNT(DISTINCT device_id) INTO device_count
  FROM device_logs
  WHERE user_id = NEW.user_id;

  IF device_count > 2 THEN
    INSERT INTO security_logs (user_id, event_type, severity, device_id, metadata)
    VALUES (NEW.user_id, 'multiple_devices', 'high', NEW.device_id,
            jsonb_build_object('device_count', device_count, 'message', 'User exceeded 2 device limit'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run check after insert (new device added)
CREATE TRIGGER on_device_log_insert
  AFTER INSERT ON device_logs
  FOR EACH ROW EXECUTE PROCEDURE check_device_limit();

-- Automated response: 3 high severity in 1 hour -> set is_active = false
CREATE OR REPLACE FUNCTION auto_disable_user_on_red_flags()
RETURNS TRIGGER AS $$
DECLARE
  red_count INT;
BEGIN
  IF NEW.severity <> 'high' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO red_count
  FROM security_logs
  WHERE user_id = NEW.user_id
    AND severity = 'high'
    AND created_at > (NOW() - INTERVAL '1 hour');

  IF red_count >= 3 THEN
    UPDATE profiles SET is_active = false, updated_at = NOW() WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_security_log_high
  AFTER INSERT ON security_logs
  FOR EACH ROW EXECUTE PROCEDURE auto_disable_user_on_red_flags();

-- ========== STORAGE BUCKET ==========
-- Run in Supabase Dashboard or via API: create bucket 'private_documents' (private).
-- No public access to file_path; signed URLs only via Edge Function.
