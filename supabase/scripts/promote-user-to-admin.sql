-- ============================================
-- Cách tạo tài khoản Admin (chạy trong Supabase SQL Editor)
-- ============================================
-- QUAN TRỌNG: Bảng public.profiles phải đã tồn tại (do migration tạo).
-- Nếu lỗi "relation public.profiles does not exist" → chạy migration trước:
--   - Cách 1: Trong terminal: npx supabase db push (sau khi đã link project)
--   - Cách 2: Trong SQL Editor, chạy lần lượt nội dung các file trong supabase/migrations/
--             (20250220000001_initial_schema.sql, 20250220000002_seed_categories.sql, ...)
--
-- Bước 1: Đăng ký tài khoản bình thường qua app (Trang chủ → Đăng ký).
-- Bước 2: Chạy một trong hai câu lệnh dưới đây trong Supabase Dashboard → SQL Editor.

-- Cách A: Nâng quyền theo EMAIL (thay YOUR_EMAIL@example.com bằng email bạn đã đăng ký)
UPDATE public.profiles
SET role = 'admin', admin_role = 'super_admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com' LIMIT 1);

-- Cách B: Nếu đã biết user UUID (lấy từ Authentication → Users trong Supabase)
-- UPDATE public.profiles
-- SET role = 'admin', admin_role = 'super_admin'
-- WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

-- Các giá trị admin_role:
--   super_admin  = toàn quyền (Tổng quan, Tài liệu, An ninh, Khách hàng, Webhook, Mã giảm giá, Công cụ)
--   content_manager = chỉ mục Tài liệu
--   support_agent   = chỉ mục Khách hàng
