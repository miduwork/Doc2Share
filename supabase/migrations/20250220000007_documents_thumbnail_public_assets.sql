-- Add thumbnail_url to documents (cover image for product cards)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Public bucket for cover images and preview PDFs (public URLs for UI)
INSERT INTO storage.buckets (id, name, public)
VALUES ('public_assets', 'public_assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Admin can upload to public_assets
DROP POLICY IF EXISTS "Admin full access public_assets" ON storage.objects;
CREATE POLICY "Admin full access public_assets"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'public_assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'public_assets' AND public.is_admin());

-- Public read for public_assets (thumbnail/preview URLs work without signed URL)
DROP POLICY IF EXISTS "Public read public_assets" ON storage.objects;
CREATE POLICY "Public read public_assets"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'public_assets');

-- Include thumbnail_url in public view for listing
DROP VIEW IF EXISTS documents_public;
CREATE VIEW documents_public AS
  SELECT id, title, description, price, preview_url, preview_text, thumbnail_url,
         subject_id, grade_id, exam_id, is_downloadable, created_at, updated_at
  FROM documents;
