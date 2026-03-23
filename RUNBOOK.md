# Runbook – Vận hành Doc2Share

Tài liệu vận hành: xử lý sự cố thanh toán/webhook, user bị khóa, maintenance, rollback migration và export diagnostics.

---

## 1. Biến môi trường quan trọng

| Biến | Dùng ở | Mô tả |
|------|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | App (client + server) | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App | Anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server, Edge Functions | Service role (bí mật; không đưa ra client) |
| `WEBHOOK_SEPAY_API_KEY` | Edge Function `payment-webhook` | Key xác thực webhook SePay (`Authorization: Apikey <key>`) |
| `PAYMENT_PROVIDER` | Edge Function | `sepay` (mặc định) |
| `VIETQR_*` | App (checkout) | Bank BIN, số TK, tên, template VietQR |
| `DIAGNOSTICS_SHARE_SECRET` | App (admin export) | Secret ký link export alerts/diagnostics (tùy chọn) |
| `INTERNAL_CRON_SECRET` | App (API cron) | Secret bảo vệ `/api/internal/document-pipeline/run` (tùy chọn) |

Edge Functions cần cấu hình Secrets trong Supabase Dashboard → Project Settings → Edge Functions.

---

## 2. Webhook thanh toán lỗi

### 2.1 Nơi xem lỗi

- **Supabase**: Bảng `webhook_events` (provider, event_id, status, error_message, last_seen_at). Chỉ super_admin xem được (RLS).
- **Admin**: Trang **Webhooks** (danh sách event), **Observability** (events 24h, export alerts).
- **Edge Function logs**: Supabase Dashboard → Edge Functions → payment-webhook → Logs.

### 2.2 Mã lỗi và cách xử lý

| HTTP / Tình huống | Ý nghĩa | Hành động |
|-------------------|---------|-----------|
| **401 Unauthorized** | Header `Authorization: Apikey <key>` sai hoặc thiếu | Kiểm tra SePay cấu hình đúng URL webhook và API key; so sánh với `WEBHOOK_SEPAY_API_KEY` trong Secrets. |
| **400 Invalid JSON / Amount mismatch** | Body không phải JSON, hoặc số tiền chuyển không khớp đơn | Kiểm tra payload SePay (transferAmount); so sánh với `orders.total_amount` (VND). Nếu user chuyển sai số tiền, hướng dẫn user chuyển lại đúng số tiền và nội dung. |
| **409 Webhook payload mismatch** | Cùng event_id nhưng payload hash khác (replay khác nội dung) | Thường do SePay gửi trùng event_id với payload đổi. Xem `webhook_events.error_message = 'payload_hash_mismatch'`. Có thể bỏ qua nếu đơn đã completed; nếu chưa, kiểm tra bên SePay. |
| **409 Ambiguous order match** | Nhiều order trùng ref (external_id / content) | Kiểm tra `orders.external_id` và refs trích từ webhook; đảm bảo mỗi đơn có ref duy nhất. |
| **500** | Lỗi server (RPC, DB, exception) | Xem Edge Function logs và `observability_events` (source `edge.payment_webhook`). Kiểm tra RPC `register_webhook_event`, `complete_order_and_grant_permissions`, `complete_webhook_event` có lỗi hay không. |

### 2.3 User đã chuyển tiền nhưng chưa mở khóa

1. Xác nhận user chuyển đúng số tiền và đúng nội dung (có `external_id` hoặc mã đơn).
2. Trong Admin → **Webhooks**: tìm event theo thời gian / nội dung; xem `status` và `error_message`.
3. Nếu event `error` (amount_mismatch, order_not_found, …): sửa dữ liệu (nếu có chính sách) hoặc cấp quyền thủ công.
4. **Cấp quyền thủ công**: Dùng service role hoặc tài khoản admin (có quyền insert permissions): insert vào `permissions` (user_id, document_id); cập nhật `orders.status = 'completed'` nếu cần. Lưu ý đồng bộ với logic `complete_order_and_grant_permissions` (đúng user_id từ order, đúng document_id từ order_items).

---

## 3. User bị khóa (không đăng nhập / bị vô hiệu hóa)

### 3.1 Nguyên nhân thường gặp

- **profiles.is_active = false**: Trigger tự động sau 3 security events mức `high` trong 1 giờ (ví dụ vượt quá 2 thiết bị nhiều lần); hoặc admin tắt thủ công.
- **Auth**: Tài khoản bị xóa hoặc vô hiệu hóa ở Supabase Auth.

