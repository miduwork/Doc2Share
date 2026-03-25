-- Add is_high_value flag to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS is_high_value BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS num_pages INT DEFAULT 0;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_documents_is_high_value ON public.documents (is_high_value) WHERE is_high_value = true;
