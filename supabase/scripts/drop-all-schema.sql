-- ============================================
-- DOC2SHARE: XÓA TOÀN BỘ schema public (chạy trong Supabase SQL Editor)
-- Chạy script này TRƯỚC, sau đó chạy run-full-schema-idempotent.sql để tạo lại
-- ============================================

-- 1. Trigger trên auth.users (phải xóa trước)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. View
DROP VIEW IF EXISTS documents_public;

-- 3. Bảng (đúng thứ tự: bảng con trước, bảng cha sau)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS security_logs CASCADE;
DROP TABLE IF EXISTS access_logs CASCADE;
DROP TABLE IF EXISTS usage_stats CASCADE;
DROP TABLE IF EXISTS active_sessions CASCADE;
DROP TABLE IF EXISTS device_logs CASCADE;
DROP TABLE IF EXISTS document_reviews CASCADE;
DROP TABLE IF EXISTS document_comments CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- 4. Hàm (sau khi không còn bảng tham chiếu)
DROP FUNCTION IF EXISTS auto_disable_user_on_red_flags() CASCADE;
DROP FUNCTION IF EXISTS check_device_limit() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS get_my_role() CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- 5. Enum types (thứ tự: không phụ thuộc bảng nào còn dùng)
DROP TYPE IF EXISTS security_severity CASCADE;
DROP TYPE IF EXISTS security_event_type CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS admin_role CASCADE;
DROP TYPE IF EXISTS profile_role CASCADE;
DROP TYPE IF EXISTS category_type CASCADE;
