# QR2Print

## Kiến trúc dữ liệu (Supabase + Next.js)

### Kiến trúc Supabase client (file nào dùng khi nào)

Dự án dùng **nhiều client** — không phải lỗi; mỗi file phục vụ một luồng. Tránh “gộp import” mà không đọc bảng dưới.

| File | Mục đích | Gọi từ (ví dụ) |
|------|----------|----------------|
| [`lib/supabase.ts`](lib/supabase.ts) | Một instance **anon**, **không** gắn cookie — phù hợp Realtime trên client công khai | [`lib/orders/realtime.ts`](lib/orders/realtime.ts) → trang [`/payment/[id]`](app/payment/[id]/page.tsx) qua `subscribeOrderUpdates` |
| [`lib/supabase/client.ts`](lib/supabase/client.ts) | `createBrowserClient` (`@supabase/ssr`) — đồng bộ session Auth với cookie | [`app/login/page.tsx`](app/login/page.tsx), [`AdminLogoutButton`](components/AdminLogoutButton.tsx) |
| [`lib/supabase/server.ts`](lib/supabase/server.ts) | `createServerClient` + `cookies()` — API cần JWT admin | [`app/api/admin/orders`](app/api/admin/orders/route.ts), [`app/api/admin/orders/[id]`](app/api/admin/orders/[id]/route.ts) |
| [`lib/supabase/admin.ts`](lib/supabase/admin.ts) | **Service role** — bỏ qua RLS | Webhook, insert đơn server, ký upload, … |
| [`middleware.ts`](middleware.ts) | `createServerClient` trên request — refresh session, bảo vệ `/admin` và `/login` | — |

**Tại sao trang thanh toán khác admin**

- **Thanh toán (public, không đăng nhập):** Realtime chỉ cần **anon key** để subscribe cập nhật đơn; **không** cần session Supabase Auth trong cookie. Singleton [`lib/supabase.ts`](lib/supabase.ts) là **cố ý** — đơn giản, ổn định cho `channel`, tránh lẫn với luồng đăng nhập.
- **Admin / đăng nhập:** Cần **cookie + JWT**; dùng [`lib/supabase/client.ts`](lib/supabase/client.ts) (trình duyệt) và [`lib/supabase/server.ts`](lib/supabase/server.ts) (API), cùng [`middleware.ts`](middleware.ts).

**Không nên**

- Đổi [`lib/orders/realtime.ts`](lib/orders/realtime.ts) sang `createClient` từ `lib/supabase/client.ts` chỉ để “thống nhất import” nếu chưa nắm hệ quả (lifecycle / cookie Auth khác singleton anon).
- Dùng singleton [`lib/supabase.ts`](lib/supabase.ts) cho login hoặc thao tác admin — thiếu đồng bộ session với SSR.

### Khách (trang chủ, form đặt in)

- **HTTP**: `POST /api/orders` ([app/api/orders/route.ts](app/api/orders/route.ts)).
- **Server**: dùng **service role** (`SUPABASE_SERVICE_ROLE_KEY`) qua [`createAdminClient`](lib/supabase/admin.ts) — bỏ qua RLS, phù hợp upload/insert an toàn từ server.
- Không gọi trực tiếp mutation nhạy cảm từ browser với quyền admin.

### Admin (trang `/admin`)

- **Browser**: session Supabase Auth trong cookie (`credentials` khi gọi API).
- **Hook**: [`useOrdersList`](hooks/useOrdersList.ts) (context [`AdminOrdersProvider`](components/admin/AdminOrdersProvider.tsx)) gọi [`GET /api/admin/orders`](app/api/admin/orders/route.ts), [`GET /api/admin/stats`](app/api/admin/stats/route.ts) (thống kê + `max_created_at` cho badge), và [`GET` / `PATCH` `/api/admin/orders/[id]`](app/api/admin/orders/[id]/route.ts) — cùng logic với [`listOrdersForAdminWithClient` / `updateOrderForAdminWithClient`](lib/orders/adminOrderData.ts) trên server.
- **Route UI:** **`/admin` → `/admin/orders`** (redirect); dashboard **`/admin/dashboard`**; chi tiết đơn **`/admin/orders/[id]`**. Điều hướng và badge « đơn mới » trong [`AdminShell`](components/admin/AdminShell.tsx).
- **Lọc / tìm (danh sách):** trên trình duyệt — thanh toán (đã / chưa), trạng thái in, ô tìm theo SĐT, tên khách, hoặc 8 ký tự đầu mã đơn (UUID). Chi tiết: [`docs/ADMIN-PORTAL-PLAN.md`](docs/ADMIN-PORTAL-PLAN.md) §2 và §5.
- **Export:** CSV từ đơn **đang hiển thị sau lọc** (client), UTF-8 có BOM — nút trên trang danh sách.

