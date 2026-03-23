-- ============================================
-- DOC2SHARE: Chạy TOÀN BỘ schema trong Supabase SQL Editor (idempotent)
-- Chạy 1 lần. Nếu bảng/type đã có sẽ bỏ qua. Sau đó chạy promote-user-to-admin.sql
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums (bỏ qua nếu đã có)
DO $$ BEGIN
  CREATE TYPE category_type AS ENUM ('subject', 'grade', 'exam');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE profile_role AS ENUM ('student', 'teacher', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE admin_role AS ENUM ('super_admin', 'content_manager', 'support_agent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'completed', 'expired', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE security_event_type AS ENUM ('login', 'file_access', 'multiple_devices', 'ip_change', 'print_attempt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE security_severity AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tables (đúng thứ tự phụ thuộc)
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type category_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role profile_role NOT NULL DEFAULT 'student',
  admin_role admin_role,
  is_active BOOLEAN NOT NULL DEFAULT true,
  two_fa_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  file_path TEXT NOT NULL,
  preview_url TEXT,
  preview_text TEXT,
  subject_id INT REFERENCES categories(id),
  grade_id INT REFERENCES categories(id),
  exam_id INT REFERENCES categories(id),
  is_downloadable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, document_id)
);

CREATE TABLE IF NOT EXISTS device_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_info JSONB DEFAULT '{}',
  last_login TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

CREATE TABLE IF NOT EXISTS active_sessions (
  session_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  view_count INT NOT NULL DEFAULT 0,
  last_view_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, document_id)
);

CREATE TABLE IF NOT EXISTS access_logs (
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

CREATE TABLE IF NOT EXISTS security_logs (
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

CREATE TABLE IF NOT EXISTS coupons (
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

CREATE TABLE IF NOT EXISTS support_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_subject ON documents(subject_id);
CREATE INDEX IF NOT EXISTS idx_documents_grade ON documents(grade_id);
CREATE INDEX IF NOT EXISTS idx_documents_exam ON documents(exam_id);
CREATE INDEX IF NOT EXISTS idx_permissions_user ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_document ON permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_device_logs_user ON device_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_user ON usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_created ON access_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_severity ON security_logs(user_id, severity, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_external ON orders(external_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_support_notes_user ON support_notes(user_id);

-- Hot listing queries (filter + sort)
CREATE INDEX IF NOT EXISTS idx_documents_grade_created ON documents(grade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_subject_created ON documents(subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_exam_created ON documents(exam_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_grade_price ON documents(grade_id, price);
CREATE INDEX IF NOT EXISTS idx_documents_subject_price ON documents(subject_id, price);
CREATE INDEX IF NOT EXISTS idx_documents_exam_price ON documents(exam_id, price);

-- Logs (high volume)
CREATE INDEX IF NOT EXISTS idx_access_logs_user_action_status_created
  ON access_logs(user_id, action, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_action_created
  ON access_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_brin
  ON access_logs USING brin(created_at);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_brin
  ON security_logs USING brin(created_at);

-- RLS
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
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_notes ENABLE ROW LEVEL SECURITY;

-- Functions
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

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

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS profile_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.create_checkout_order(p_document_id UUID)
RETURNS TABLE (
  order_id UUID,
  total_amount NUMERIC,
  document_title TEXT
) AS $$
DECLARE
  v_user_id UUID;
  v_price NUMERIC;
  v_title TEXT;
  v_order_id UUID;
  v_external_id TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT price, title INTO v_price, v_title
  FROM documents
  WHERE id = p_document_id;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;
  IF v_price <= 0 THEN
    RAISE EXCEPTION 'Invalid document price';
  END IF;
  IF v_price <> trunc(v_price) THEN
    RAISE EXCEPTION 'Price must be integer VND for bank transfer';
  END IF;

  v_order_id := gen_random_uuid();
  v_external_id := 'VQR-' || UPPER(REPLACE(gen_random_uuid()::text, '-', ''));

  INSERT INTO orders (
    id, user_id, total_amount, status, external_id, order_items, created_at, updated_at
  )
  VALUES (
    v_order_id,
    v_user_id,
    v_price,
    'pending',
    v_external_id,
    jsonb_build_array(jsonb_build_object('document_id', p_document_id, 'quantity', 1, 'price', v_price)),
    NOW(),
    NOW()
  );

  INSERT INTO order_items (order_id, document_id, quantity, price)
  VALUES (v_order_id, p_document_id, 1, v_price);

  RETURN QUERY
  SELECT v_order_id, v_price, v_title;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_checkout_order(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_order_and_grant_permissions(
  p_order_id UUID,
  p_external_ref TEXT DEFAULT NULL,
  p_raw_webhook JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  already_completed BOOLEAN,
  granted_count INT
) AS $$
DECLARE
  v_user_id UUID;
  v_status order_status;
  v_now TIMESTAMPTZ := NOW();
  v_granted INT := 0;
BEGIN
  SELECT user_id, status INTO v_user_id, v_status
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_status = 'completed' THEN
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  UPDATE orders
  SET
    status = 'completed',
    payment_ref = COALESCE(p_external_ref, payment_ref),
    external_id = COALESCE(external_id, p_external_ref),
    raw_webhook_log = COALESCE(raw_webhook_log, '{}'::jsonb) || jsonb_build_object(
      'completed_at', v_now,
      'webhook', p_raw_webhook
    ),
    updated_at = v_now
  WHERE id = p_order_id;

  INSERT INTO permissions (user_id, document_id, granted_at, expires_at)
  SELECT v_user_id, oi.document_id, v_now, NULL
  FROM order_items oi
  WHERE oi.order_id = p_order_id
  ON CONFLICT (user_id, document_id)
  DO UPDATE SET
    granted_at = LEAST(permissions.granted_at, EXCLUDED.granted_at),
    expires_at = NULL;

  GET DIAGNOSTICS v_granted = ROW_COUNT;

  IF v_granted = 0 THEN
    INSERT INTO permissions (user_id, document_id, granted_at, expires_at)
    SELECT
      v_user_id,
      (item->>'document_id')::UUID,
      v_now,
      NULL
    FROM orders o,
         jsonb_array_elements(COALESCE(o.order_items, '[]'::jsonb)) AS item
    WHERE o.id = p_order_id
      AND item ? 'document_id'
      AND (item->>'document_id') ~* '^[0-9a-f-]{36}$'
    ON CONFLICT (user_id, document_id)
    DO UPDATE SET
      granted_at = LEAST(permissions.granted_at, EXCLUDED.granted_at),
      expires_at = NULL;

    GET DIAGNOSTICS v_granted = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT false, v_granted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.complete_order_and_grant_permissions(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_order_and_grant_permissions(UUID, TEXT, JSONB) TO service_role;

-- View
CREATE OR REPLACE VIEW documents_public AS
  SELECT id, title, description, price, preview_url, preview_text, thumbnail_url,
         subject_id, grade_id, exam_id, is_downloadable, created_at, updated_at
  FROM documents;

-- Policies (drop nếu có rồi tạo lại)
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;
DROP POLICY IF EXISTS "Only admin can manage categories" ON categories;
DROP POLICY IF EXISTS "Documents list viewable by everyone" ON documents;
DROP POLICY IF EXISTS "Only admin can insert documents" ON documents;
DROP POLICY IF EXISTS "Only admin can update documents" ON documents;
DROP POLICY IF EXISTS "Only admin can delete documents" ON documents;
DROP POLICY IF EXISTS "Users see own permissions" ON permissions;
DROP POLICY IF EXISTS "Only admin or system can insert permissions" ON permissions;
DROP POLICY IF EXISTS "Admin can insert permissions" ON permissions;
DROP POLICY IF EXISTS "Admin can delete permissions" ON permissions;
DROP POLICY IF EXISTS "Users see own device_logs" ON device_logs;
DROP POLICY IF EXISTS "Users can insert own device_logs" ON device_logs;
DROP POLICY IF EXISTS "Users can update own device_logs" ON device_logs;
DROP POLICY IF EXISTS "Users can delete own device_logs" ON device_logs;
DROP POLICY IF EXISTS "Users see own active_sessions" ON active_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON active_sessions;
DROP POLICY IF EXISTS "Users can insert own active_sessions" ON active_sessions;
DROP POLICY IF EXISTS "Admin can view all active_sessions" ON active_sessions;
DROP POLICY IF EXISTS "Users see own usage_stats" ON usage_stats;
DROP POLICY IF EXISTS "Admin can view access_logs" ON access_logs;
DROP POLICY IF EXISTS "Admin can view security_logs" ON security_logs;
DROP POLICY IF EXISTS "System can insert security_logs" ON security_logs;
DROP POLICY IF EXISTS "Users can insert own security_logs" ON security_logs;
DROP POLICY IF EXISTS "Users see own orders" ON orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
DROP POLICY IF EXISTS "Users cannot directly insert orders" ON orders;
DROP POLICY IF EXISTS "Only system updates orders" ON orders;
DROP POLICY IF EXISTS "Admin can update orders" ON orders;
DROP POLICY IF EXISTS "Users see own order_items" ON order_items;
DROP POLICY IF EXISTS "Admin or system manage order_items" ON order_items;
DROP POLICY IF EXISTS "Users see own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile (limited)" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can manage coupons" ON coupons;
DROP POLICY IF EXISTS "Admin can manage support_notes" ON support_notes;

CREATE POLICY "Categories are viewable by everyone" ON categories FOR SELECT USING (true);
CREATE POLICY "Only admin can manage categories"
  ON categories FOR ALL
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]))
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role]));

CREATE POLICY "Documents list viewable by everyone" ON documents FOR SELECT USING (true);
CREATE POLICY "Only admin can insert documents"
  ON documents FOR INSERT
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));
CREATE POLICY "Only admin can update documents"
  ON documents FOR UPDATE
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));
CREATE POLICY "Only admin can delete documents"
  ON documents FOR DELETE
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

CREATE POLICY "Users see own permissions" ON permissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can insert permissions"
  ON permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));
