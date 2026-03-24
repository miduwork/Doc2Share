# Danh sách kiểm tra dọn dẹp (Cleanup checklist)

Tài liệu này liệt kê các file/thư mục đã rà soát và gợi ý kiểm tra thêm để dọn dẹp codebase.

---

## 1. Đã kiểm tra – không có file thừa

| Vị trí | Kết quả |
|--------|---------|
| **`src/`** | Đã xóa 4 nhóm mock adapter không dùng (checkout, observability, documents, document-pipeline). Các file còn lại đều có reference (import hoặc entry point). |
| **`public/`** | Thư mục không tồn tại → không có asset tĩnh cần dọn. |
| **`supabase/functions/`** | Cả hai function đều được dùng: `payment-webhook` (SePay), `get-secure-link` (SecureReader gọi). Các file trong `providers/` (sepay, sepay-core, types, index) đều được dùng. |

---

## 2. Gợi ý kiểm tra / hành động tiếp theo

### 2.1 `supabase/scripts/`

| File | Mục đích | Gợi ý |
|------|----------|--------|
| `run-full-schema-idempotent.sql` | Schema đầy đủ, chạy 1 lần (môi trường mới). | ✅ Giữ. Đã được nhắc trong RUNBOOK. |
| `drop-all-schema.sql` | Xóa toàn bộ schema public; chạy trước khi chạy lại run-full-schema. | ✅ Giữ. Được nhắc trong chính file và RUNBOOK. |
| `promote-user-to-admin.sql` | Hướng dẫn + mẫu SQL nâng user lên admin. | ✅ Giữ. Đã thêm tham chiếu trong README (mục Admin & RBAC) và RUNBOOK (mục 4.1 Scripts). |
| `fix-after-orders-exists.sql` | Chạy khi lỗi "relation orders already exists" (bảng trước orders đã có, thiếu từ orders trở đi). | ✅ **Đã chuyển** vào `supabase/scripts/archive/`. Migrations hiện tại (`20250220000001_initial_schema.sql`) đã có đủ `orders`/order_items; script chỉ dùng để sửa môi trường lỗi cũ. RUNBOOK đã có mục 4.1 liệt kê scripts. |

### 2.2 `supabase/migrations/`

- **Không xóa hay sửa nội dung** file migration đã chạy (ảnh hưởng lịch sử Supabase).
- Chỉ nên thêm migration mới để hoàn tác thay đổi (theo RUNBOOK).
- Có thể rà lại tên file / thứ tự để đảm bảo dễ đọc (không bắt buộc).

### 2.3 Thư mục rỗng sau khi xóa mock

✅ **Đã xóa** 4 thư mục rỗng: `checkout/adapters/mock`, `observability/adapters/mock`, `documents/adapters/mock`, `document-pipeline/adapters/mock`. (Giữ lại `document-upload/adapters/mock/` vì dùng trong test.)

### 2.4 Cấu hình / môi trường

| Mục | Gợi ý |
|-----|--------|
| `.env.local.example` | Giữ làm mẫu; đảm bảo có đủ biến được dùng trong README/RUNBOOK (Supabase, Edge, VIETQR, DIAGNOSTICS_SHARE_SECRET, INTERNAL_CRON_SECRET). |
| `.env.local` | Không commit; không cần "dọn" trong repo. |

### 2.5 Tài liệu gốc (root)

- `README.md`, `ARCHITECTURE.md`, `RUNBOOK.md`, `TESTING.md`: **Giữ** – đều được tham chiếu hoặc cần cho vận hành.
- Khi thêm/xóa script hoặc flow quan trọng, nên cập nhật RUNBOOK hoặc README tương ứng.

---

## 3. Đã thực hiện (kiểm tra tiếp)

1. **Scripts**: `fix-after-orders-exists.sql` đã chuyển vào `supabase/scripts/archive/`; thêm `archive/README.md` giải thích. RUNBOOK có mục 4.1 liệt kê scripts; README mục Admin & RBAC tham chiếu `promote-user-to-admin.sql`.
2. **Thư mục rỗng**: Đã xóa 4 thư mục mock rỗng (checkout, observability, documents, document-pipeline).
3. **Sau này**: Khi thêm script/migration/function mới, cập nhật RUNBOOK hoặc CLEANUP-CHECKLIST nếu cần.

---

## 4. Đợt dọn sâu (codebase sạch)

- **`src/lib/seo.ts`**: Xóa export `buildDocSlug` (không được import ở đâu; chỉ `slugify` được dùng).
- **`package.json`**: Xóa dependency **`react-pdf`** — app dùng iframe với signed URL để xem PDF (SecureReader), không dùng thư viện react-pdf. Đã chạy `npm install` (gỡ 39 packages).
- **Build & test**: Đã kiểm tra `npm run build` thành công sau khi dọn.

---

## 5. Rà theo CLEANUP-CHECKLIST: lib/types và domain exports

### 5.1 `src/lib/types.ts` — đã cắt type không dùng

| Giữ lại (có import từ @/lib/types) | Đã xóa (không file nào import) |
|-----------------------------------|--------------------------------|
| `CategoryType`, `ProfileRole`, `AdminRole`, `Category` | `OrderStatus`, `Document`, `Profile`, `Permission`, `DeviceLog`, `Order`, `OrderItem` |

- **Lý do**: Chỉ 4 thứ trên được import (Category: AdminDocumentsClient, DocumentCard, DiscoveryFilters, UploadDocument; AdminRole: AdminNav, guards; ProfileRole: useUserRole). Các type Order/OrderItem/Profile/Document/Permission/DeviceLog không được import từ @/lib/types (AdminUserDetailClient/AdminUsersClient dùng interface local). Type order/checkout dùng từ `@/lib/domain/checkout/ports` (CheckoutOrderStatus, CreateCheckoutOrderResult, …).
- Đã thêm comment đầu file: chỉ giữ type thực sự dùng; order/checkout nằm ở domain.

