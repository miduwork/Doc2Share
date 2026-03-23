# Đánh giá Full-Stack – Doc2Share

Đánh giá codebase từ góc nhìn full-stack: frontend (Next.js, React), backend (Supabase, Edge), kiến trúc, bảo mật và vận hành.

---

## 1. Tổng quan

- **Sản phẩm**: Sàn tài liệu giáo dục: mua bán tài liệu, thanh toán VietQR/SePay, đọc bảo mật (Secure Reader), admin CMS và observability.
- **Stack**: Next.js 14 (App Router), React 18, Supabase (PostgreSQL, Auth, Storage, Edge Functions), Tailwind CSS. TypeScript toàn bộ.
- **Quy mô**: ~110 file TS/TSX trong `src/`, 26 migrations, 2 Edge Functions (payment-webhook, get-secure-link), scripts sync SePay và schema idempotent.

---

## 2. Frontend

### Điểm mạnh

- **App Router nhất quán**: Cấu trúc route rõ (page/layout/error), Server Components mặc định; Client Components chỉ nơi cần state/event (`"use client"`).
- **Phân tách rõ**: Trang phức tạp tách Client (DashboardClient, ProductPageClient, Admin*Client) khỏi page server; components admin đã tách (DocumentFilters, BulkActionsBar, DocumentTable, EditDocumentModal, KpiCard).
- **Form & validation**: react-hook-form + Zod (@hookform/resolvers), schema rõ (upload, coupons). Server actions dùng `ActionResult<T>`, client xử lý `result.ok` / `result.error` thống nhất.
- **UX**: Toasts (sonner), error boundary (app/checkout, admin, global), loading/empty states. Secure Reader (chặn right-click, blur, watermark) thể hiện chú ý bảo vệ nội dung.

### Cần lưu ý

- **Ảnh**: Nhiều nơi dùng `<img>` (VietQR, thumbnail, preview); đã dùng eslint-disable có comment. Có thể dần chuyển sang `next/image` (với `sizes`/placeholder) để tối ưu LCP và bandwidth khi có thời gian.
- **SEO**: Có slug, Schema.org (CreativeWork), `lib/seo.ts` (slugify). Có thể bổ sung metadata động (generateMetadata) cho từng trang sản phẩm nếu cần.

---

## 3. Backend & Data

### Điểm mạnh

- **Domain rõ ràng**: Năm domain (checkout, document-upload, document-pipeline, documents, observability) với **ports** (interface) + **adapters** (Supabase, mock cho test). Factory `create*Repository()` inject dependency; actions nhận `deps?` để test.
- **Một nguồn sự thật**: Logic SePay ở `src/lib/payments/sepay-webhook-core.ts`, sync sang Edge qua `scripts/sync-sepay-core.mjs`; UUID dùng chung `lib/uuid.ts`. Tránh lặp và lệch logic giữa Node và Edge.
- **Server actions chuẩn hóa**: `ActionResult<T>`, `ok()`/`fail()`, guard (requireSuperAdminContext, requireDocumentManagerContext) trước khi gọi repository. Lỗi trả về message, không throw tùy tiện.
- **API nội bộ**: Route `/api/internal/document-pipeline/run` bảo vệ bằng `Authorization: Bearer <INTERNAL_CRON_SECRET>`, gọi domain document-pipeline. Phù hợp cron/worker.

### Cần lưu ý

- **Edge vs Node**: Payment webhook chạy trên Edge (Deno), logic core mirror từ Node. Cần nhớ chạy `npm run sync:sepay` sau khi sửa core (đã ghi RUNBOOK/README).
- **Transaction**: Các RPC Supabase (complete_order_and_grant_permissions, register_webhook_event, …) xử lý transaction ở DB; app/actions gọi từng bước. Với luồng phức tạp hơn có thể cân nhắc transaction ở tầng service.

---

## 4. Auth & Security

### Điểm mạnh

- **Middleware**: Refresh session Supabase (@supabase/ssr), bảo vệ `/admin` (user + profile.role === 'admin' + is_active). Redirect về login/unauthorized rõ ràng.
- **RLS**: Policy theo role (super_admin, content_manager, support_agent), bảng nhạy cảm (webhook_events, security_logs) chỉ super_admin; migrations và script idempotent đồng bộ.
- **Admin capability**: `guards-core.ts` map role → capability (canManageDocuments, canManageUsers); từng trang admin gọi requireSuperAdminContext / requireDocumentManagerContext / requireUserManagerContext. Tránh “chỉ ẩn nút” mà không chặn server.
- **Webhook**: Edge payment-webhook xác thực `Authorization: Apikey <WEBHOOK_SEPAY_API_KEY>`; idempotency qua `register_webhook_event` (event_id + payload_hash). Chống replay và nhầm lẫn.
- **Secure Reader**: get-secure-link (Edge) kiểm tra JWT, permission, giới hạn thiết bị, rate limit; trả signed URL ngắn hạn. Không lộ file gốc.