CREATE POLICY "Admin can delete permissions"
  ON permissions FOR DELETE
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

CREATE POLICY "Users see own device_logs" ON device_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own device_logs" ON device_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own device_logs" ON device_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own device_logs" ON device_logs FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users see own active_sessions" ON active_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON active_sessions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own active_sessions" ON active_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can view all active_sessions" ON active_sessions FOR SELECT USING (
  public.has_admin_role(ARRAY['super_admin'::admin_role])
);

CREATE POLICY "Users see own usage_stats" ON usage_stats FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view access_logs"
  ON access_logs FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));
CREATE POLICY "Admin can view security_logs"
  ON security_logs FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));
CREATE POLICY "System can insert security_logs"
  ON security_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role]));
CREATE POLICY "Users can insert own security_logs"
  ON security_logs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (severity IN ('low', 'medium') OR public.has_admin_role(ARRAY['super_admin'::admin_role]))
  );

CREATE POLICY "Users see own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users cannot directly insert orders" ON orders FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Only system updates orders" ON orders FOR UPDATE USING (false);
CREATE POLICY "Admin can update orders"
  ON orders FOR UPDATE
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));

CREATE POLICY "Users see own order_items" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
);
CREATE POLICY "Admin or system manage order_items"
  ON order_items FOR ALL
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]))
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role]));

CREATE POLICY "Users see own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile (limited)" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can view all profiles"
  ON profiles FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'support_agent'::admin_role]));
CREATE POLICY "Admin can update all profiles"
  ON profiles FOR UPDATE
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'support_agent'::admin_role]));
CREATE POLICY "Admin can manage coupons" ON coupons FOR ALL USING (
  public.has_admin_role(ARRAY['super_admin'::admin_role])
) WITH CHECK (
  public.has_admin_role(ARRAY['super_admin'::admin_role])
);
CREATE POLICY "Admin can manage support_notes" ON support_notes FOR ALL USING (
  public.has_admin_role(ARRAY['super_admin'::admin_role, 'support_agent'::admin_role])
) WITH CHECK (
  public.has_admin_role(ARRAY['super_admin'::admin_role, 'support_agent'::admin_role])
);

-- Triggers
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

CREATE OR REPLACE FUNCTION check_device_limit()
RETURNS TRIGGER AS $$
DECLARE device_count INT;
BEGIN
  SELECT COUNT(DISTINCT device_id) INTO device_count FROM device_logs WHERE user_id = NEW.user_id;
  IF device_count > 2 THEN
    INSERT INTO security_logs (user_id, event_type, severity, device_id, metadata)
    VALUES (NEW.user_id, 'multiple_devices', 'high', NEW.device_id,
            jsonb_build_object('device_count', device_count, 'message', 'User exceeded 2 device limit'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_device_log_insert ON device_logs;
CREATE TRIGGER on_device_log_insert
  AFTER INSERT ON device_logs
  FOR EACH ROW EXECUTE PROCEDURE check_device_limit();

CREATE OR REPLACE FUNCTION auto_disable_user_on_red_flags()
RETURNS TRIGGER AS $$
DECLARE red_count INT;
BEGIN
  IF NEW.severity <> 'high' THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO red_count FROM security_logs
  WHERE user_id = NEW.user_id AND severity = 'high' AND created_at > (NOW() - INTERVAL '1 hour');
  IF red_count >= 3 THEN
    UPDATE profiles SET is_active = false, updated_at = NOW() WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_security_log_high ON security_logs;
CREATE TRIGGER on_security_log_high
  AFTER INSERT ON security_logs
  FOR EACH ROW EXECUTE PROCEDURE auto_disable_user_on_red_flags();

-- Guard: users cannot self-update sensitive profile fields (any admin role allowed)
CREATE OR REPLACE FUNCTION public.prevent_profile_sensitive_self_update()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() = NEW.id
     AND NOT public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role, 'support_agent'::admin_role]) THEN
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
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_profile_sensitive_self_update();

-- Prevent direct file_path exposure for anon/authenticated roles
REVOKE SELECT (file_path) ON TABLE documents FROM anon, authenticated;

-- Maintenance function for log retention (call from scheduler/cron)
CREATE OR REPLACE FUNCTION public.cleanup_old_logs(
  p_access_logs_keep INTERVAL DEFAULT INTERVAL '90 days',
  p_security_logs_keep INTERVAL DEFAULT INTERVAL '180 days'
)
RETURNS TABLE (access_deleted BIGINT, security_deleted BIGINT) AS $$
DECLARE
  v_access BIGINT := 0;
  v_security BIGINT := 0;
