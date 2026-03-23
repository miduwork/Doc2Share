# Testing – Doc2Share

## Cấu trúc và quy ước

- **Test runner**: Node.js built-in (`node:test`), không dùng Jest/Vitest để giữ dependency tối thiểu.
- **Vị trí**: Test file đặt cạnh hoặc gần module được test, tên `*.test.ts`.
  - Ví dụ: `src/lib/admin/guards.ts` → `src/lib/admin/guards.test.ts`
  - Domain: `src/lib/domain/document-upload/services/upload-orchestrator.ts` → `.../upload-orchestrator.test.ts`
- **Chạy test**: `npm run test` — script [`scripts/run-unit-tests.mjs`](scripts/run-unit-tests.mjs) tự tìm mọi `**/*.test.ts` dưới `src/`, **trừ** `src/test-integration/` (cần **Node.js 22+**, xem `engines` trong `package.json`).
- **Chạy một file**: `node --experimental-strip-types --test src/lib/admin/guards.test.ts`

## Phạm vi ưu tiên

| Ưu tiên | Mục | Loại test | Ghi chú |
|--------|-----|-----------|--------|
| P0 | Admin guards (`canManage*`, `computeAdminContext`) | Unit | Pure logic, không mock Supabase |
| P0 | Upload orchestrator | Unit | Đã có: mock repository |
| P1 | `formatDate` / util thuần | Unit | Dễ test, không I/O |
| P2 | Payment webhook (parse, idempotency) | Unit + Integration | Đã có: Node unit (sepay-webhook), Deno (sepay.test.ts), integration (webhook-idempotency) |
| P2 | RLS (super_admin vs support_agent) | Integration | Đã có: `test:integration` khi có Supabase local + test users |
| P3 | Server actions (upload, checkout) | Integration | Mock `createClient` / service role |
| P3 | E2E (login, checkout, admin) | E2E | Playwright/Cypress khi cần |

## Test mẫu hiện có

- **`src/lib/admin/guards.test.ts`**: Import từ `guards-core.ts` (không dùng `guards.ts` để tránh `server-only` khi chạy Node). Test: `canManageDocuments`, `canManageUsers`, `computeAdminContext` (user/profile → GuardResult).
- **`src/lib/date.test.ts`**: `formatDate` (chuỗi ngày → định dạng vi-VN; input không hợp lệ → `"Invalid Date"`).
- **`src/lib/domain/document-upload/services/upload-orchestrator.test.ts`**: orchestrator với mock repository (finalize fallback, rollback khi create session lỗi, không xóa file sau khi đã có document row).
- **`src/lib/secure-access/secure-access-core.test.ts`**: Quy tắc thuần đọc tài liệu (thiết bị, phiên, quyền, rate math) — đồng bộ sang Edge qua `npm run sync:secure-access`.
- **`src/lib/payments/sepay-webhook.test.ts`**: SePay parse payload, extractOrderReferences, resolveEventId, normalizeOrderRef, isIncomingTransfer, extractAmount (logic mirror của Edge function).
- **`supabase/functions/payment-webhook/providers/sepay.test.ts`**: cùng nội dung, chạy bằng Deno (`npm run test:webhook` khi đã cài Deno).
- **`src/test-integration/webhook-idempotency.test.ts`**: tích hợp RPC `register_webhook_event` (first call → should_process true, second same hash → duplicate; same event_id khác hash → hash_mismatch). Cần `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- **`src/test-integration/rls-admin.test.ts`**: tích hợp RLS (super_admin đọc được webhook_events/security_logs; support_agent không). Cần Supabase local + hai user test (xem bên dưới).

## Thêm test mới

1. Tạo file `*.test.ts` bên cạnh module (dưới `src/`, không đặt trong `src/test-integration/` nếu đó là unit test).
2. Import `import { test } from "node:test";` và `import { strict as assert } from "node:assert";`.
3. Không cần sửa `package.json`: `npm run test` tự nhận file mới. Test tích hợp đặt trong `src/test-integration/` và chạy bằng `npm run test:integration` ([`scripts/run-integration-tests.mjs`](scripts/run-integration-tests.mjs)).

## Mock và dependency injection

- **Logic thuần**: Tách hàm pure vào module không I/O (ví dụ `guards-core.ts` chứa `computeAdminContext`, `canManage*`); test import từ module đó để không kéo theo `server-only` khi chạy `node --test`.
- **I/O (Supabase, fetch)**: Dùng adapter/mock (như `createMockDocumentUploadRepository`); tránh gọi Supabase thật trong unit test.
- **Server-only**: Test chạy bằng Node (không qua Next). Các file dùng `import "server-only"` (ví dụ `guards.ts`) không nên được import trực tiếp trong test; test logic thuần qua module tách (ví dụ `guards-core.ts`).

## Test tích hợp (Supabase local)

Chạy `npm run test:integration` (tự tìm mọi `*.test.ts` trong `src/test-integration/`). Các test được **bỏ qua** nếu thiếu biến môi trường.

### Webhook idempotency

- **Env**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (ví dụ từ `supabase start` → Settings → API).
- **Nội dung**: Gọi RPC `register_webhook_event` lần 1 → `should_process: true`; lần 2 cùng (provider, event_id, hash) → `should_process: false`; cùng event_id nhưng hash khác → `current_status: 'hash_mismatch'`.
- **Yêu cầu**: Đã chạy migrations (có bảng `webhook_events` và hàm `register_webhook_event`).

### RLS (super_admin vs support_agent)

- **Env**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TEST_SUPER_ADMIN_EMAIL`, `TEST_SUPER_ADMIN_PASSWORD`, `TEST_SUPPORT_AGENT_EMAIL`, `TEST_SUPPORT_AGENT_PASSWORD`.
- **Nội dung**: Đăng nhập lần lượt bằng super_admin và support_agent; kiểm tra super_admin SELECT được `webhook_events` / `security_logs`; support_agent không thấy hàng (0 rows); support_agent vẫn SELECT được `profiles` (user manager).
- **Chuẩn bị user test** (Supabase local):
  1. Tạo hai user qua Auth (Sign up) hoặc Dashboard.
  2. Trong SQL: `UPDATE profiles SET role = 'admin', admin_role = 'super_admin', is_active = true WHERE id = '<super_admin_user_id>';` và tương tự `admin_role = 'support_agent'` cho user kia.
  3. Đặt đủ 6 biến env rồi chạy `npm run test:integration`.

## E2E (Playwright)

- Chạy: `npm run test:e2e` khi app đang bật (`npm run dev`). Cấu hình: [`playwright.config.ts`](playwright.config.ts).
- **Chung**: `BASE_URL` (mặc định `http://localhost:3000`), `E2E_LOGIN_EMAIL`, `E2E_LOGIN_PASSWORD` — dùng cho [`e2e/login-and-pdf.spec.ts`](e2e/login-and-pdf.spec.ts).
- **Checkout pending**: [`e2e/checkout-pending.spec.ts`](e2e/checkout-pending.spec.ts) — thêm `E2E_CHECKOUT_DOCUMENT_ID` (UUID tài liệu user có thể mua; đơn mới thường ở trạng thái `pending`).
- **Admin chờ duyệt**: [`e2e/admin-documents-pending.spec.ts`](e2e/admin-documents-pending.spec.ts) — `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` (user `role = admin`, có quyền vào Document CMS).

## Test webhook bằng Deno

Khi đã cài [Deno](https://deno.land): `npm run test:webhook`. Chạy `supabase/functions/payment-webhook/providers/sepay.test.ts` (cùng logic với Node test trong `src/lib/payments/sepay-webhook.test.ts`).
