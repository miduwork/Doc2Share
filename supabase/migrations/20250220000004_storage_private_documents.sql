-- ============================================
-- Storage bucket "private_documents" + policy cho admin
-- Nếu bucket chưa có: tạo trong Dashboard → Storage → New bucket:
--   Name: private_documents, Public: OFF (private). Sau đó chạy phần policy bên dưới.
-- ============================================

-- Tạo bucket (chỉ các cột cơ bản; nếu lỗi thì tạo bucket thủ công trong Dashboard)
INSERT INTO storage.buckets (id, name, public)
VALUES ('private_documents', 'private_documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Policy: chỉ admin (public.profiles.role = 'admin') mới được upload/update/delete/select
DROP POLICY IF EXISTS "Admin full access private_documents" ON storage.objects;
CREATE POLICY "Admin full access private_documents"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'private_documents'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'private_documents'
    AND public.is_admin()
  );
