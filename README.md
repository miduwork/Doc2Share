# Doc2Share – Secure Educational Document Marketplace

Ứng dụng sàn tài liệu giáo dục bảo mật: Supabase (PostgreSQL, Auth, Storage), Next.js, Edge Functions (get-secure-link, payment-webhook).

## Tech stack

- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions – TypeScript/Deno)
- **Frontend**: Next.js 14 (App Router), Tailwind CSS
- **Payment**: SePay + VietQR (webhook API key authorization)

## Setup

### 1. Supabase project

- Tạo project tại [supabase.com](https://supabase.com).
- Chạy migrations trong `supabase/migrations/` (theo thứ tự).
- Tạo Storage bucket tên **private_documents** (Private). Trong Storage Policies, thêm policy cho phép `authenticated` (hoặc role admin) upload vào bucket này nếu cần upload từ app (hoặc dùng Edge Function upload với service role).
- Cấp quyền cho RLS: đảm bảo service role dùng trong Edge Functions.

### 2. Environment

Sao chép **`.env.local.example`** thành `.env.local` và điền giá trị. Xem `.env.local.example` để biết đầy đủ biến môi trường (Supabase, payment, VietQR, SePay webhook, diagnostics, cron, app URL / community).

Ví dụ tối thiểu:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Trong Supabase Edge Functions (Settings → Secrets), thêm (cho payment-webhook):

- `WEBHOOK_SEPAY_API_KEY` – key dùng để xác thực SePay webhook (`Authorization: Apikey <key>`).

### 3. Deploy Edge Functions

```bash
supabase functions deploy get-secure-link
supabase functions deploy payment-webhook
```

### 4. Chạy app

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

### CI và release

- GitHub Actions: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — `lint`, `npm run test`, `npm run build` trên **Node.js 22** (push/PR lên `main` hoặc `master`).
- Trước deploy: [`docs/RELEASE-CHECKLIST.md`](docs/RELEASE-CHECKLIST.md) (dependency, SePay sync, kiểm tra tối thiểu).

### 5. Admin & RBAC

- Để một user thành admin: xem hướng dẫn và mẫu SQL trong **`supabase/scripts/promote-user-to-admin.sql`** (cập nhật `profiles.role = 'admin'` và tùy chọn `profiles.admin_role = 'super_admin' | 'content_manager' | 'support_agent'`).
- **Super Admin**: toàn quyền (Overview, Documents, Security, Users, Webhooks).
- **Content Manager**: chỉ mục Tài liệu (Document CMS).
- **Support Agent**: chỉ mục Khách hàng (xem user, mở khóa thủ công).

## Cấu trúc chính

- **DB**: `categories`, `documents`, `profiles`, `permissions`, `device_logs`, `active_sessions`, `usage_stats`, `access_logs`, `security_logs`, `orders`, `order_items`. RLS và triggers (tạo profile khi đăng ký, cảnh báo >2 thiết bị, tự khóa user khi 3 red flags/1h).
- **Đọc tài liệu (bảo mật)**: Ứng dụng web (Secure Reader) gọi **`POST /api/secure-pdf`** — stream PDF, cookie session, rate limit và audit (`access_logs`, action `secure_pdf`). **`POST /api/secure-link`** trả signed URL ngắn hạn (cùng quy tắc nghiệp vụ trong `src/lib/secure-access/secure-access-core.ts`). **Edge `get-secure-link`**: client gửi **Bearer JWT** (app mobile / tích hợp ngoài), cùng logic cốt lõi sau khi sync từ core; ghi `access_logs` với action `get_secure_link`, có thể tạo `active_sessions` nếu thiếu. Chi tiết: [ARCHITECTURE.md](./ARCHITECTURE.md) mục “Luồng truy cập tài liệu”.
- **payment-webhook**: Xác thực SePay API key header, match order, idempotent; transaction cập nhật `orders` + insert `permissions`.
- **Frontend**: Trang chủ + lọc (khối lớp, môn, kỳ thi), SEO URL `/cua-hang/[id]/[slug]`, Schema.org CreativeWork, preview 3–5 trang, Secure Reader (chặn right-click/Ctrl+C/P/S/F12, watermark, blur khi chuột ra ngoài), Dashboard (Tủ sách, Quản lý thiết bị), Admin (Overview, Document CMS, Security, Users, Webhooks).

## SePay webhook

- SePay gửi POST tới URL: `https://<project-ref>.supabase.co/functions/v1/payment-webhook`.
- Header xác thực: `Authorization: Apikey <WEBHOOK_SEPAY_API_KEY>`.
- Payload dùng `transferType=in`, `transferAmount`, `content/description/referenceCode` để khớp `orders.external_id` (hoặc fallback theo token cũ).
- **Logic parse/validate** nằm ở `src/lib/payments/sepay-webhook-core.ts`. Sau khi sửa file này, chạy **`npm run sync:sepay`** để đồng bộ sang Edge Function (`scripts/sync-sepay-core.mjs`), rồi deploy: `supabase functions deploy payment-webhook`.

## Luồng thanh toán (Payment flow)

1. **Checkout**: User chọn tài liệu → `/checkout` → server action `createCheckoutVietQr(documentId)` tạo bản ghi `orders` (status `pending`), `order_items`, trả về VietQR / link chuyển khoản. Trường `orders.external_id` (VQR-xxx hoặc UUID) dùng làm nội dung chuyển khoản.
2. **User chuyển khoản**: User chuyển đúng số tiền, nội dung chuyển khoản chứa `external_id` (ví dụ `VQR-abc123` hoặc UUID đơn hàng).
3. **Webhook**: SePay gọi POST `payment-webhook` với payload (transferType, transferAmount, content/description/referenceCode). Edge function:
   - Xác thực header `Authorization: Apikey <WEBHOOK_SEPAY_API_KEY>`.
   - Parse JSON, trích `orderRefs` (referenceCode, VQR-*, D2S-*, UUID), resolve `event_id` (idempotency).
   - Gọi RPC `register_webhook_event(provider, event_id, payload_hash)`: nếu cùng event_id + cùng hash → trả 200 duplicate; khác hash → 409 hash_mismatch.
   - Nếu `transferType !== 'in'` → complete event `ignored`.
   - Tìm order theo refs (`orders.external_id` hoặc ref trong content/description). Không tìm thấy → ignored; tìm thấy nhiều order → 409 ambiguous.
   - So sánh `transferAmount` với `orders.total_amount` (VND). Không khớp → 400 amount_mismatch, ghi event `error`.
   - Nếu order đã `completed` → trả 200 success (idempotent).
   - Gọi RPC `complete_order_and_grant_permissions(order_id, external_ref, raw_webhook)`: cập nhật `orders.status = 'completed'`, thêm `permissions` cho user đối với từng document trong đơn. Một transaction duy nhất.
   - Gọi `complete_webhook_event(..., status: 'processed')`, ghi observability.
4. **Sau khi webhook thành công**: User vào Dashboard (Tủ sách) thấy tài liệu đã mua; mở tài liệu qua Secure Reader — **`POST /api/secure-pdf`** kiểm tra `permissions` (và thiết bị / phiên; logic cốt lõi dùng chung với Edge, xem `secure-access-core`).

**Bảng liên quan**: `orders`, `order_items`, `webhook_events`, `permissions`. RPC chính: `register_webhook_event`, `complete_order_and_grant_permissions`, `complete_webhook_event`.

## Kiến trúc và mở rộng

Xem **[ARCHITECTURE.md](./ARCHITECTURE.md)** cho: cấu trúc domain, thêm payment provider / admin role / repository, chuẩn response action (`ActionResult`).

## Vận hành và runbook

Xem **[RUNBOOK.md](./RUNBOOK.md)** cho: xử lý webhook lỗi, user bị khóa, rollback migration, cron/maintenance, export diagnostics.

## Lưu ý

- **Single session**: Để ép đăng xuất thiết bị cũ khi đăng nhập mới, cần thêm logic (ví dụ Edge Function on auth event) ghi `active_sessions` và endpoint kiểm tra session hiện tại; client định kỳ gọi và nếu session bị invalide thì gọi `signOut()`.
- **Preview 3–5 trang**: Có thể dùng script/server để cắt PDF (vd. pdf-lib hoặc ImageMagick) tạo ảnh preview và lưu `preview_url`; trích 20–30% text cho `preview_text` (SEO).
- **Storage upload**: Nếu bucket private và anon không được upload, dùng Edge Function nhận file và upload bằng service role, hoặc bật policy Storage cho `authenticated` với điều kiện `auth.jwt() ->> 'role' = 'admin'` (nếu đã set custom claim).
