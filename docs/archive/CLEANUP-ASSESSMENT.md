# Đánh giá toàn diện – Dọn dẹp & tối ưu codebase Doc2Share

Tài liệu này đánh giá lại toàn bộ codebase từ góc nhìn dọn dẹp, tối ưu và bảo trì lâu dài. Tham chiếu thêm: `CLEANUP-CHECKLIST.md` (các đợt đã thực hiện).

---

## 1. Tổng quan kết quả đã làm (theo CLEANUP-CHECKLIST)

| Hạng mục | Trạng thái |
|----------|------------|
| File/thư mục thừa | Đã xóa 4 nhóm mock adapter không dùng; không có `public/`; functions đều được dùng. |
| Scripts / archive | `fix-after-orders-exists.sql` đã chuyển vào `archive/`; RUNBOOK/README cập nhật. |
| Thư mục rỗng | Đã xóa 4 thư mục mock rỗng. |
| lib/types.ts | Chỉ còn CategoryType, ProfileRole, AdminRole, Category; type order/checkout ở domain. |
| Domain exports | Đã rà; không xóa thêm export. |
| action-result | Đã xóa `isOk`; dùng `result.ok === true`. |
| UUID logic | Gom về `src/lib/uuid.ts`; manage-actions và checkout/actions dùng chung. |
| buildDocSlug / react-pdf | Đã xóa. |
| app/ & components/ | Đã rà import và block comment; không phát hiện thừa. |

**Kết luận ngắn:** Phần “dọn sâu” đã làm tốt: không còn dead code rõ ràng, type và domain gọn, một nguồn sự thật cho UUID và SePay core.

---

## 2. Cấu trúc dự án

### 2.1 Điểm mạnh

- **Phân tầng rõ:** `lib/domain/` theo từng bounded context (checkout, documents, document-upload, observability, document-pipeline) với ports + adapters; server actions dùng `ActionResult<T>`, `ok`/`fail`.
- **Một nguồn sự thật:** SePay logic trong `src/lib/payments/sepay-webhook-core.ts`, sync sang Edge qua `scripts/sync-sepay-core.mjs`; UUID trong `src/lib/uuid.ts`.
- **Entry point rõ:** App Router nhất quán (page/layout/error); API route ít (document-pipeline run, observability export).
- **Không trùng tên thư mục,** không có folder kiểu `old/`, `backup/`, `temp/`.

### 2.2 Cần lưu ý

- **Hai file rất lớn (nên tách dần):**
  - `src/app/admin/observability/page.tsx` (~768 dòng): Server Component, chứa nhiều type (MetricRow, CapacityRow, SearchParams…), helper (pickSingle, getSinceIso, toQueryString, clampInt, formatBytes, formatTime, severityClass, getPresetDefaults, fetchAlertsByCursor, parseCursor, encodeCursor), và component nội bộ (KpiCard). Có thể tách: types + helpers → `observability/utils.ts` hoặc `observability/helpers.ts`; KpiCard → `components/admin/KpiCard.tsx` hoặc `observability/KpiCard.tsx`; phần fetch/query → giữ trong page hoặc data layer.
  - `src/components/admin/AdminDocumentsClient.tsx` (~713 dòng): Client Component với nhiều state (docs, activeTab, editingDocId, editForm, selectedDocIds, bulkAction, bulkRejectNote), nhiều handler (updateDoc, removeDoc, hardDeleteDoc, changeStatus, retryProcessing, runBulk, submitApproval, approve, reject, openEditModal, saveEditModal, toggleDoc, buildQuery) và UI (filter form, bảng, tab CRUD/Ops, modal). Có thể tách: hooks (useDocumentActions, useFiltersQuery); subcomponents (DocumentTable, DocumentFilters, BulkActionsBar, EditDocumentModal); types (DocRow, JobRow, FiltersState) ra file riêng.
- **Root `scripts/`:** Chỉ có `sync-sepay-core.mjs`. Nên ghi trong README hoặc RUNBOOK (hoặc `scripts/README.md`) mục đích và khi nào chạy `npm run sync:sepay`.

---

## 3. Chất lượng code

### 3.1 Nhất quán

- Server actions đều trả về `ActionResult<T>`, client dùng `result.ok` / `result.data` / `result.error`.
- Domain: ports (interface + types) + adapters (Supabase/mock) rõ ràng; factory `create*Repository()` dùng thống nhất.
- Admin: guards (`requireSuperAdminContext`, `requireDocumentManagerContext`, …) dùng đúng chỗ.

### 3.2 Trùng lặp / tái sử dụng

- **Đã xử lý:** UUID (lib/uuid), SePay core (sync script).
- **Còn có thể gom (ưu tiên thấp):** Các helper format (formatTime, formatBytes, formatCount) hiện chỉ dùng trong observability page; nếu sau này dùng thêm nơi khác có thể đưa vào `lib/format.ts` hoặc tương đương. Không bắt buộc ngay.

