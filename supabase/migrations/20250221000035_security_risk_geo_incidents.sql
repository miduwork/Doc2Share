-- P2: risk + geolocation + incident review foundation

CREATE TABLE IF NOT EXISTS ip_geo_cache (
  ip TEXT PRIMARY KEY,
  country_code TEXT,
  country_name TEXT,
  city TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('resolved', 'unknown', 'error')),
  last_error TEXT,
  resolved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_geo_cache_status ON ip_geo_cache (status);
CREATE INDEX IF NOT EXISTS idx_ip_geo_cache_expires_at ON ip_geo_cache (expires_at);

ALTER TABLE ip_geo_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin can read ip geo cache" ON ip_geo_cache;
CREATE POLICY "Super admin can read ip geo cache"
  ON ip_geo_cache FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));

DROP POLICY IF EXISTS "Service role can manage ip geo cache" ON ip_geo_cache;
CREATE POLICY "Service role can manage ip geo cache"
  ON ip_geo_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS security_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  correlation_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  risk_score INT NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_band TEXT NOT NULL CHECK (risk_band IN ('low', 'medium', 'high', 'critical')),
  detection_source TEXT NOT NULL DEFAULT 'risk_engine_v1',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'confirmed_risk', 'false_positive')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_incidents_detected_at ON security_incidents (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_incidents_review_status ON security_incidents (review_status);
CREATE INDEX IF NOT EXISTS idx_security_incidents_risk_band ON security_incidents (risk_band);
CREATE INDEX IF NOT EXISTS idx_security_incidents_correlation_detected
  ON security_incidents (correlation_id, detected_at DESC)
  WHERE correlation_id IS NOT NULL;

ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin can read incidents" ON security_incidents;
CREATE POLICY "Super admin can read incidents"
  ON security_incidents FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));

DROP POLICY IF EXISTS "Super admin can insert incidents" ON security_incidents;
CREATE POLICY "Super admin can insert incidents"
  ON security_incidents FOR INSERT
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role]));

DROP POLICY IF EXISTS "Super admin can update incidents" ON security_incidents;
CREATE POLICY "Super admin can update incidents"
  ON security_incidents FOR UPDATE
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]))
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role]));