### 3.2 Kiểm tra

- Supabase Dashboard → Authentication → Users: xem user còn tồn tại và trạng thái.
- Bảng `profiles`: xem `is_active`, `role`.
- Bảng `security_logs`: lọc theo `user_id`, `severity = 'high'` để xem lịch sử.

### 3.3 Mở khóa (unlock)

- **Chỉ do admin/support**: Vào Admin → **Users** → chọn user → thao tác mở khóa (nếu có nút/action).
- **Qua SQL (service role hoặc migration/script)**:  
  `UPDATE profiles SET is_active = true, updated_at = NOW() WHERE id = '<user_id>';`  
  Chỉ dùng khi đã xác nhận an toàn (ví dụ nhầm trigger, hoặc sau khi user liên hệ support).

---

## 4. Rollback migration

- Migrations Supabase chạy theo thứ tự; **không có cơ chế auto-rollback**.
- **Trước khi chạy migration mới**: Nên backup DB (Supabase Dashboard → Database → Backups hoặc pg_dump).
- **Sau khi chạy migration lỗi**:
  1. Khôi phục DB từ backup (nếu có), hoặc
  2. Viết migration mới (file mới, số thứ tự cao hơn) để **hoàn tác thay đổi** (DROP policy/function/column, tạo lại bảng cũ nếu đã DROP, v.v.). Không sửa nội dung file migration đã chạy.
- **Idempotent script** (`supabase/scripts/run-full-schema-idempotent.sql`): Dùng để đồng bộ schema đầy đủ (ví dụ môi trường mới), không dùng để rollback một migration cụ thể.

### 4.1 Scripts trong `supabase/scripts/`

| Script | Mục đích |
|--------|----------|
| `run-full-schema-idempotent.sql` | Tạo lại toàn bộ schema (môi trường mới). Chạy sau `drop-all-schema.sql` nếu cần reset. |
| `drop-all-schema.sql` | Xóa toàn bộ schema `public`; chạy **trước** khi chạy run-full-schema. |
| `promote-user-to-admin.sql` | Hướng dẫn + mẫu SQL nâng một user lên admin (super_admin/content_manager/support_agent). |
| `archive/fix-after-orders-exists.sql` | One-off: sửa khi lỗi "relation orders already exists" (migrations chạy một phần). Setup mới dùng migrations, không cần script này. |

### 4.2 Scripts tại thư mục gốc (`scripts/`)

| Script | Mục đích | Khi nào chạy |
|--------|----------|--------------|
| `sync-sepay-core.mjs` | Đồng bộ logic SePay từ `src/lib/payments/sepay-webhook-core.ts` sang Edge Function `supabase/functions/payment-webhook/providers/sepay-core.ts`. | **Chạy `npm run sync:sepay`** sau mỗi lần sửa file `sepay-webhook-core.ts` (parse payload, extractOrderReferences, resolveEventId, normalizeOrderRef, isIncomingTransfer, extractAmount). Sau khi chạy, deploy lại Edge Function: `supabase functions deploy payment-webhook`. |

---

## 5. Cron và maintenance

### 5.1 Hàm maintenance (DB)

- **`run_backend_maintenance(p_triggered_by, p_access_logs_keep, p_security_logs_keep, p_observability_keep, p_webhook_keep)`**:  
  Xóa log cũ (access_logs, security_logs, observability_events, webhook_events theo retention), đọc kết quả `check_observability_alerts()`, ghi vào `backend_maintenance_runs`.  
  Chỉ **service_role** gọi được (RLS). Có thể gọi từ cron ngoài hoặc từ Supabase (pg_cron nếu bật).

### 5.2 Document pipeline (async)

- Endpoint: `POST /api/internal/document-pipeline/run` (trong Next.js app). Query `?limit=20` (1–100) tùy chọn.
- Bảo vệ: Header `Authorization: Bearer <INTERNAL_CRON_SECRET>`. Chỉ khi bật `INTERNAL_CRON_SECRET` mới nên gọi từ cron thật.
- Công việc: Chạy một tick pipeline xử lý tài liệu (claim jobs, xử lý, cập nhật trạng thái); trả về `claimed`, `completed`, `failed`.

### 5.3 Chạy maintenance thủ công

- Qua SQL (Supabase SQL Editor, với user có quyền):  
  `SELECT * FROM run_backend_maintenance('manual');`
- Hoặc tích hợp vào Admin (nếu có nút “Chạy maintenance” gọi service role).

---

