# Hướng dẫn thiết lập môi trường Staging (Supabase + Vercel)

Tài liệu này hướng dẫn cách tạo môi trường Staging an toàn để kiểm thử tính năng (đặc biệt là Webhooks và Edge Functions) trước khi deploy lên Production.

## 1. Tạo Supabase Project (Staging)

Môi trường Staging cần một database riêng biệt để tránh rủi ro thay đổi dữ liệu thật.

### Quy trình tạo:
1. Đăng nhập vào [Supabase Dashboard](https://supabase.com/dashboard).
2. Tạo một Project mới, đặt tên ví dụ: `Doc2Share Staging`.
3. Ghi lại các thông tin quan trọng sau để cấu hình:
   - `Reference ID` (nằm trong Project Settings > General)
   - `Project URL` (nằm trong Project Settings > API)
   - `anon key` và `service_role key` (nằm trong Project Settings > API)
   - `Database Password` (bạn tự đặt khi tạo).

## 2. Đồng bộ Database Schema (Prod → Staging)

Để môi trường Staging có cấu trúc giống hệt Production, bạn cần pull schema từ Prod và push lên Staging thông qua Supabase CLI.

### Các bước thực hiện:
**Lưu ý:** Chỉ thực hiện dưới máy tính cá nhân đã cài đặt `supabase-cli`.

1. **Đăng nhập CLI:**
   ```bash
   supabase login
   ```

2. **Link tới Production Project:**
   ```bash
   supabase link --project-ref [PROD_PROJECT_REF]
   ```

3. **Lấy db schema hiện tại về máy:**
   ```bash
   supabase db pull
   ```
   *Thao tác này sẽ lưu trạng thái của schema vào thư mục `supabase/migrations/` (hoặc cập nhật file hiện có)*

4. **Link tới Staging Project:**
   ```bash
   supabase link --project-ref [STAGING_PROJECT_REF]
   ```

5. **Push schema lên Staging:**
   ```bash
   supabase db push
   ```
   *Tất cả các bảng, views, RLS policies sẽ được tạo trên Staging.*

## 3. Cấu hình Vercel Preview (Environment Variables)

Sau khi có Supabase Staging, bạn cần thiết lập biến môi trường trên Vercel cho các bản Preview Deployments.

1. Đăng nhập vào [Vercel Dashboard](https://vercel.com/dashboard).
2. Chọn project `Doc2Share`, chuyển sang tab **Settings > Environment Variables**.
3. Thêm/Cập nhật các biến sau và chọn môi trường áp dụng là **Preview** (Bỏ chọn Production):

| Variable Name | Giá trị tương ứng trên Staging |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `Project URL` của dự án Staging |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon key` của dự án Staging |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role key` của dự án Staging |
| `NEXT_PUBLIC_APP_URL` | URL Vercel cấp tự động (tuỳ chọn gán cứng nếu cần) |

> **Lưu ý với Webhooks (SePay):** Nếu bạn muốn test luồng thanh toán trên môi trường Staging, hãy đảm bảo cấu hình URL webhook trên SePay trỏ về Vercel Preview URL của nhánh đang test.
