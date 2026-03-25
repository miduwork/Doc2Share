-- Create ott_nonces table for single-use signed URLs
CREATE TABLE IF NOT EXISTS public.ott_nonces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cleanup and lookup
CREATE INDEX IF NOT EXISTS idx_ott_nonces_expires_at ON public.ott_nonces (expires_at);
CREATE INDEX IF NOT EXISTS idx_ott_nonces_nonce_unused ON public.ott_nonces (id) WHERE used = false;

-- RLS: Only service role should access this table
ALTER TABLE public.ott_nonces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on ott_nonces"
  ON public.ott_nonces FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
