-- Users chỉ tồn tại trong auth.users nhưng không có hàng profiles (trigger lỗi, import thủ công, v.v.)
-- khiến Admin > Khách hàng trống. Bổ sung dòng profiles tối thiểu cho mọi user Auth.

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
