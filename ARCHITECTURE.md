# Kiến trúc & mở rộng – Doc2Share

Tài liệu hướng dẫn tích hợp và mở rộng: cấu trúc domain, điểm mở rộng (payment, admin role, repository), và quy ước.

---

## 1. Cấu trúc thư mục

```
src/
├── app/                    # Next.js App Router (routes, layouts, server actions, API)
├── components/             # UI components (shared + admin)
├── hooks/
├── lib/
│   ├── domain/             # Domain modules (ports + adapters)
│   │   ├── checkout/
│   │   ├── document-upload/
│   │   ├── document-pipeline/
│   │   ├── documents/      # Admin documents (CMS)
│   │   └── observability/
│   ├── payments/           # Checkout providers + SePay webhook core (parse payload; dùng bởi lib/webhooks/sepay)
│   ├── secure-access/      # secure-access-core: quy tắc chung đọc tài liệu (Next + Edge sync)
│   ├── admin/              # Guards, capability map (guards-core)
│   ├── supabase/           # Server/client/service-role, middleware
│   ├── types.ts            # Shared types (Profile, Order, AdminRole, …)
│   ├── action-result.ts    # ActionResult<T>, ok(), fail() – dùng cho server actions
│   └── ...
supabase/
├── migrations/
├── functions/              # Edge (get-secure-link, resolve-ott)
└── scripts/
```

- **Domain**: Mỗi domain có `ports.ts` (interface), `adapters/supabase`, `adapters/mock`, và barrel `index.ts` export factory + types. App và actions import từ barrel (ví dụ `@/lib/domain/checkout`).
- **Single source of truth**: `AdminRole` và entity types (Order, Profile, …) ở `lib/types.ts`. Admin capability map ở `lib/admin/guards-core.ts` (`ADMIN_ROLE_CAPABILITIES`).

---

## 2. Điểm mở rộng

### 2.1 Thêm payment provider (checkout)

1. **Định nghĩa provider**: Implement `CheckoutPaymentProvider` trong `src/lib/payments/providers/types.ts` (buildCheckoutPayment, …).
2. **Đăng ký**: Thêm instance vào `providers` trong `src/lib/payments/providers/index.ts`; thêm id vào `ALLOWED_PAYMENT_PROVIDER_IDS`.
3. **Cấu hình**: Đặt `PAYMENT_PROVIDER=<id>` (env). Nếu id không nằm trong allowlist, dev sẽ log warning và fallback về `sepay`.

Xác nhận thanh toán tự động: **SePay** gọi `POST /api/webhook/sepay` (Next.js, `src/lib/webhooks/sepay.ts`). Mở rộng provider khác: thêm handler/route tương ứng hoặc mở rộng `handleSePayWebhook` / core parse nếu cùng định dạng.

### 2.2 Thêm admin role

1. **Kiểu**: Mở rộng union `AdminRole` trong `src/lib/types.ts` (ví dụ `"support_agent" | "auditor"`).
2. **Capability**: Thêm một dòng vào `ADMIN_ROLE_CAPABILITIES` trong `src/lib/admin/guards-core.ts` (canManageDocuments, canManageUsers). Có thể mở rộng object sau (ví dụ canViewAudit).
3. **UI**: Trong `src/components/admin/AdminNav.tsx`, thêm role vào mảng `roles` của item tương ứng (href, label, icon, roles).
4. **RLS**: Trong Supabase, policy dùng `has_admin_role(ARRAY['super_admin'::admin_role, 'auditor'::admin_role])`; cập nhật migration và script idempotent. Enum `admin_role` trong DB phải có giá trị mới (migration).

### 2.3 Thêm repository / adapter mới (ví dụ checkout từ nguồn khác)

1. **Port**: Interface đã có trong `lib/domain/<domain>/ports.ts`.
2. **Adapter**: Tạo `adapters/<tên>/` (ví dụ `adapters/rest/`) implement port; export từ `adapters/<tên>/index.ts`.
3. **Factory**: Trong `lib/domain/<domain>/index.ts`, thêm cách chọn implementation (env hoặc tham số). Hiện tại các domain mặc định Supabase; có thể thêm `CREATE_CHECKOUT_REPOSITORY=supabase|rest` và gọi factory tương ứng.

### 2.4 Server actions – chuẩn hóa response

Dùng `ActionResult<T>` và `ok()` / `fail()` từ `@/lib/action-result` để client xử lý thống nhất:

```ts
import { ok, fail } from "@/lib/action-result";

export async function myAction(): Promise<ActionResult<{ id: string }>> {
  const guard = await requireDocumentManagerContext();
  if (!guard.ok) return fail(guard.error);
  // ...
  return ok({ id: "..." });
}
```

Client: `if (result.ok) { ... result.data } else { ... result.error }`. `loginWithPassword` và `registerDeviceAndSession` trong `app/login/actions.ts` đã dùng `ActionResult<void>`; các action khác (checkout, admin, …) dùng `ActionResult` tương tự nơi có thể.

### 2.5 Luồng truy cập tài liệu (signed URL / PDF)

| Entrypoint | Auth | Mục đích |
|------------|------|----------|
| `POST /api/secure-pdf` | Cookie (Supabase session) | **Secure Reader** trong app — stream PDF, rate limit + audit. |
| `POST /api/secure-link` | Cookie | Trả JSON `{ url }` signed URL (60s); cùng quy tắc thiết bị / phiên / quyền; dùng chung `src/lib/secure-access/secure-access-core.ts`. |
| Edge `get-secure-link` | `Authorization: Bearer <JWT>` | Client ngoài web (mobile, tích hợp); có thể tạo `active_sessions` nếu chưa có; cập nhật `usage_stats`. |

**Nguồn sự thật cho quy tắc nghiệp vụ** (giới hạn thiết bị, quyền, ngưỡng rate limit mặc định): [`src/lib/secure-access/secure-access-core.ts`](src/lib/secure-access/secure-access-core.ts). Sau khi sửa file này, chạy **`npm run sync:secure-access`** để đồng bộ sang Edge (`supabase/functions/get-secure-link/secure-access-core.ts`), rồi `supabase functions deploy get-secure-link`.

Kế hoạch và vận hành chi tiết: [`docs/SECURE-ACCESS-SYNC.md`](docs/SECURE-ACCESS-SYNC.md).

---

## 3. Quy ước tích hợp

- **Imports**: Dùng alias `@/` cho code trong `src`; test chạy Node có thể dùng relative (ví dụ `../types`) nếu module được test import từ file dùng `@/`.
- **Env**: Biến nhạy cảm không đưa vào `NEXT_PUBLIC_*`. Provider/feature chọn qua env (PAYMENT_PROVIDER, …); allowlist và log warning khi giá trị không hợp lệ.
- **Types**: Entity và enum dùng chung (Order, Profile, AdminRole) đặt ở `lib/types.ts`; port-specific types ở `domain/*/ports.ts`.
- **Errors**: Server action trả về `{ ok: false, error: string }`; không throw trừ lỗi không mong đợi. API route trả HTTP status và body `{ error?: string }`.

---

## 4. Tài liệu liên quan

- **README.md**: Setup, payment flow, cấu trúc chính.
- **RUNBOOK.md**: Vận hành, webhook lỗi, user khóa, migration, cron.
- **TESTING.md**: Cấu trúc test, integration, env cho test.
