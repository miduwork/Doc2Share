# Release checklist – Doc2Share

Dùng trước khi deploy production hoặc merge nhánh release.

## Dependencies

- Chạy `npm outdated` (hoặc Dependabot) và xem changelog cho **Next.js**, **React**, `@supabase/*`, `typescript`.
- Ưu tiên bản **patch/security** khi có CVE; major nên lên có kế hoạch, chạy đủ `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e` (khi có env).

## Secure access (đọc tài liệu)

- Mọi thay đổi logic trong [`src/lib/secure-access/secure-access-core.ts`](../src/lib/secure-access/secure-access-core.ts):
  1. `npm run sync:secure-access`
  2. Kiểm tra diff Edge function
  3. `supabase functions deploy get-secure-link`

## SePay / VietQR

- Mọi thay đổi logic parse webhook trong [`src/lib/payments/sepay-webhook-core.ts`](../src/lib/payments/sepay-webhook-core.ts):
  1. `npm run sync:sepay`
  2. Kiểm tra diff Edge function
  3. `supabase functions deploy payment-webhook`
- Xác nhận Secret `WEBHOOK_SEPAY_API_KEY` trên Supabase khớp SePay.

## Kiểm tra tối thiểu (local hoặc CI)

- `npm run lint`
- `npm run test`
- `npm run build` (có `.env.local` hoặc biến build tương đương)
- (Tùy chọn) `npm run test:integration` với Supabase local
- (Tùy chọn) `npm run test:e2e` với app chạy và biến `E2E_*` — xem [`TESTING.md`](../TESTING.md)

## Lịch gợi ý

- **Hàng quý**: rà soát phiên bản Next/Supabase, chạy checklist trên.
- **Sau mỗi thay đổi migration**: backup DB production (nếu áp dụng), xem [`RUNBOOK.md`](../RUNBOOK.md) mục rollback.
