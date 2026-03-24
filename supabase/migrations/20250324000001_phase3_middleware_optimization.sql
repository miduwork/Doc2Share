-- ============================================
-- Phase 3: Middleware Performance Optimization
-- Sync profiles (role, status) to auth.users app_metadata for zero-query RBAC in Middleware
-- ============================================

-- 1) Create function to sync profile changes to auth.users metadata
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_metadata = COALESCE(raw_app_metadata, '{}'::jsonb) || 
      jsonb_build_object(
        'role', NEW.role,
        'admin_role', NEW.admin_role,
        'is_active', NEW.is_active,
        'banned_until', NEW.banned_until
      )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Create trigger on profiles
DROP TRIGGER IF EXISTS trg_sync_profile_to_auth ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_auth
  AFTER INSERT OR UPDATE OF role, admin_role, is_active, banned_until
  ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_profile_to_auth_metadata();

-- 3) Backfill existing users
-- Note: This will update all existing users' metadata in the auth.users table
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN (SELECT id, role, admin_role, is_active, banned_until FROM public.profiles) LOOP
    UPDATE auth.users
    SET raw_app_metadata = COALESCE(raw_app_metadata, '{}'::jsonb) || 
        jsonb_build_object(
          'role', r.role,
          'admin_role', r.admin_role,
          'is_active', r.is_active,
          'banned_until', r.banned_until
        )
    WHERE id = r.id;
  END LOOP;
END $$;