BEGIN
  WITH del_access AS (
    DELETE FROM access_logs
    WHERE created_at < NOW() - p_access_logs_keep
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_access FROM del_access;

  WITH del_security AS (
    DELETE FROM security_logs
    WHERE created_at < NOW() - p_security_logs_keep
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_security FROM del_security;

  RETURN QUERY SELECT v_access, v_security;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.cleanup_old_logs(INTERVAL, INTERVAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_logs(INTERVAL, INTERVAL) TO service_role;

-- Observability (structured events + metrics + alert checks)
CREATE TABLE IF NOT EXISTS observability_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id TEXT,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  session_id TEXT,
  device_id TEXT,
  status_code INT,
  latency_ms INT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_observability_events_created ON observability_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observability_events_source_created ON observability_events(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observability_events_event_created ON observability_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observability_events_severity_created ON observability_events(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observability_events_request ON observability_events(request_id);
CREATE INDEX IF NOT EXISTS idx_observability_events_created_brin ON observability_events USING brin(created_at);

ALTER TABLE observability_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can view observability events" ON observability_events;
CREATE POLICY "Admin can view observability events"
  ON observability_events FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));

CREATE OR REPLACE VIEW observability_metrics_24h AS
WITH ev AS (
  SELECT * FROM observability_events
  WHERE created_at >= NOW() - INTERVAL '24 hours'
),
acc AS (
  SELECT * FROM access_logs
  WHERE created_at >= NOW() - INTERVAL '24 hours'
)
SELECT
  (SELECT COUNT(*) FROM ev) AS events_24h,
  (SELECT COUNT(*) FROM ev WHERE severity = 'error') AS errors_24h,
  (SELECT COUNT(*) FROM ev WHERE source = 'edge.payment_webhook') AS webhook_events_24h,
  (SELECT COUNT(*) FROM ev WHERE source = 'edge.payment_webhook' AND severity = 'error') AS webhook_errors_24h,
  (SELECT COUNT(*) FROM ev WHERE source = 'edge.get_secure_link') AS secure_link_events_24h,
  (SELECT COUNT(*) FROM ev WHERE source = 'edge.get_secure_link' AND event_type = 'blocked') AS secure_link_blocked_24h,
  (SELECT COALESCE(AVG(latency_ms), 0) FROM ev WHERE source = 'edge.payment_webhook' AND latency_ms IS NOT NULL) AS webhook_avg_latency_ms_24h,
  (SELECT COALESCE(AVG(latency_ms), 0) FROM ev WHERE source = 'edge.get_secure_link' AND latency_ms IS NOT NULL) AS secure_link_avg_latency_ms_24h,
  (SELECT COUNT(*) FROM acc WHERE action = 'payment_webhook') AS payment_webhook_access_logs_24h;

CREATE OR REPLACE FUNCTION public.check_observability_alerts(
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  alert_key TEXT,
  alert_level TEXT,
  metric_value BIGINT,
  threshold BIGINT,
  window_text TEXT,
  message TEXT
) AS $$
DECLARE
  v_webhook_errors_15m BIGINT;
  v_secure_blocked_10m BIGINT;
  v_security_high_10m BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_webhook_errors_15m
  FROM observability_events
  WHERE source = 'edge.payment_webhook'
    AND severity = 'error'
    AND created_at >= p_now - INTERVAL '15 minutes';

  SELECT COUNT(*) INTO v_secure_blocked_10m
  FROM observability_events
  WHERE source = 'edge.get_secure_link'
    AND event_type = 'blocked'
    AND created_at >= p_now - INTERVAL '10 minutes';

  SELECT COUNT(*) INTO v_security_high_10m
  FROM security_logs
  WHERE severity = 'high'
    AND created_at >= p_now - INTERVAL '10 minutes';

  IF v_webhook_errors_15m >= 5 THEN
    RETURN QUERY SELECT
      'webhook_errors_spike'::TEXT,
      'high'::TEXT,
      v_webhook_errors_15m,
      5::BIGINT,
      '15m'::TEXT,
      'Webhook errors increased in last 15 minutes'::TEXT;
  END IF;

  IF v_secure_blocked_10m >= 25 THEN
    RETURN QUERY SELECT
      'secure_link_blocked_spike'::TEXT,
      'medium'::TEXT,
      v_secure_blocked_10m,
      25::BIGINT,
      '10m'::TEXT,
      'Secure-link blocked requests increased in last 10 minutes'::TEXT;
  END IF;

  IF v_security_high_10m >= 8 THEN
    RETURN QUERY SELECT
      'security_high_events_spike'::TEXT,
      'high'::TEXT,
      v_security_high_10m,
      8::BIGINT,
      '10m'::TEXT,
      'High severity security events increased in last 10 minutes'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.check_observability_alerts(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_observability_alerts(TIMESTAMPTZ) TO service_role;

-- Webhook idempotency (P3)
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  request_id TEXT,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  error_message TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_provider_event ON webhook_events(provider, event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status_seen ON webhook_events(status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_seen ON webhook_events(provider, last_seen_at DESC);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can view webhook events" ON webhook_events;
CREATE POLICY "Admin can view webhook events"
  ON webhook_events FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));

CREATE OR REPLACE FUNCTION public.register_webhook_event(
  p_provider TEXT,
  p_event_id TEXT,
  p_payload_hash TEXT,
  p_request_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  should_process BOOLEAN,
  current_status TEXT
) AS $$
DECLARE
  v_status TEXT;
  v_hash TEXT;
  v_rows INT;
BEGIN
  IF p_provider IS NULL OR p_provider = '' OR p_event_id IS NULL OR p_event_id = '' THEN
    RAISE EXCEPTION 'provider and event_id are required';
  END IF;

  INSERT INTO webhook_events (provider, event_id, request_id, payload_hash, status)
  VALUES (p_provider, p_event_id, p_request_id, p_payload_hash, 'received')
  ON CONFLICT (provider, event_id)
  DO UPDATE SET
    last_seen_at = NOW(),
    request_id = COALESCE(EXCLUDED.request_id, webhook_events.request_id);

  SELECT status, payload_hash INTO v_status, v_hash
  FROM webhook_events
  WHERE provider = p_provider AND event_id = p_event_id
  FOR UPDATE;

  IF v_hash IS DISTINCT FROM p_payload_hash THEN
    UPDATE webhook_events
    SET status = 'error', error_message = 'payload_hash_mismatch', last_seen_at = NOW()
    WHERE provider = p_provider AND event_id = p_event_id;
    RETURN QUERY SELECT false, 'hash_mismatch'::TEXT;
    RETURN;
  END IF;

  IF v_status IN ('processed', 'ignored') THEN
    RETURN QUERY SELECT false, v_status;
    RETURN;
  END IF;

  UPDATE webhook_events
  SET status = 'processing', error_message = NULL, last_seen_at = NOW()
  WHERE provider = p_provider AND event_id = p_event_id
    AND status IN ('received', 'error');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 1 THEN
    RETURN QUERY SELECT true, 'processing'::TEXT;
  ELSE
    RETURN QUERY SELECT false, 'processing'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.complete_webhook_event(
  p_provider TEXT,
  p_event_id TEXT,
  p_status TEXT,
  p_order_id UUID DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE webhook_events
  SET
    status = p_status,
    order_id = COALESCE(p_order_id, order_id),
    error_message = p_error_message,
    processed_at = CASE WHEN p_status IN ('processed', 'ignored') THEN NOW() ELSE processed_at END,
    last_seen_at = NOW()
  WHERE provider = p_provider
    AND event_id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.register_webhook_event(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_webhook_event(TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_webhook_event(TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_webhook_event(TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;

-- Capacity planning (P3.5)
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
LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_name IN (
    'access_logs','security_logs','observability_events','webhook_events','orders','order_items','permissions'
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

-- Ops automation (maintenance runner + optional pg_cron bootstrap)
CREATE TABLE IF NOT EXISTS backend_maintenance_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  triggered_by TEXT NOT NULL DEFAULT 'manual',
  success BOOLEAN NOT NULL DEFAULT false,
  alerts_count INT NOT NULL DEFAULT 0,
  access_deleted BIGINT NOT NULL DEFAULT 0,
  security_deleted BIGINT NOT NULL DEFAULT 0,
  observability_deleted BIGINT NOT NULL DEFAULT 0,
  webhook_deleted BIGINT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_backend_maintenance_runs_started
  ON backend_maintenance_runs(started_at DESC);

ALTER TABLE backend_maintenance_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can view backend maintenance runs" ON backend_maintenance_runs;
CREATE POLICY "Admin can view backend maintenance runs"
  ON backend_maintenance_runs FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));

CREATE OR REPLACE FUNCTION public.run_backend_maintenance(
  p_triggered_by TEXT DEFAULT 'manual',
  p_access_logs_keep INTERVAL DEFAULT INTERVAL '90 days',
  p_security_logs_keep INTERVAL DEFAULT INTERVAL '180 days',
  p_observability_keep INTERVAL DEFAULT INTERVAL '30 days',
  p_webhook_keep INTERVAL DEFAULT INTERVAL '90 days'
)
RETURNS TABLE (
  run_id UUID,
  alerts_count INT,
  access_deleted BIGINT,
  security_deleted BIGINT,
  observability_deleted BIGINT,
  webhook_deleted BIGINT
) AS $$
DECLARE
  v_run_id UUID;
  v_access BIGINT := 0;
  v_security BIGINT := 0;
  v_observability BIGINT := 0;
  v_webhook BIGINT := 0;
  v_alerts INT := 0;
  v_alert_rows JSONB := '[]'::jsonb;
BEGIN
  INSERT INTO backend_maintenance_runs (triggered_by)
  VALUES (COALESCE(NULLIF(p_triggered_by, ''), 'manual'))
  RETURNING id INTO v_run_id;

  SELECT c.access_deleted, c.security_deleted
  INTO v_access, v_security
  FROM public.cleanup_old_logs(p_access_logs_keep, p_security_logs_keep) c;

  SELECT c.observability_deleted, c.webhook_deleted
  INTO v_observability, v_webhook
  FROM public.cleanup_observability_history(p_observability_keep, p_webhook_keep) c;

  SELECT COUNT(*), COALESCE(jsonb_agg(row_to_json(a)), '[]'::jsonb)
  INTO v_alerts, v_alert_rows
  FROM public.check_observability_alerts() a;

  UPDATE backend_maintenance_runs
  SET
    finished_at = NOW(),
    success = true,
    alerts_count = v_alerts,
    access_deleted = v_access,
    security_deleted = v_security,
    observability_deleted = v_observability,
    webhook_deleted = v_webhook,
    details = jsonb_build_object(
      'alerts', v_alert_rows,
      'retention', jsonb_build_object(
        'access_logs_keep', p_access_logs_keep::TEXT,
        'security_logs_keep', p_security_logs_keep::TEXT,
        'observability_keep', p_observability_keep::TEXT,
        'webhook_keep', p_webhook_keep::TEXT
      )
    )
  WHERE id = v_run_id;

  INSERT INTO observability_events (
    source, event_type, severity, status_code, metadata
  ) VALUES (
    'db.maintenance',
    'maintenance_completed',
    CASE WHEN v_alerts > 0 THEN 'warn' ELSE 'info' END,
    200,
    jsonb_build_object(
      'run_id', v_run_id,
      'alerts_count', v_alerts,
      'access_deleted', v_access,
      'security_deleted', v_security,
      'observability_deleted', v_observability,
      'webhook_deleted', v_webhook
    )
  );

  RETURN QUERY SELECT v_run_id, v_alerts, v_access, v_security, v_observability, v_webhook;
EXCEPTION WHEN OTHERS THEN
  UPDATE backend_maintenance_runs
  SET
    finished_at = NOW(),
    success = false,
    details = jsonb_build_object('error', SQLERRM)
  WHERE id = v_run_id;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.ensure_backend_cron_jobs()
RETURNS TABLE (
  job_name TEXT,
  status TEXT,
  detail TEXT
) AS $$
DECLARE
  v_has_pg_cron BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'cron'
  ) INTO v_has_pg_cron;

  IF NOT v_has_pg_cron THEN
    RETURN QUERY SELECT 'doc2share:maintenance_hourly'::TEXT, 'skipped'::TEXT, 'cron schema not available; use external scheduler'::TEXT;
    RETURN QUERY SELECT 'doc2share:alerts_10m'::TEXT, 'skipped'::TEXT, 'cron schema not available; use external scheduler'::TEXT;
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN ('doc2share:maintenance_hourly', 'doc2share:alerts_10m');

  PERFORM cron.schedule(
    'doc2share:maintenance_hourly',
    '5 * * * *',
    $job$SELECT public.run_backend_maintenance('cron');$job$
  );

  PERFORM cron.schedule(
    'doc2share:alerts_10m',
    '*/10 * * * *',
    $job$INSERT INTO observability_events (source, event_type, severity, status_code, metadata)
      SELECT
        'db.alerts',
        'alert_check',
        CASE WHEN COUNT(*) > 0 THEN 'warn' ELSE 'info' END,
        200,
        jsonb_build_object('alerts', COALESCE(jsonb_agg(row_to_json(a)), '[]'::jsonb))
      FROM public.check_observability_alerts() a;$job$
  );

  RETURN QUERY SELECT 'doc2share:maintenance_hourly'::TEXT, 'scheduled'::TEXT, 'runs hourly at minute 5'::TEXT;
  RETURN QUERY SELECT 'doc2share:alerts_10m'::TEXT, 'scheduled'::TEXT, 'runs every 10 minutes'::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 'doc2share:maintenance_hourly'::TEXT, 'error'::TEXT, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.run_backend_maintenance(TEXT, INTERVAL, INTERVAL, INTERVAL, INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_backend_cron_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_backend_maintenance(TEXT, INTERVAL, INTERVAL, INTERVAL, INTERVAL) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_backend_cron_jobs() TO service_role;

-- Documents 2-phase upload + trusted-only CRUD + async post-process queue
CREATE TABLE IF NOT EXISTS document_upload_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  idempotency_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subject_id INT REFERENCES categories(id) ON DELETE SET NULL,
  grade_id INT REFERENCES categories(id) ON DELETE SET NULL,
  exam_id INT REFERENCES categories(id) ON DELETE SET NULL,
  is_downloadable BOOLEAN NOT NULL DEFAULT false,
  main_file_path TEXT NOT NULL,
  cover_file_path TEXT NOT NULL,
  preview_file_path TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  error_message TEXT,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_upload_sessions_status_check') THEN
    ALTER TABLE document_upload_sessions
      ADD CONSTRAINT document_upload_sessions_status_check
      CHECK (status IN ('uploaded', 'finalized', 'failed', 'aborted'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_document_upload_sessions_creator_idempotency
  ON document_upload_sessions(created_by, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_upload_sessions_status_created
  ON document_upload_sessions(status, created_at DESC);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS upload_session_id UUID REFERENCES document_upload_sessions(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_status_check') THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_status_check
      CHECK (status IN ('draft', 'processing', 'ready', 'failed', 'archived', 'deleted'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS document_processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  upload_session_id UUID REFERENCES document_upload_sessions(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL DEFAULT 'document_postprocess',
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, job_type)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_processing_jobs_status_check') THEN
    ALTER TABLE document_processing_jobs
      ADD CONSTRAINT document_processing_jobs_status_check
      CHECK (status IN ('queued', 'processing', 'done', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_status_run_after
  ON document_processing_jobs(status, run_after, created_at);

ALTER TABLE document_upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_processing_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can view document upload sessions" ON document_upload_sessions;
CREATE POLICY "Admin can view document upload sessions"
  ON document_upload_sessions FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));
DROP POLICY IF EXISTS "Admin can view document processing jobs" ON document_processing_jobs;
CREATE POLICY "Admin can view document processing jobs"
  ON document_processing_jobs FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

CREATE OR REPLACE FUNCTION public.create_document_upload_session(
  p_created_by UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_price NUMERIC DEFAULT 0,
  p_subject_id INT DEFAULT NULL,
  p_grade_id INT DEFAULT NULL,
  p_exam_id INT DEFAULT NULL,
  p_is_downloadable BOOLEAN DEFAULT false,
  p_main_file_path TEXT DEFAULT NULL,
  p_cover_file_path TEXT DEFAULT NULL,
  p_preview_file_path TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (session_id UUID, already_exists BOOLEAN) AS $$
DECLARE
  v_session_id UUID;
BEGIN
  IF p_title IS NULL OR trim(p_title) = '' THEN RAISE EXCEPTION 'title is required'; END IF;
  IF p_main_file_path IS NULL OR trim(p_main_file_path) = '' THEN RAISE EXCEPTION 'main_file_path is required'; END IF;
  IF p_cover_file_path IS NULL OR trim(p_cover_file_path) = '' THEN RAISE EXCEPTION 'cover_file_path is required'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_session_id
    FROM document_upload_sessions
    WHERE created_by IS NOT DISTINCT FROM p_created_by
      AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF v_session_id IS NOT NULL THEN
      RETURN QUERY SELECT v_session_id, true;
      RETURN;
    END IF;
  END IF;

  INSERT INTO document_upload_sessions (
    created_by, idempotency_key, title, description, price,
    subject_id, grade_id, exam_id, is_downloadable,
    main_file_path, cover_file_path, preview_file_path, status
  ) VALUES (
    p_created_by, p_idempotency_key, p_title, p_description, COALESCE(p_price, 0),
    p_subject_id, p_grade_id, p_exam_id, COALESCE(p_is_downloadable, false),
    p_main_file_path, p_cover_file_path, p_preview_file_path, 'uploaded'
  )
  RETURNING id INTO v_session_id;

  RETURN QUERY SELECT v_session_id, false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.create_document_from_upload_session(
  p_session_id UUID
)
RETURNS TABLE (document_id UUID, job_id UUID, already_finalized BOOLEAN) AS $$
DECLARE
  v_session document_upload_sessions%ROWTYPE;
  v_document_id UUID;
  v_job_id UUID;
BEGIN
  SELECT * INTO v_session FROM document_upload_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'upload session not found'; END IF;

  IF v_session.status = 'finalized' THEN
    SELECT d.id INTO v_document_id
    FROM documents d
    WHERE d.upload_session_id = v_session.id
    ORDER BY d.created_at DESC
    LIMIT 1;
    SELECT j.id INTO v_job_id FROM document_processing_jobs j WHERE j.document_id = v_document_id AND j.job_type = 'document_postprocess' LIMIT 1;
    RETURN QUERY SELECT v_document_id, v_job_id, true;
    RETURN;
  END IF;

  INSERT INTO documents (
    title, description, price, file_path, preview_url, preview_text,
    subject_id, grade_id, exam_id, is_downloadable, thumbnail_url, status, upload_session_id
  ) VALUES (
    v_session.title, v_session.description, v_session.price, v_session.main_file_path, v_session.preview_file_path, NULL,
    v_session.subject_id, v_session.grade_id, v_session.exam_id, v_session.is_downloadable, v_session.cover_file_path, 'processing', v_session.id
  )
  RETURNING id INTO v_document_id;

  INSERT INTO document_processing_jobs (document_id, upload_session_id, job_type, status, run_after)
  VALUES (v_document_id, v_session.id, 'document_postprocess', 'queued', NOW())
  ON CONFLICT ON CONSTRAINT document_processing_jobs_document_id_job_type_key DO NOTHING
  RETURNING id INTO v_job_id;

  IF v_job_id IS NULL THEN
    SELECT j.id INTO v_job_id FROM document_processing_jobs j WHERE j.document_id = v_document_id AND j.job_type = 'document_postprocess' LIMIT 1;
  END IF;

  UPDATE document_upload_sessions
  SET status = 'finalized', finalized_at = NOW(), error_message = NULL
  WHERE id = v_session.id;

  RETURN QUERY SELECT v_document_id, v_job_id, false;
EXCEPTION WHEN OTHERS THEN
  UPDATE document_upload_sessions SET status = 'failed', error_message = SQLERRM WHERE id = p_session_id;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_document_admin(
  p_document_id UUID,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_price NUMERIC DEFAULT NULL,
  p_subject_id INT DEFAULT NULL,
  p_grade_id INT DEFAULT NULL,
  p_exam_id INT DEFAULT NULL,
  p_is_downloadable BOOLEAN DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (updated BOOLEAN) AS $$
DECLARE
  v_rows INT;
BEGIN
  IF p_status IS NOT NULL AND p_status NOT IN ('draft','processing','ready','failed','archived','deleted') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE documents
  SET
    title = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    price = COALESCE(p_price, price),
    subject_id = COALESCE(p_subject_id, subject_id),
    grade_id = COALESCE(p_grade_id, grade_id),
    exam_id = COALESCE(p_exam_id, exam_id),
    is_downloadable = COALESCE(p_is_downloadable, is_downloadable),
    status = COALESCE(p_status, status),
    updated_at = NOW()
  WHERE id = p_document_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.delete_document_admin(
  p_document_id UUID,
  p_hard_delete BOOLEAN DEFAULT false
)
RETURNS TABLE (deleted BOOLEAN) AS $$
DECLARE
  v_rows INT;
BEGIN
  IF COALESCE(p_hard_delete, false) THEN
    DELETE FROM documents WHERE id = p_document_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN QUERY SELECT (v_rows > 0);
    RETURN;
  END IF;

  UPDATE documents
  SET status = 'deleted', is_downloadable = false, updated_at = NOW()
  WHERE id = p_document_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.claim_document_processing_jobs(
  p_limit INT DEFAULT 10
)
RETURNS TABLE (job_id UUID, document_id UUID, upload_session_id UUID, attempts INT, job_type TEXT) AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM document_processing_jobs j
    WHERE j.status IN ('queued', 'failed')
      AND j.run_after <= NOW()
    ORDER BY j.run_after ASC, j.created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 100))
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE document_processing_jobs j
    SET status = 'processing', attempts = j.attempts + 1, updated_at = NOW()
    FROM candidates c
    WHERE j.id = c.id
    RETURNING j.id, j.document_id, j.upload_session_id, j.attempts, j.job_type
  )
  SELECT claimed.id, claimed.document_id, claimed.upload_session_id, claimed.attempts, claimed.job_type
  FROM claimed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.complete_document_processing_job(
  p_job_id UUID,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL,
  p_mark_document_ready BOOLEAN DEFAULT true,
  p_retry_delay_seconds INT DEFAULT 120
)
RETURNS VOID AS $$
DECLARE
  v_document_id UUID;
BEGIN
  SELECT document_id INTO v_document_id FROM document_processing_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF COALESCE(p_success, false) THEN
    UPDATE document_processing_jobs
    SET status = 'done', last_error = NULL, updated_at = NOW()
    WHERE id = p_job_id;
    IF COALESCE(p_mark_document_ready, true) THEN
      UPDATE documents SET status = 'ready', updated_at = NOW() WHERE id = v_document_id AND status <> 'deleted';
    END IF;
    RETURN;
  END IF;

  UPDATE document_processing_jobs
  SET
    status = 'failed',
    last_error = p_error,
    run_after = NOW() + make_interval(secs => GREATEST(COALESCE(p_retry_delay_seconds, 120), 30)),
    updated_at = NOW()
  WHERE id = p_job_id;

  UPDATE documents
  SET status = 'failed', updated_at = NOW()
  WHERE id = v_document_id
    AND status <> 'deleted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_document_upload_session(UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_document_from_upload_session(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_document_admin(UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_document_admin(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_document_processing_jobs(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_document_processing_job(UUID, BOOLEAN, TEXT, BOOLEAN, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_document_upload_session(UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_document_from_upload_session(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_document_admin(UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_document_admin(UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_document_processing_jobs(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_document_processing_job(UUID, BOOLEAN, TEXT, BOOLEAN, INT) TO service_role;

-- Document versions + admin rollback
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_no INT NOT NULL,
  snapshot JSONB NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, version_no)
);
CREATE INDEX IF NOT EXISTS idx_document_versions_doc_created
  ON document_versions(document_id, created_at DESC);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can view document versions" ON document_versions;
CREATE POLICY "Admin can view document versions"
  ON document_versions FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

CREATE OR REPLACE FUNCTION public.create_document_version_snapshot(
  p_document_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (version_id UUID, version_no INT) AS $$
DECLARE
  v_doc documents%ROWTYPE;
  v_next_version INT;
  v_version_id UUID;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'document not found'; END IF;

  SELECT COALESCE(MAX(dv.version_no), 0) + 1 INTO v_next_version
  FROM document_versions dv
  WHERE dv.document_id = p_document_id;

  INSERT INTO document_versions (document_id, version_no, snapshot, reason, created_by)
  VALUES (
    p_document_id,
    v_next_version,
    jsonb_build_object(
      'title', v_doc.title,
      'description', v_doc.description,
      'price', v_doc.price,
      'file_path', v_doc.file_path,
      'preview_url', v_doc.preview_url,
      'preview_text', v_doc.preview_text,
      'thumbnail_url', v_doc.thumbnail_url,
      'subject_id', v_doc.subject_id,
      'grade_id', v_doc.grade_id,
      'exam_id', v_doc.exam_id,
      'is_downloadable', v_doc.is_downloadable,
      'status', v_doc.status
    ),
    p_reason,
    p_created_by
  )
  RETURNING id INTO v_version_id;

  RETURN QUERY SELECT v_version_id, v_next_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.rollback_document_to_version(
  p_document_id UUID,
  p_version_id UUID,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (rolled_back BOOLEAN, restored_from_version INT, new_version_id UUID) AS $$
DECLARE
  v_snapshot JSONB;
  v_version_no INT;
  v_rows INT;
  v_new_version_id UUID;
BEGIN
  SELECT dv.snapshot, dv.version_no
  INTO v_snapshot, v_version_no
  FROM document_versions dv
  WHERE dv.id = p_version_id
    AND dv.document_id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::INT, NULL::UUID;
    RETURN;
  END IF;

  SELECT version_id INTO v_new_version_id
  FROM public.create_document_version_snapshot(
    p_document_id,
    format('rollback_backup_from_v%s', v_version_no),
    p_created_by
  );

  UPDATE documents
  SET
    title = v_snapshot->>'title',
    description = NULLIF(v_snapshot->>'description', ''),
    price = COALESCE((v_snapshot->>'price')::NUMERIC, price),
    file_path = v_snapshot->>'file_path',
    preview_url = NULLIF(v_snapshot->>'preview_url', ''),
    preview_text = NULLIF(v_snapshot->>'preview_text', ''),
    thumbnail_url = NULLIF(v_snapshot->>'thumbnail_url', ''),
    subject_id = CASE WHEN (v_snapshot ? 'subject_id') AND v_snapshot->>'subject_id' <> '' THEN (v_snapshot->>'subject_id')::INT ELSE NULL END,
    grade_id = CASE WHEN (v_snapshot ? 'grade_id') AND v_snapshot->>'grade_id' <> '' THEN (v_snapshot->>'grade_id')::INT ELSE NULL END,
    exam_id = CASE WHEN (v_snapshot ? 'exam_id') AND v_snapshot->>'exam_id' <> '' THEN (v_snapshot->>'exam_id')::INT ELSE NULL END,
    is_downloadable = COALESCE((v_snapshot->>'is_downloadable')::BOOLEAN, false),
    status = COALESCE(NULLIF(v_snapshot->>'status', ''), 'ready'),
    updated_at = NOW()
  WHERE id = p_document_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0), v_version_no, v_new_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_document_admin(
  p_document_id UUID,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_price NUMERIC DEFAULT NULL,
  p_subject_id INT DEFAULT NULL,
  p_grade_id INT DEFAULT NULL,
  p_exam_id INT DEFAULT NULL,
  p_is_downloadable BOOLEAN DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (updated BOOLEAN) AS $$
DECLARE
  v_rows INT;
BEGIN
  IF p_status IS NOT NULL AND p_status NOT IN ('draft', 'processing', 'ready', 'failed', 'archived', 'deleted') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  PERFORM public.create_document_version_snapshot(p_document_id, 'admin_update', NULL);

  UPDATE documents
  SET
    title = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    price = COALESCE(p_price, price),
    subject_id = COALESCE(p_subject_id, subject_id),
    grade_id = COALESCE(p_grade_id, grade_id),
    exam_id = COALESCE(p_exam_id, exam_id),
    is_downloadable = COALESCE(p_is_downloadable, is_downloadable),
    status = COALESCE(p_status, status),
    updated_at = NOW()
  WHERE id = p_document_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.delete_document_admin(
  p_document_id UUID,
  p_hard_delete BOOLEAN DEFAULT false
)
RETURNS TABLE (deleted BOOLEAN) AS $$
DECLARE
  v_rows INT;
BEGIN
  PERFORM public.create_document_version_snapshot(
    p_document_id,
    CASE WHEN COALESCE(p_hard_delete, false) THEN 'admin_hard_delete' ELSE 'admin_soft_delete' END,
    NULL
  );

  IF COALESCE(p_hard_delete, false) THEN
    DELETE FROM documents WHERE id = p_document_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN QUERY SELECT (v_rows > 0);
    RETURN;
  END IF;

  UPDATE documents
  SET status = 'deleted', is_downloadable = false, updated_at = NOW()
  WHERE id = p_document_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_document_version_snapshot(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_document_to_version(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_document_admin(UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_document_admin(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_document_version_snapshot(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rollback_document_to_version(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_document_admin(UUID, TEXT, TEXT, NUMERIC, INT, INT, INT, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_document_admin(UUID, BOOLEAN) TO service_role;

-- Document lifecycle ops: orphan cleanup + cron + pipeline metrics/alerts
CREATE OR REPLACE FUNCTION public.extract_public_asset_path(p_url TEXT)
RETURNS TEXT AS $$
DECLARE
  v TEXT;
BEGIN
  IF p_url IS NULL OR btrim(p_url) = '' THEN RETURN NULL; END IF;
  IF p_url !~ '/object/public/public_assets/' THEN RETURN p_url; END IF;
  v := regexp_replace(p_url, '^.*?/object/public/public_assets/', '');
  v := split_part(v, '?', 1);
  RETURN NULLIF(v, '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.cleanup_orphan_document_assets(
  p_grace INTERVAL DEFAULT INTERVAL '48 hours',
  p_limit INT DEFAULT 500
)
RETURNS TABLE (private_deleted BIGINT, public_deleted BIGINT) AS $$
DECLARE
  v_private BIGINT := 0;
  v_public BIGINT := 0;
BEGIN
  WITH referenced_private AS (
    SELECT file_path AS object_name
    FROM documents
    WHERE file_path IS NOT NULL AND file_path <> ''
    UNION
    SELECT main_file_path
    FROM document_upload_sessions
    WHERE main_file_path IS NOT NULL AND main_file_path <> ''
      AND status IN ('uploaded', 'finalized')
  ),
  candidates_private AS (
    SELECT o.id
    FROM storage.objects o
    LEFT JOIN referenced_private rp ON rp.object_name = o.name
    WHERE o.bucket_id = 'private_documents'
      AND o.created_at < NOW() - p_grace
      AND rp.object_name IS NULL
    ORDER BY o.created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 5000))
  ),
  del_private AS (
    DELETE FROM storage.objects o
    USING candidates_private c
    WHERE o.id = c.id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_private FROM del_private;

  WITH referenced_public AS (
    SELECT public.extract_public_asset_path(thumbnail_url) AS object_name
    FROM documents
    WHERE thumbnail_url IS NOT NULL AND thumbnail_url <> ''
    UNION
    SELECT public.extract_public_asset_path(preview_url)
    FROM documents
    WHERE preview_url IS NOT NULL AND preview_url <> ''
    UNION
    SELECT public.extract_public_asset_path(cover_file_path)
    FROM document_upload_sessions
    WHERE cover_file_path IS NOT NULL AND cover_file_path <> ''
      AND status IN ('uploaded', 'finalized')
    UNION
    SELECT public.extract_public_asset_path(preview_file_path)
    FROM document_upload_sessions
    WHERE preview_file_path IS NOT NULL AND preview_file_path <> ''
      AND status IN ('uploaded', 'finalized')
  ),
  candidates_public AS (
    SELECT o.id
    FROM storage.objects o
    LEFT JOIN referenced_public rp ON rp.object_name = o.name
    WHERE o.bucket_id = 'public_assets'
      AND o.created_at < NOW() - p_grace
      AND rp.object_name IS NULL
    ORDER BY o.created_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 5000))
  ),
  del_public AS (
    DELETE FROM storage.objects o
    USING candidates_public c
    WHERE o.id = c.id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_public FROM del_public;

  INSERT INTO observability_events (source, event_type, severity, status_code, metadata)
  VALUES (
    'db.document_lifecycle',
    'orphan_cleanup',
    CASE WHEN v_private + v_public > 0 THEN 'info' ELSE 'warn' END,
    200,
    jsonb_build_object(
      'private_deleted', v_private,
      'public_deleted', v_public,
      'grace', p_grace::TEXT,
      'limit', p_limit
    )
  );

  RETURN QUERY SELECT v_private, v_public;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.run_document_pipeline_tick(
  p_limit INT DEFAULT 20
)
RETURNS TABLE (claimed BIGINT, completed BIGINT, failed BIGINT) AS $$
DECLARE
  v_claimed BIGINT := 0;
  v_completed BIGINT := 0;
  v_failed BIGINT := 0;
  v_job RECORD;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS tmp_claimed_jobs(
    job_id UUID,
    document_id UUID,
    upload_session_id UUID,
    attempts INT,
    job_type TEXT
  ) ON COMMIT DROP;
  TRUNCATE TABLE tmp_claimed_jobs;

  INSERT INTO tmp_claimed_jobs (job_id, document_id, upload_session_id, attempts, job_type)
  SELECT * FROM public.claim_document_processing_jobs(p_limit);
  SELECT COUNT(*) INTO v_claimed FROM tmp_claimed_jobs;

  FOR v_job IN SELECT * FROM tmp_claimed_jobs LOOP
    BEGIN
      PERFORM public.complete_document_processing_job(v_job.job_id, true, NULL, true, 120);
      v_completed := v_completed + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.complete_document_processing_job(v_job.job_id, false, SQLERRM, false, 120);
      v_failed := v_failed + 1;
    END;
  END LOOP;

  INSERT INTO observability_events (source, event_type, severity, status_code, metadata)
  VALUES (
    'db.document_lifecycle',
    'pipeline_tick',
    CASE WHEN v_failed > 0 THEN 'warn' ELSE 'info' END,
    200,
    jsonb_build_object('claimed', v_claimed, 'completed', v_completed, 'failed', v_failed)
  );

  RETURN QUERY SELECT v_claimed, v_completed, v_failed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE VIEW document_lifecycle_metrics_24h AS
WITH jobs AS (
  SELECT * FROM document_processing_jobs
  WHERE created_at >= NOW() - INTERVAL '24 hours'
),
events AS (
  SELECT * FROM observability_events
  WHERE created_at >= NOW() - INTERVAL '24 hours'
)
SELECT
  (SELECT COUNT(*) FROM document_processing_jobs WHERE status = 'queued') AS queued_now,
  (SELECT COUNT(*) FROM document_processing_jobs WHERE status = 'processing') AS processing_now,
  (SELECT COUNT(*) FROM document_processing_jobs WHERE status = 'failed') AS failed_now,
  (SELECT COUNT(*) FROM jobs WHERE status = 'done') AS jobs_done_24h,
  (SELECT COUNT(*) FROM jobs WHERE status = 'failed') AS jobs_failed_24h,
  (SELECT COUNT(*) FROM events WHERE source = 'db.document_lifecycle' AND event_type = 'pipeline_tick') AS pipeline_ticks_24h,
  (SELECT COUNT(*) FROM events WHERE source = 'db.document_lifecycle' AND event_type = 'orphan_cleanup') AS orphan_cleanup_runs_24h,
  (SELECT COALESCE(SUM((metadata->>'private_deleted')::BIGINT), 0) FROM events WHERE source = 'db.document_lifecycle' AND event_type = 'orphan_cleanup') AS orphan_private_deleted_24h,
  (SELECT COALESCE(SUM((metadata->>'public_deleted')::BIGINT), 0) FROM events WHERE source = 'db.document_lifecycle' AND event_type = 'orphan_cleanup') AS orphan_public_deleted_24h;

CREATE OR REPLACE FUNCTION public.check_observability_alerts(
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  alert_key TEXT,
  alert_level TEXT,
  metric_value BIGINT,
  threshold BIGINT,
  window_text TEXT,
  message TEXT
) AS $$
DECLARE
  v_webhook_errors_15m BIGINT;
  v_secure_blocked_10m BIGINT;
  v_security_high_10m BIGINT;
  v_pipeline_failed_30m BIGINT;
  v_pipeline_backlog BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_webhook_errors_15m
  FROM observability_events
  WHERE source = 'edge.payment_webhook'
    AND severity = 'error'
    AND created_at >= p_now - INTERVAL '15 minutes';

  SELECT COUNT(*) INTO v_secure_blocked_10m
  FROM observability_events
  WHERE source = 'edge.get_secure_link'
    AND event_type = 'blocked'
    AND created_at >= p_now - INTERVAL '10 minutes';

  SELECT COUNT(*) INTO v_security_high_10m
  FROM security_logs
  WHERE severity = 'high'
    AND created_at >= p_now - INTERVAL '10 minutes';

  SELECT COUNT(*) INTO v_pipeline_failed_30m
  FROM document_processing_jobs
  WHERE status = 'failed'
    AND updated_at >= p_now - INTERVAL '30 minutes';

  SELECT COUNT(*) INTO v_pipeline_backlog
  FROM document_processing_jobs
  WHERE status IN ('queued', 'processing');

  IF v_webhook_errors_15m >= 5 THEN
    RETURN QUERY SELECT 'webhook_errors_spike'::TEXT, 'high'::TEXT, v_webhook_errors_15m, 5::BIGINT, '15m'::TEXT, 'Webhook errors increased in last 15 minutes'::TEXT;
  END IF;
  IF v_secure_blocked_10m >= 25 THEN
    RETURN QUERY SELECT 'secure_link_blocked_spike'::TEXT, 'medium'::TEXT, v_secure_blocked_10m, 25::BIGINT, '10m'::TEXT, 'Secure-link blocked requests increased in last 10 minutes'::TEXT;
  END IF;
  IF v_security_high_10m >= 8 THEN
    RETURN QUERY SELECT 'security_high_events_spike'::TEXT, 'high'::TEXT, v_security_high_10m, 8::BIGINT, '10m'::TEXT, 'High severity security events increased in last 10 minutes'::TEXT;
  END IF;
  IF v_pipeline_failed_30m >= 10 THEN
    RETURN QUERY SELECT 'document_pipeline_failed_spike'::TEXT, 'high'::TEXT, v_pipeline_failed_30m, 10::BIGINT, '30m'::TEXT, 'Document processing failed jobs increased in last 30 minutes'::TEXT;
  END IF;
  IF v_pipeline_backlog >= 200 THEN
    RETURN QUERY SELECT 'document_pipeline_backlog_high'::TEXT, 'medium'::TEXT, v_pipeline_backlog, 200::BIGINT, 'now'::TEXT, 'Document processing backlog is high (queued + processing)'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.ensure_backend_cron_jobs()
RETURNS TABLE (
  job_name TEXT,
  status TEXT,
  detail TEXT
) AS $$
DECLARE
  v_has_pg_cron BOOLEAN := false;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') INTO v_has_pg_cron;
  IF NOT v_has_pg_cron THEN
    RETURN QUERY SELECT 'doc2share:maintenance_hourly'::TEXT, 'skipped'::TEXT, 'cron schema not available; use external scheduler'::TEXT;
    RETURN QUERY SELECT 'doc2share:alerts_10m'::TEXT, 'skipped'::TEXT, 'cron schema not available; use external scheduler'::TEXT;
    RETURN QUERY SELECT 'doc2share:document_pipeline_5m'::TEXT, 'skipped'::TEXT, 'cron schema not available; use external scheduler'::TEXT;
    RETURN QUERY SELECT 'doc2share:orphan_cleanup_daily'::TEXT, 'skipped'::TEXT, 'cron schema not available; use external scheduler'::TEXT;
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN ('doc2share:maintenance_hourly', 'doc2share:alerts_10m', 'doc2share:document_pipeline_5m', 'doc2share:orphan_cleanup_daily');

  PERFORM cron.schedule('doc2share:maintenance_hourly', '5 * * * *', $job$SELECT public.run_backend_maintenance('cron');$job$);
  PERFORM cron.schedule('doc2share:alerts_10m', '*/10 * * * *', $job$INSERT INTO observability_events (source, event_type, severity, status_code, metadata)
      SELECT 'db.alerts', 'alert_check', CASE WHEN COUNT(*) > 0 THEN 'warn' ELSE 'info' END, 200, jsonb_build_object('alerts', COALESCE(jsonb_agg(row_to_json(a)), '[]'::jsonb))
      FROM public.check_observability_alerts() a;$job$);
  PERFORM cron.schedule('doc2share:document_pipeline_5m', '*/5 * * * *', $job$SELECT public.run_document_pipeline_tick(25);$job$);
  PERFORM cron.schedule('doc2share:orphan_cleanup_daily', '25 2 * * *', $job$SELECT public.cleanup_orphan_document_assets(INTERVAL '48 hours', 2000);$job$);

  RETURN QUERY SELECT 'doc2share:maintenance_hourly'::TEXT, 'scheduled'::TEXT, 'runs hourly at minute 5'::TEXT;
  RETURN QUERY SELECT 'doc2share:alerts_10m'::TEXT, 'scheduled'::TEXT, 'runs every 10 minutes'::TEXT;
  RETURN QUERY SELECT 'doc2share:document_pipeline_5m'::TEXT, 'scheduled'::TEXT, 'runs every 5 minutes'::TEXT;
  RETURN QUERY SELECT 'doc2share:orphan_cleanup_daily'::TEXT, 'scheduled'::TEXT, 'runs daily at 02:25'::TEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 'doc2share:maintenance_hourly'::TEXT, 'error'::TEXT, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.cleanup_orphan_document_assets(INTERVAL, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_document_pipeline_tick(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.extract_public_asset_path(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_orphan_document_assets(INTERVAL, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_document_pipeline_tick(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.extract_public_asset_path(TEXT) TO service_role;

-- Admin documents query performance
CREATE INDEX IF NOT EXISTS idx_documents_status_created_desc
  ON documents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_status_grade_created
  ON documents(status, grade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_status_subject_created
  ON documents(status, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_status_exam_created
  ON documents(status, exam_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_doc_status_updated
  ON document_processing_jobs(document_id, status, updated_at DESC);

-- P2 + P3: Data quality, revenue guidance, change control and safety
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS quality_score INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS data_quality_status TEXT NOT NULL DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approval_note TEXT,
  ADD COLUMN IF NOT EXISTS approval_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_reviewed_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_quality_score_check') THEN
    ALTER TABLE documents ADD CONSTRAINT documents_quality_score_check CHECK (quality_score >= 0 AND quality_score <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_quality_status_check') THEN
    ALTER TABLE documents ADD CONSTRAINT documents_quality_status_check CHECK (data_quality_status IN ('good', 'review', 'needs_review'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_approval_status_check') THEN
    ALTER TABLE documents ADD CONSTRAINT documents_approval_status_check CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_quality_status_created ON documents(data_quality_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_approval_status_created ON documents(approval_status, created_at DESC);

CREATE TABLE IF NOT EXISTS document_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_audit_logs_doc_created ON document_audit_logs(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_audit_logs_action_created ON document_audit_logs(action, created_at DESC);
ALTER TABLE document_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can view document audit logs" ON document_audit_logs;
CREATE POLICY "Admin can view document audit logs"
  ON document_audit_logs FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

CREATE TABLE IF NOT EXISTS document_edit_locks (
  document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lock_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_edit_locks_expires ON document_edit_locks(expires_at);
ALTER TABLE document_edit_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can view document edit locks" ON document_edit_locks;
CREATE POLICY "Admin can view document edit locks"
  ON document_edit_locks FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

CREATE OR REPLACE FUNCTION public.apply_document_quality_fields()
RETURNS TRIGGER AS $$
DECLARE
  v_score INT := 100;
  v_flags JSONB := '[]'::jsonb;
  v_duplicate_exists BOOLEAN := false;
BEGIN
  IF NEW.title IS NULL OR btrim(NEW.title) = '' THEN v_score := v_score - 30; v_flags := v_flags || '["missing_title"]'::jsonb;
  ELSIF char_length(NEW.title) < 8 THEN v_score := v_score - 10; v_flags := v_flags || '["title_too_short"]'::jsonb; END IF;
  IF NEW.description IS NULL OR btrim(COALESCE(NEW.description, '')) = '' THEN v_score := v_score - 10; v_flags := v_flags || '["missing_description"]'::jsonb; END IF;
  IF NEW.thumbnail_url IS NULL OR btrim(COALESCE(NEW.thumbnail_url, '')) = '' THEN v_score := v_score - 20; v_flags := v_flags || '["missing_thumbnail"]'::jsonb; END IF;
  IF NEW.preview_url IS NULL OR btrim(COALESCE(NEW.preview_url, '')) = '' THEN v_score := v_score - 10; v_flags := v_flags || '["missing_preview"]'::jsonb; END IF;
  IF NEW.price IS NULL OR NEW.price <= 0 THEN v_score := v_score - 20; v_flags := v_flags || '["non_positive_price"]'::jsonb; END IF;
  IF NEW.subject_id IS NULL OR NEW.grade_id IS NULL OR NEW.exam_id IS NULL THEN v_score := v_score - 10; v_flags := v_flags || '["incomplete_category_mapping"]'::jsonb; END IF;
  SELECT EXISTS(SELECT 1 FROM documents d WHERE d.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid) AND lower(d.title)=lower(COALESCE(NEW.title,'')) AND COALESCE(d.status,'') <> 'deleted') INTO v_duplicate_exists;
  IF v_duplicate_exists THEN v_score := v_score - 20; v_flags := v_flags || '["possible_duplicate_title"]'::jsonb; END IF;
  v_score := GREATEST(0, LEAST(100, v_score));
  NEW.quality_score := v_score;
  NEW.quality_flags := v_flags;
  NEW.data_quality_status := CASE WHEN v_score >= 85 THEN 'good' WHEN v_score >= 65 THEN 'review' ELSE 'needs_review' END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_documents_apply_quality ON documents;
CREATE TRIGGER trg_documents_apply_quality
BEFORE INSERT OR UPDATE OF title, description, price, preview_url, thumbnail_url, subject_id, grade_id, exam_id, status
ON documents FOR EACH ROW EXECUTE FUNCTION public.apply_document_quality_fields();

CREATE OR REPLACE FUNCTION public.log_document_audit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO document_audit_logs (document_id, actor_id, action, old_data, new_data, metadata)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    TG_OP::TEXT,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    jsonb_build_object('table', TG_TABLE_NAME)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_documents_audit ON documents;
CREATE TRIGGER trg_documents_audit
AFTER INSERT OR UPDATE OR DELETE ON documents
FOR EACH ROW EXECUTE FUNCTION public.log_document_audit();

CREATE OR REPLACE FUNCTION public.submit_document_for_approval(
  p_document_id UUID,
  p_actor_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE (submitted BOOLEAN) AS $$
DECLARE v_rows INT;
BEGIN
  UPDATE documents
  SET approval_status='pending', approval_note=p_note, approval_requested_by=p_actor_id, approval_requested_at=NOW(),
      approval_reviewed_by=NULL, approval_reviewed_at=NULL, updated_at=NOW()
  WHERE id=p_document_id AND status <> 'deleted';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    INSERT INTO document_audit_logs(document_id, actor_id, action, metadata)
    VALUES (p_document_id, p_actor_id, 'approval_submit', jsonb_build_object('note', p_note));
  END IF;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.approve_document_publish(
  p_document_id UUID,
  p_actor_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE (approved BOOLEAN) AS $$
DECLARE v_rows INT;
BEGIN
  UPDATE documents
  SET approval_status='approved', approval_note=p_note, approval_reviewed_by=p_actor_id, approval_reviewed_at=NOW(),
      status=CASE WHEN status='archived' THEN status ELSE 'ready' END, updated_at=NOW()
  WHERE id=p_document_id AND status <> 'deleted';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    INSERT INTO document_audit_logs(document_id, actor_id, action, metadata)
    VALUES (p_document_id, p_actor_id, 'approval_approve', jsonb_build_object('note', p_note));
  END IF;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reject_document_publish(
  p_document_id UUID,
  p_actor_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE (rejected BOOLEAN) AS $$
DECLARE v_rows INT;
BEGIN
  IF p_note IS NULL OR btrim(p_note) = '' THEN
    RAISE EXCEPTION 'reject note is required';
  END IF;
  UPDATE documents
  SET approval_status='rejected', approval_note=p_note, approval_reviewed_by=p_actor_id, approval_reviewed_at=NOW(),
      status=CASE WHEN status='deleted' THEN status ELSE 'draft' END, updated_at=NOW()
  WHERE id=p_document_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    INSERT INTO document_audit_logs(document_id, actor_id, action, metadata)
    VALUES (p_document_id, p_actor_id, 'approval_reject', jsonb_build_object('note', p_note));
  END IF;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_document_pricing_recommendation(
  p_document_id UUID
)
RETURNS TABLE (suggested_min NUMERIC, suggested_max NUMERIC, suggested_price NUMERIC, basis_count BIGINT) AS $$
DECLARE
  v_subject_id INT;
  v_grade_id INT;
  v_exam_id INT;
BEGIN
  SELECT subject_id, grade_id, exam_id INTO v_subject_id, v_grade_id, v_exam_id FROM documents WHERE id = p_document_id;
  RETURN QUERY
  WITH peers AS (
    SELECT d.price
    FROM documents d
    WHERE d.status IN ('ready','archived')
      AND d.approval_status = 'approved'
      AND d.id <> p_document_id
      AND (v_subject_id IS NULL OR d.subject_id = v_subject_id)
      AND (v_grade_id IS NULL OR d.grade_id = v_grade_id)
      AND (v_exam_id IS NULL OR d.exam_id = v_exam_id)
      AND d.price > 0
  )
  SELECT
    COALESCE(percentile_cont(0.25) WITHIN GROUP (ORDER BY price), 10000)::NUMERIC,
    COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY price), 50000)::NUMERIC,
    COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY price), 30000)::NUMERIC,
    COUNT(*)::BIGINT
  FROM peers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.acquire_document_edit_lock(
  p_document_id UUID,
  p_actor_id UUID,
  p_ttl_seconds INT DEFAULT 300
)
RETURNS TABLE (lock_acquired BOOLEAN, lock_token TEXT) AS $$
DECLARE v_token TEXT := encode(gen_random_bytes(16), 'hex');
BEGIN
  DELETE FROM document_edit_locks WHERE document_id = p_document_id AND expires_at < NOW();
  INSERT INTO document_edit_locks(document_id, locked_by, lock_token, expires_at)
  VALUES (p_document_id, p_actor_id, v_token, NOW() + make_interval(secs => GREATEST(COALESCE(p_ttl_seconds,300),30)))
  ON CONFLICT (document_id) DO NOTHING;
  IF EXISTS (SELECT 1 FROM document_edit_locks WHERE document_id = p_document_id AND lock_token = v_token) THEN
    RETURN QUERY SELECT true, v_token; RETURN;
  END IF;
  RETURN QUERY SELECT false, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.release_document_edit_lock(
  p_document_id UUID,
  p_actor_id UUID,
  p_lock_token TEXT
)
RETURNS TABLE (released BOOLEAN) AS $$
DECLARE v_rows INT;
BEGIN
  DELETE FROM document_edit_locks
  WHERE document_id = p_document_id AND locked_by = p_actor_id AND lock_token = p_lock_token;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.submit_document_for_approval(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_document_publish(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_document_publish(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_document_pricing_recommendation(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acquire_document_edit_lock(UUID, UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_document_edit_lock(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_document_audit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_document_for_approval(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_document_publish(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_document_publish(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_document_pricing_recommendation(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_document_edit_lock(UUID, UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_document_edit_lock(UUID, UUID, TEXT) TO service_role;

-- Tạo profile cho user đã có trong auth.users (trigger chỉ chạy khi đăng ký mới)
INSERT INTO public.profiles (id, full_name, role)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email), 'student'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ========== REVIEWS & COMMENTS (SEO + Cộng đồng) ==========
CREATE TABLE IF NOT EXISTS document_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, document_id)
);
CREATE TABLE IF NOT EXISTS document_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_reviews_document ON document_reviews(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_document ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_reviews_doc_created ON document_reviews(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_comments_doc_created ON document_comments(document_id, created_at ASC);
ALTER TABLE document_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view document_reviews" ON document_reviews;
DROP POLICY IF EXISTS "Purchasers can insert document_reviews" ON document_reviews;
DROP POLICY IF EXISTS "Users can update own document_reviews" ON document_reviews;
CREATE POLICY "Anyone can view document_reviews" ON document_reviews FOR SELECT USING (true);
CREATE POLICY "Purchasers can insert document_reviews" ON document_reviews FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM permissions p WHERE p.user_id = auth.uid() AND p.document_id = document_reviews.document_id)
);
CREATE POLICY "Users can update own document_reviews" ON document_reviews FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Anyone can view document_comments" ON document_comments;
DROP POLICY IF EXISTS "Purchasers can insert document_comments" ON document_comments;
DROP POLICY IF EXISTS "Users can delete own document_comments" ON document_comments;
CREATE POLICY "Anyone can view document_comments" ON document_comments FOR SELECT USING (true);
CREATE POLICY "Purchasers can insert document_comments" ON document_comments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM permissions p WHERE p.user_id = auth.uid() AND p.document_id = document_comments.document_id)
);
CREATE POLICY "Users can delete own document_comments" ON document_comments FOR DELETE USING (auth.uid() = user_id);

-- ========== STORAGE BUCKET private_documents ==========
INSERT INTO storage.buckets (id, name, public)
VALUES ('private_documents', 'private_documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Admin full access private_documents" ON storage.objects;
CREATE POLICY "Admin full access private_documents"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'private_documents'
    AND public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role])
  )
  WITH CHECK (
    bucket_id = 'private_documents'
    AND public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role])
  );

-- ========== STORAGE BUCKET public_assets (covers, preview PDFs) ==========
INSERT INTO storage.buckets (id, name, public)
VALUES ('public_assets', 'public_assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Admin full access public_assets" ON storage.objects;
CREATE POLICY "Admin full access public_assets"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'public_assets'
    AND public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role])
  )
  WITH CHECK (
    bucket_id = 'public_assets'
    AND public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role])
  );

DROP POLICY IF EXISTS "Public read public_assets" ON storage.objects;
CREATE POLICY "Public read public_assets"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'public_assets');