## 6. Export diagnostics (alerts / observability)

- Admin → **Observability** có thể export alerts/events. Một số route export hỗ trợ **signed link** để chia sẻ không cần đăng nhập.
- **Cách dùng**: Cấu hình `DIAGNOSTICS_SHARE_SECRET` (dài, ngẫu nhiên). Ứng dụng tạo link có tham số `share_exp` (expiry timestamp) và `share_sig` (chữ ký). Ai giữ link hợp lệ (chưa hết hạn, chữ ký đúng) có thể mở export tương ứng.
- Bảo mật: Giữ `DIAGNOSTICS_SHARE_SECRET` bí mật; đặt `share_exp` ngắn nếu chia sẻ tạm.

---

## 7. SLO gợi ý và rà soát bảo mật định kỳ

### 7.1 SLO tối thiểu (điều chỉnh theo môi trường)

- **Edge `payment-webhook`**: Theo dõi tỷ lệ HTTP **401/400/500** trong Supabase → Edge Functions → Logs; mục tiêu **5xx gần 0** sau khi loại trừ lỗi cấu hình SePay.
- **Độ trễ**: Latency Edge (request_id trong response header/body) — đặt ngưỡng cảnh báo nếu p95 vượt quá (ví dụ > 10s) để phát hiện DB/RPC chậm.
- **App**: Nếu có log tập trung (hosting), theo dõi lỗi 5xx trên route API và thời gian phản hồi trang chủ/checkout.

### 7.2 Checklist rà soát (hàng quý hoặc sau thay đổi RLS/migration)

- **RLS**: Đối chiếu policy với `admin_role` và bảng nhạy cảm (`webhook_events`, `security_logs`) — super_admin vs support_agent như thiết kế.
- **Secrets**: `WEBHOOK_SEPAY_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DIAGNOSTICS_SHARE_SECRET`, `INTERNAL_CRON_SECRET` chỉ trong Supabase Secrets / server env; **không** đưa vào `NEXT_PUBLIC_*`.
- **Client**: `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` là public by design; không dùng prefix này cho khóa nhạy cảm.
- **Headers / rate limit**: Luồng secure link và giới hạn thiết bị — xem mục webhook và README; đối chiếu khi đổi hosting (CDN, WAF).

### 7.3 `access_logs` — đọc tài liệu (Next vs Edge)

- **`secure_pdf`**: Ghi khi gọi **`POST /api/secure-pdf`** hoặc **`POST /api/secure-link`** (cùng hành vi rate limit / audit). Query tổng lượt xem web: lọc `action = 'secure_pdf'`.
- **`get_secure_link`**: Ghi khi gọi Edge Function **`get-secure-link`** (Bearer JWT). Query client ngoài web: lọc `action = 'get_secure_link'`.
- **Observability / dashboard**: Preset “secure-link” có thể gồm một hoặc cả hai action — kiểm tra định nghĩa preset trong app admin nếu đổi tên.
- **Đồng bộ logic**: Sửa quy tắc nghiệp vụ trong [`src/lib/secure-access/secure-access-core.ts`](./src/lib/secure-access/secure-access-core.ts), chạy `npm run sync:secure-access`, deploy Edge — xem [ARCHITECTURE.md](./ARCHITECTURE.md) §2.5.
- **Edge (Secrets, tùy chọn)**: Có thể đặt cùng tên biến như Next — `RATE_LIMIT_VIEWS_PER_HOUR`, `RATE_LIMIT_HIGH_FREQ_DOCS_10MIN`, `BRUTE_FORCE_BLOCKED_IN_10MIN` — để đồng bộ ngưỡng với app; nếu không set, Edge dùng mặc định trong `SECURE_ACCESS_DEFAULTS` (file core đã sync).

Checklist release và nâng cấp dependency: [`docs/RELEASE-CHECKLIST.md`](./docs/RELEASE-CHECKLIST.md).

---

## 8. Liên kết nhanh

- **Supabase Dashboard**: [https://supabase.com/dashboard](https://supabase.com/dashboard) → chọn project.
- **Database → Tables**: `orders`, `order_items`, `webhook_events`, `permissions`, `profiles`, `security_logs`, `observability_events`, `backend_maintenance_runs`.
- **Edge Functions → payment-webhook**: Logs, Invoke (test).
- **Authentication**: Users, Policies.
- **README**: [README.md](./README.md) – setup, payment flow, cấu trúc.
- **Testing**: [TESTING.md](./TESTING.md) – unit/integration tests, env cho test.