### Row Level Security (RLS)

- **`authenticated`**: chỉ user có `app_metadata.role = 'admin'` mới được `SELECT`/`INSERT`/`UPDATE`/`DELETE` trên `orders` (xem migration trong `supabase/migrations/`).
- **`anon`**: `INSERT` cho form công khai; `SELECT` toàn bảng — **trade-off** cho Realtime trang thanh toán: ai có **anon key** có thể đọc mọi dòng `orders` qua PostgREST. Không coi anon là ranh giới bảo mật cho dữ liệu nhạy cảm.
- Webhook / job: **service role** (không đi qua RLS).

### Vận hành admin

1. Trong Supabase Dashboard → Authentication → Users: tạo user admin và set **App metadata** → `role`: `admin` (JSON: `{ "role": "admin" }`).
2. Biến môi trường: `.env.local` — xem [`.env.local.example`](.env.local.example).

### Mở rộng sau (admin API)

- Audit log, rate limit, side-effect — có thể bổ sung trong Route Handlers mà không đổi contract REST hiện tại.

---

## Deploy lên Vercel

Dự án là **Next.js 14** — Vercel nhận diện framework tự động; không cần `vercel.json`. Đã kiểm tra `npm run build` chạy được trên máy dev.

### 1. Đưa code lên GitHub

Trong thư mục project (đã có `git` và commit đầu tiên):

1. Tạo repository **trống** trên [GitHub](https://github.com/new) (không tick “Add README”).
2. Trong terminal tại thư mục dự án:

```bash
git remote add origin https://github.com/<user>/<repo>.git
git branch -M main
git push -u origin main
```

Thay `<user>/<repo>` bằng repo của bạn.

### 2. Kết nối Vercel

1. Đăng nhập [vercel.com](https://vercel.com) → **Add New…** → **Project**.
2. **Import** repository GitHub vừa push → **Deploy** (giữ mặc định: Framework Next.js, Build `next build`, Output mặc định).

### 3. Biến môi trường (bắt buộc)

Trong Vercel: **Project → Settings → Environment Variables** — thêm cho **Production** (và Preview nếu cần), bắt chước [`.env.local.example`](.env.local.example):

| Biến | Ghi chú |
|------|---------|
| `NEXT_PUBLIC_SITE_URL` | URL production có `https://`, ví dụ `https://your-app.vercel.app` hoặc domain tùy chỉnh. |
| `NEXT_PUBLIC_SUPABASE_URL` | Từ Supabase Dashboard → API. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon public key. |
| `NEXT_PUBLIC_PRICE_PER_PAGE` | Ví dụ `500`. |
| `NEXT_PUBLIC_VIETQR_BANK_ID` | Mã ngân hàng VietQR. |
| `NEXT_PUBLIC_VIETQR_ACCOUNT_NO` | Số tài khoản hiển thị QR. |
| `WEBHOOK_SEPAY_API_KEY` | Khớp cấu hình SePay Webhooks. |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** — chỉ server, không public. |

Các biến tùy chọn (`NEXT_PUBLIC_PICKUP_ADDRESS`, `NEXT_PUBLIC_FREESHIP_THRESHOLD_VND`, …) có trong `.env.local.example`.

Sau khi thêm/sửa biến: **Redeploy** (Deployments → … → Redeploy).

### 4. Domain và webhook SePay

- **HTTPS:** Vercel cấp tự động cho `*.vercel.app` và domain tùy chỉnh (**Settings → Domains**).
- Cập nhật lại `NEXT_PUBLIC_SITE_URL` khi đã có domain cuối cùng.
- SePay Webhooks URL: `https://<domain-của-bạn>/api/webhook/sepay` — xem thêm [supabase-setup.md](supabase-setup.md) §5.

### 5. Deploy bằng CLI (tùy chọn)

Nếu không dùng GitHub, có thể cài [Vercel CLI](https://vercel.com/docs/cli) và chạy `npx vercel` trong thư mục project (đăng nhập trình duyệt khi được hỏi); production: `npx vercel --prod`. Vẫn cần cấu hình env trên dashboard Vercel cho project đó.
