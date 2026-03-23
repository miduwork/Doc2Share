-- Full RLS least-privilege: replace remaining is_admin() with has_admin_role(...).
-- Aligns DB with app guards: document_manager = super_admin | content_manager; user_manager = super_admin | support_agent.
-- Requires public.has_admin_role(admin_role[]) from 20250220000024.

-- ========== Categories: only super_admin manages (site structure) ==========
DROP POLICY IF EXISTS "Only admin can manage categories" ON categories;
CREATE POLICY "Only admin can manage categories"
  ON categories FOR ALL
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]))
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role]));

-- ========== Documents: super_admin | content_manager (document managers) ==========
DROP POLICY IF EXISTS "Only admin can insert documents" ON documents;
CREATE POLICY "Only admin can insert documents"
  ON documents FOR INSERT
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

DROP POLICY IF EXISTS "Only admin can update documents" ON documents;
CREATE POLICY "Only admin can update documents"
  ON documents FOR UPDATE
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

DROP POLICY IF EXISTS "Only admin can delete documents" ON documents;
CREATE POLICY "Only admin can delete documents"
  ON documents FOR DELETE
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

-- ========== Permissions: super_admin | content_manager (grant/revoke access to docs) ==========
DROP POLICY IF EXISTS "Admin can insert permissions" ON permissions;
CREATE POLICY "Admin can insert permissions"
  ON permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

DROP POLICY IF EXISTS "Admin can delete permissions" ON permissions;
CREATE POLICY "Admin can delete permissions"
  ON permissions FOR DELETE
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

-- ========== Orders / order_items: super_admin only (ops / manual fixes) ==========
DROP POLICY IF EXISTS "Admin can update orders" ON orders;
CREATE POLICY "Admin can update orders"
  ON orders FOR UPDATE
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]));

DROP POLICY IF EXISTS "Admin or system manage order_items" ON order_items;
CREATE POLICY "Admin or system manage order_items"
  ON order_items FOR ALL
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role]))
  WITH CHECK (public.has_admin_role(ARRAY['super_admin'::admin_role]));

-- ========== Profiles: super_admin | support_agent (user managers) ==========
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
CREATE POLICY "Admin can view all profiles"
  ON profiles FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'support_agent'::admin_role]));

DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;
CREATE POLICY "Admin can update all profiles"
  ON profiles FOR UPDATE
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'support_agent'::admin_role]));

-- ========== Document pipeline / versions / audit / locks: super_admin | content_manager ==========
DROP POLICY IF EXISTS "Admin can view document upload sessions" ON document_upload_sessions;
CREATE POLICY "Admin can view document upload sessions"
  ON document_upload_sessions FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

DROP POLICY IF EXISTS "Admin can view document processing jobs" ON document_processing_jobs;
CREATE POLICY "Admin can view document processing jobs"
  ON document_processing_jobs FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

DROP POLICY IF EXISTS "Admin can view document versions" ON document_versions;
CREATE POLICY "Admin can view document versions"
  ON document_versions FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

DROP POLICY IF EXISTS "Admin can view document audit logs" ON document_audit_logs;
CREATE POLICY "Admin can view document audit logs"
  ON document_audit_logs FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

DROP POLICY IF EXISTS "Admin can view document edit locks" ON document_edit_locks;
CREATE POLICY "Admin can view document edit locks"
  ON document_edit_locks FOR SELECT
  USING (public.has_admin_role(ARRAY['super_admin'::admin_role, 'content_manager'::admin_role]));

-- ========== Storage: document managers only ==========
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

-- ========== Trigger: allow any admin to self-update profile (prevent only non-admins from escalating) ==========
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
