# Payment Setup File Map

Tai lieu nay tap hop cac file lien quan den setup thanh toan trong du an.

## 1) Bien moi truong va cau hinh

- `.env.local.example`
- `lib/config/server.ts`
- `lib/config/public.ts`
- `lib/config/business.ts`
- `lib/config/appConfigSchema.ts`
- `lib/config/appConfigSchema.test.ts`
- `lib/config/publicAppConfig.ts`
- `lib/orders/appConfig.server.ts`
- `next.config.mjs`

## 2) API va luong thanh toan

- `app/payment/[id]/page.tsx`
- `app/api/qr/route.ts`
- `app/api/webhook/sepay/route.ts`
- `app/api/public/config/route.ts`
- `app/api/admin/settings/route.ts`
- `lib/payments/vietqr.ts`
- `lib/webhooks/sepay.ts`
- `lib/webhooks/sepay.test.ts`

## 3) Logic tinh gia, tong tien, xac minh gia

- `lib/payments/pricing.ts`
- `lib/payments/pricing.test.ts`
- `lib/payments/pricingVerification.test.ts`
- `lib/payments/printSubtotal.ts`
- `lib/payments/printSubtotal.test.ts`
- `lib/payments/resolvePricePerPage.ts`
- `lib/payments/resolvePricePerPage.test.ts`
- `components/order-form/BookPrintPricingBreakdown.tsx`
- `hooks/useCreateOrderForm.ts`
- `lib/orders/createOrder.ts`
- `lib/orders/createOrder.test.ts`
- `lib/orders/createOrderFromRequest.ts`
- `lib/orders/orderFormParsing.ts`
- `lib/orders/delivery.ts`
- `lib/orders/repository.server.ts`
- `lib/orders/types.ts`
- `lib/types.ts`

## 4) Quan tri don va cap nhat payment status

- `app/api/admin/orders/[id]/route.ts`
- `lib/orders/adminPaymentPatch.ts`
- `components/admin/settings/AdminSettingsClient.tsx`
- `components/admin/settings/AdminSettingsPricingTab.tsx`
- `components/admin/settings/AdminSettingsDeliveryTab.tsx`
- `components/admin/settings/settingsTabTypes.ts`
- `components/admin/orders/AdminOrderNotePaymentEdit.tsx`
- `components/admin/orders/AdminOrderDetailView.tsx`
- `components/admin/orders/AdminOrderTableRow.tsx`
- `components/admin/orders/AdminOrdersTableHead.tsx`
- `components/admin/orders/adminOrderDisplay.ts`
- `components/admin/orders/list/AdminOrdersFiltersSection.tsx`
- `lib/orders/adminOrderData.ts`
- `lib/orders/adminOrderFilters.ts`
- `lib/orders/adminOrderListQuery.ts`
- `lib/orders/adminDashboardStats.ts`
- `lib/orders/adminStats.server.ts`
- `lib/admin/exportOrdersCsv.ts`

## 5) App config lien quan thanh toan/pricing (DB)

- `supabase/schema.sql`
- `supabase/reset_all.sql`
- `supabase/migrations/20260322140000_match_orders_by_id_prefix.sql`
- `supabase/migrations/20260323140000_app_config.sql`
- `supabase/migrations/20260323160000_app_config_catalog_delivery.sql`
- `supabase/migrations/20260323170000_app_config_default_mult_factors.sql`
- `supabase/migrations/20260324100000_app_config_binding_fee.sql`
- `supabase/migrations/20260324120000_admin_dashboard_stats_rpc.sql`

## 6) Tai lieu huong dan co lien quan

- `README.md`
- `supabase-setup.md`
- `HUONG-DAN-ADMIN.md`

## 7) UI/UX ho tro trang thanh toan

- `components/feedback/PaymentPageSkeleton.tsx`
- `components/feedback/SkeletonBar.tsx`

## 8) Ghi chu su dung

- Thu muc `docs/` dang duoc ignore boi `.gitignore`, phu hop de giu tai lieu noi bo.
- Neu can export danh sach nay cho GitHub, can bo ignore `docs/` hoac copy file sang thu muc khac.
