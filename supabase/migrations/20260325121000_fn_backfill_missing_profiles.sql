-- Gọi từ app (RPC) sau khi đăng nhập admin; không cần chạy SQL tay.
CREATE OR REPLACE FUNCTION public.backfill_missing_profiles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  SELECT
    u.id,
    COALESCE(
      NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
      split_part(u.email, '@', 1)
    ),
    'student'::public.profile_role
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_missing_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_missing_profiles() TO service_role;