### Cần lưu ý

- **Secrets**: Service role chỉ dùng server/Edge; không đưa vào client. INTERNAL_CRON_SECRET, DIAGNOSTICS_SHARE_SECRET tùy chọn nhưng đã có trong docs.
- **Device/session**: Login ghi device_logs, single session (tạo mới/xóa cũ), cảnh báo >2 thiết bị; IP change 30 phút → security_log. Logic rõ, có thể bổ sung rate limit đăng nhập nếu cần.

---

## 5. Kiến trúc & mở rộng

### Điểm mạnh

- **Mở rộng có hướng dẫn**: ARCHITECTURE.md mô tả thêm payment provider, admin role, repository; quy ước ActionResult, env, types. Dễ onboard và mở rộng.
- **Type gọn**: Shared types (Category, AdminRole, ProfileRole) ở `lib/types.ts`; type theo domain ở `ports.ts`. Tránh import chéo và type “ma”.
- **Scripts & vận hành**: RUNBOOK (webhook lỗi, user khóa, migration, cron, export diagnostics, sync SePay), README (setup, payment flow), TESTING (unit/integration, env). Scripts supabase/scripts và scripts/sync-sepay có bảng và điều kiện chạy.

### Cần lưu ý

- **E2E**: TESTING.md nhắc P3 E2E (Playwright/Cypress); chưa thấy cấu hình trong repo. Khi cần ổn định luồng checkout/admin có thể thêm.
- **Monitoring**: Observability (metrics 24h, alerts, maintenance runs, export CSV) đã có; có thể bổ sung alert (Slack/email) khi webhook lỗi nhiều hoặc maintenance fail.

---

## 6. Chất lượng code & vận hành

### Điểm mạnh

- **ESLint**: Config next/core-web-vitals + no-unused-vars; lint sạch, build thành công.
- **Test**: Unit (guards, date, upload-orchestrator, sepay-webhook), integration (webhook idempotency, RLS admin); test chạy Node, tách server-only để không kéo Supabase vào unit.
- **Cleanup đã làm**: Domain types/ports gọn, không dead code rõ; file lớn đã tách (observability, AdminDocuments); UUID/SePay single source; docs cập nhật.

### Cần lưu ý

- **Type strict**: tsconfig có thể bật strict hơn (strictNullChecks, noImplicitAny) nếu chưa; giúp bắt lỗi sớm.
- **Logging**: Hiện lỗi chủ yếu qua return message và toast; có thể thêm log có cấu trúc (request id, action, error) cho debug production.

---

## 7. Tóm tắt điểm mạnh

| Hạng mục | Đánh giá |
|----------|-----------|
| **Cấu trúc** | App Router + domain ports/adapters rõ, tách Client/Server đúng chỗ. |
| **Backend** | Supabase + Edge hợp lý; RPC, RLS, idempotency webhook được dùng đúng. |
| **Auth & RBAC** | Middleware + guards + RLS đồng bộ; capability map, không chỉ ẩn UI. |
| **Payment** | VietQR + SePay webhook, single source core, sync script có docs. |
| **Security** | Secure link, API key webhook, cron secret, signed diagnostics. |
| **Docs & runbook** | README, ARCHITECTURE, RUNBOOK, TESTING, CLEANUP-*; scripts có bảng khi nào chạy. |
| **Chất lượng** | TypeScript, ESLint sạch, server actions chuẩn ActionResult, test có unit + integration. |

---

## 8. Gợi ý cải thiện (theo mức độ ưu tiên)

1. **Tùy chọn – ảnh**: Dần thay `<img>` bằng `next/image` (kích thước cố định hoặc fill) để cải thiện LCP; giữ eslint-disable cho đến khi chuyển xong.
2. **Tùy chọn – E2E**: Thêm Playwright/Cypress cho luồng đăng nhập → checkout → webhook (hoặc mock webhook) khi cần ổn định release.
3. **Tùy chọn – observability**: Kết nối alert (Slack/email) khi webhook error tăng đột biến hoặc maintenance run fail.
4. **Tùy chọn – logging**: Log có cấu trúc (level, action, error, requestId) ở server actions / API để dễ trace production.

---

**Kết luận ngắn**: Codebase phù hợp sản phẩm sàn tài liệu + thanh toán + admin: kiến trúc rõ, bảo mật và RLS được chú trọng, tài liệu và vận hành đầy đủ. Các gợi ý trên chủ yếu là nâng cấp tùy chọn (ảnh, E2E, alert, logging) chứ không phải lỗi thiết kế.