### 3.3 Type & export

- `lib/types.ts` gọn, chỉ type dùng chung (Category, role).
- Domain exports đã rà; không thừa.
- Không phát hiện export không dùng trong app/components sau đợt rà 7.

### 3.4 Comment & doc

- JSDoc ngắn ở upload-actions và login/actions; không block comment dài hoặc dead comment.

---

## 4. Cấu hình & tài liệu

### 4.1 Env

- `.env.local.example` có đủ: Supabase, PAYMENT_PROVIDER, VietQR, WEBHOOK_SEPAY_API_KEY, DIAGNOSTICS_SHARE_SECRET, INTERNAL_CRON_SECRET, APP_URL/community (optional).
- README mục Setup nhắc `.env.local` và Edge Secrets (WEBHOOK_SEPAY_API_KEY). Có thể bổ sung trong README một dòng tham chiếu “chi tiết biến môi trường xem `.env.local.example`” để đồng bộ dễ hơn.

### 4.2 ESLint

- `next lint` hiện có thể kích hoạt wizard cấu hình (dự án chưa có eslint config trong repo). Nên thiết lập ESLint (ví dụ `eslint-config-next`) và bật rule `@typescript-eslint/no-unused-vars` (hoặc tương đương) để tự động bắt import/biến không dùng sau này.

### 4.3 Migrations & scripts

- Migrations không sửa nội dung đã chạy; script archive có README. RUNBOOK mục 4.1 liệt kê scripts. Ổn định.

---

## 5. Supabase & Edge

- **payment-webhook:** Logic SePay dùng chung với Node (sepay-webhook-core sync); idempotency và flow rõ.
- **get-secure-link:** Được SecureReader gọi; không phát hiện dead code.
- **scripts/archive:** Rõ ràng là lưu trữ; giữ hoặc xóa khi chắc chắn không còn môi trường cũ.

---

## 6. Khuyến nghị hành động (theo ưu tiên)

### Ưu tiên cao (nên làm)

1. **Cấu hình ESLint**  
   ✅ **Đã làm.** Thêm `.eslintrc.json` (extends `next/core-web-vitals`, rule `no-unused-vars` warn với `argsIgnorePattern`/`varsIgnorePattern` `^_`). Chạy `npm run lint` để kiểm tra; có thể xử lý dần các warning (unused args trong ports → prefix `_`, v.v.).

2. **README env**  
   ✅ **Đã làm.** Trong mục Setup → Environment đã thêm câu tham chiếu “Xem `.env.local.example` để biết đầy đủ biến môi trường”.

### Ưu tiên trung bình (cải thiện bảo trì)

3. **Tách nhỏ observability page**  
   ✅ **Đã làm.** Types → `src/app/admin/observability/types.ts`; helpers + fetchAlertsByCursor → `src/app/admin/observability/utils.ts`; component `KpiCard` → `src/components/admin/KpiCard.tsx`. Page chỉ còn data fetch + composition (~557 dòng).

4. **Tách nhỏ AdminDocumentsClient**  
   ✅ **Đã làm.** Types → `src/components/admin/admin-documents.types.ts`; UI tách thành `DocumentFilters.tsx`, `BulkActionsBar.tsx`, `DocumentTable.tsx`, `EditDocumentModal.tsx`; `AdminDocumentsClient.tsx` chỉ còn state + handlers + composition (~265 dòng).

5. **Scripts/README hoặc RUNBOOK**  
   ✅ **Đã làm.** RUNBOOK mục 4.2 bảng scripts gốc; README mục SePay webhook — khi nào chạy `npm run sync:sepay`, deploy sau sync.

### Ưu tiên thấp (tùy chọn)

6. **Gom format helpers**  
   Chỉ khi formatTime/formatBytes/formatCount được dùng thêm ở trang khác thì mới tách vào `lib/format.ts` (hoặc tương đương).

7. **Archive**  
   Khi chắc không còn môi trường cần `fix-after-orders-exists.sql`, có thể xóa hẳn `supabase/scripts/archive/` hoặc chỉ giữ trong tài liệu.

8. **ESLint warnings**  
   ✅ **Đã xử lý.** no-unused-vars (prefix `_`, bỏ import Tag, re-export guards chỉ import dùng nội bộ); jsx-a11y (Image → ImageIcon + aria-hidden); no-img-element (eslint-disable-next-line có comment); react-hooks/exhaustive-deps (disable có comment useUserRole). `npm run lint` không còn warning.

---

## 7. Tóm tắt một dòng

- **Đã tốt:** Cấu trúc domain rõ, không dead code rõ ràng, type/export gọn, UUID và SePay một nguồn, server actions nhất quán, app/components đã rà import và comment.
- **Nên làm tiếp:** Bật ESLint (no-unused-vars), cập nhật README env, tách hai file lớn (observability page, AdminDocumentsClient), ghi rõ script sync SePay trong docs.
