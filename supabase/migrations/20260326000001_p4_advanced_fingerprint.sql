-- Phase 4: Advanced Fingerprinting & Behavioral Risk
ALTER TABLE public.device_logs
ADD COLUMN IF NOT EXISTS hardware_fingerprint JSONB,
ADD COLUMN IF NOT EXISTS hardware_hash TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS risk_score FLOAT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS risk_last_analyzed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS lock_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_device_logs_hardware_hash ON public.device_logs (hardware_hash);
CREATE INDEX IF NOT EXISTS idx_profiles_risk_score ON public.profiles (risk_score) WHERE risk_score > 0;

-- Function to handle automated locking based on risk score
CREATE OR REPLACE FUNCTION public.check_risk_locking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.risk_score >= 8.0 AND OLD.risk_score < 8.0 THEN
    NEW.is_locked := true;
    NEW.lock_reason := 'Tự động khóa do phát hiện hành vi rủi ro cao (AI/Behavioral).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_risk_locking ON public.profiles;
CREATE TRIGGER trg_check_risk_locking
BEFORE UPDATE OF risk_score ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_risk_locking();

-- RPC and helper to safely increment risk score from API
CREATE OR REPLACE FUNCTION public.increment_profile_risk_score(
  p_user_id UUID,
  p_increment FLOAT,
  p_reason TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET 
    risk_score = risk_score + p_increment,
    risk_last_analyzed_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO public.security_logs (user_id, event_type, severity, metadata)
  VALUES (
    p_user_id, 
    'risk_score_increment', 
    CASE WHEN p_increment >= 1.0 THEN 'high'::public.severity_level ELSE 'medium'::public.severity_level END,
    jsonb_build_object('increment', p_increment, 'reason', p_reason)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