### 5.2 Domain exports — đã rà, giữ nguyên

- **document-upload**: Các type (DocumentUploadPayload, UploadedPath, …) và runDocumentUploadOrchestrator / createSupabase* được dùng trong upload-actions, orchestrator, adapters. Re-export từ index đúng với cách dùng.
- **checkout**: CheckoutRepository, CreateCheckoutOrderResult, CheckoutOrderMeta, CheckoutOrderStatus dùng trong actions và adapter. createCheckoutRepository() và re-export createSupabaseCheckoutRepository giữ cho DI.
- **documents**: DocumentPublishGate, DocumentRetryContext, UpdateDocumentAdminInput, DocumentsAdminRepository dùng trong manage-actions và adapter. Giữ nguyên.
- **observability**: ObservabilityAdminRepository và createObservabilityAdminRepository dùng trong actions. Giữ nguyên.
- **document-pipeline**: DocumentPipelineRepository, DocumentPipelineTickResult và createDocumentPipelineRepository dùng trong route và adapter. Giữ nguyên.

Không xóa thêm export nào ở domain; chỉ ghi nhận đã rà.

---

## 6. Rà toàn bộ codebase — đợt dọn tiếp

### 6.1 Export không dùng

- **`src/lib/action-result.ts`**: Xóa **`isOk`** — không file nào import; type guard có thể thay bằng `result.ok === true`.

### 6.2 Trùng lặp logic — gom về một chỗ

- **UUID validation**: `manage-actions.ts` và `checkout/actions.ts` đều có `UUID_RE` + hàm kiểm tra/trim giống nhau.
- **Đã tạo** `src/lib/uuid.ts` với `isValidUuid(value)` và `normalizeUuid(value)` (regex UUID chuẩn, trim an toàn).
- **Đã cập nhật** `manage-actions.ts`: xóa `UUID_RE`, `isValidUuid`, `normalizeUuid` local; import từ `@/lib/uuid`.
- **Đã cập nhật** `checkout/actions.ts`: xóa `UUID_RE`; import `isValidUuid` từ `@/lib/uuid`; thay `UUID_RE.test(...)` bằng `isValidUuid(...)`.

### 6.3 Kiểm tra

- **Build**: `npm run build` thành công.
- **Test**: `npm run test` — 34 tests pass.

---

## 7. Rà `app/` và `components/` — import & comment

### 7.1 Import không dùng

- Đã rà lần lượt file trong **`src/app/`** và **`src/components/`** (admin, checkout, dashboard, login, product, secure-reader; components gồm admin, discovery, layout, ui).
- **Kết quả**: Các import đã kiểm tra (lucide-react, cookies, headers, createClient, createServiceRoleClient, Resolver, viewCount, Activity/AlertTriangle/Database/Wrench, v.v.) đều **có sử dụng** trong file.
- Không phát hiện import thừa; không có dòng code bị comment-out (ví dụ `// import ...` hay `// return`).

### 7.2 Block comment dài

- Tìm kiếm JSDoc/block comment (`/**`, `/*`) trong `app/` và `components/`:
  - **`src/app/admin/documents/upload-actions.ts`**: Một JSDoc ~4 dòng cho `uploadDocumentWithMetadata` — mô tả rõ, **giữ**.
  - **`src/app/login/actions.ts`**: Một JSDoc ~4 dòng cho `registerDeviceAndSession` — mô tả rõ, **giữ**.
- **components/**: Không có block comment dài; không có khối comment “dead code”.
- **Kết luận**: Không có block comment dài cần xóa hoặc rút gọn.

### 7.3 Gợi ý sau này

- Nếu muốn bắt import không dùng tự động: cấu hình ESLint (ví dụ `eslint-config-next` hoặc rule `@typescript-eslint/no-unused-vars`) rồi chạy `npm run lint`.

---

## 8. Đánh giá toàn diện (re-assessment)

- **Tài liệu chi tiết:** Xem **`CLEANUP-ASSESSMENT.md`** — đánh giá lại toàn bộ codebase (cấu trúc, chất lượng code, config, docs) và khuyến nghị theo ưu tiên.
- **Tóm tắt:**
  - **Đã ổn:** Domain rõ ràng, không dead code, type/export gọn, UUID + SePay single source, server actions nhất quán, app/components đã rà import & comment.
  - **Đã làm (ưu tiên cao):** (1) Cấu hình ESLint — `.eslintrc.json` (next/core-web-vitals + no-unused-vars). (2) README mục Environment — tham chiếu `.env.local.example` cho đủ biến.
  - **Đã làm (ưu tiên trung bình):** (3) Tách observability: `types.ts`, `utils.ts`, `KpiCard.tsx`; page ~557 dòng. (4) Tách AdminDocumentsClient: `admin-documents.types.ts`, `DocumentFilters`, `BulkActionsBar`, `DocumentTable`, `EditDocumentModal`; client ~265 dòng.
  - **Đã làm (tiếp):** (5) RUNBOOK mục 4.2 — bảng scripts gốc `scripts/sync-sepay-core.mjs`, khi nào chạy `npm run sync:sepay`, deploy sau sync. README mục SePay webhook — dòng tham chiếu sync + deploy. (6) ESLint: đã xử lý toàn bộ warning (no-unused-vars: prefix `_`, bỏ import Tag, chỉnh re-export guards; jsx-a11y: Image → ImageIcon + aria-hidden; no-img-element: eslint-disable-next-line có comment; exhaustive-deps: disable có comment trong useUserRole). `npm run lint` không còn warning.
