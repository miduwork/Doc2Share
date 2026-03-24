# Kế hoạch refactor Admin > Observability

## 1) Mục tiêu refactor

- Tách rõ boundary giữa `page wiring`, `data orchestration`, và `UI presentation`.
- Giảm coupling giữa `src/app/admin/observability/*` và các chi tiết query Supabase.
- Chuẩn hóa luồng vận hành: KPI -> alerts -> capacity -> maintenance -> export/share.
- Tăng khả năng test theo từng lớp, giảm rủi ro khi thay đổi preset/filter/export.
- Giữ nguyên behavior nghiệp vụ hiện tại trong giai đoạn đầu (no-regression first).

## 2) Vấn đề hiện tại cần xử lý

- `load-observability-data.ts` đang gánh nhiều trách nhiệm: parse search params, verify signed link, query nhiều nguồn dữ liệu, build export href.
- Logic filter/preset/query-string/cursor nằm rải rác giữa `utils.ts`, server loader, và UI section.
- Export routes (`export/alerts`, `export/maintenance`) lặp lại một phần logic verify chữ ký + normalize query.
- Server action (`actions.ts`) chứa cả orchestration, side effect webhook, và hạ tầng tạo signed diagnostics link.
- Chưa có hợp đồng dữ liệu theo use-case (dashboard read model, export criteria, maintenance command) đủ tách biệt để test độc lập.

## 3) Thiết kế mục tiêu sau refactor

- **Application layer (use-case oriented)**
  - `observability-dashboard.service.ts`: trả `AdminObservabilityDashboardData` cho page.
  - `observability-export.service.ts`: chuẩn hóa input filter và trả dữ liệu export.
  - `observability-diagnostics.service.ts`: tạo/verify signed diagnostics context.
  - `observability-maintenance.service.ts`: chạy maintenance + publish alert webhook.
- **Domain contracts**
  - Định nghĩa rõ command/query DTO:
    - `ObservabilityFilters`
    - `ObservabilityPagination`
    - `ObservabilityExportRequest`
    - `RunMaintenanceCommand`
  - Tách mapper/normalizer thuần cho preset/filter/querystring.
- **Infrastructure adapters**
  - Repository hiện tại (`createObservabilityAdminRepository`) mở rộng theo nhu cầu đọc dashboard/export.
  - Mọi truy vấn Supabase nằm trong adapter/repository, không nằm trong page/action.
- **UI layer**
  - `ObservabilityPageView` và các section chỉ nhận props đã chuẩn hóa.
  - Hạn chế truyền state “raw URL params”; ưu tiên view-model rõ nghĩa.

## 4) Lộ trình thực hiện

1. **Chuẩn hóa contracts và naming**
   - Tạo `admin-observability.types.ts` (hoặc tương đương) cho DTO dùng xuyên suốt.
   - Chốt enum/union cho preset/window/severity/source default.
2. **Extract dashboard orchestration**
   - Di chuyển logic từ `load-observability-data.ts` sang `observability-dashboard.service.ts`.
   - `page.tsx` chỉ: guard -> gọi service -> render.
3. **Tách diagnostics + chữ ký share link**
   - Gom sign/verify payload vào service riêng để tái sử dụng cho page và export routes.
   - Giảm duplicate logic `share_exp/share_sig` ở nhiều entrypoint.
4. **Refactor export pipeline**
   - Tạo luồng dùng chung cho parse filter + authorize + fetch export rows + CSV serialize.
   - Giữ 2 route export riêng, nhưng dùng chung service/core.
5. **Refactor maintenance command**
   - Tách `runMaintenanceNow` thành command handler có thể test mock repository/webhook client.
   - Giữ `actions.ts` mỏng, chỉ nhận input và trả `ActionResult`.
6. **Tối ưu UI section boundaries**
   - Rà lại props từng section (`KPI`, `Alerts`, `Capacity`, `Runs`) để loại dữ liệu dư thừa.
   - Chuẩn bị khả năng tách các panel thành feature modules nếu tiếp tục mở rộng.
7. **Test + regression**
   - Bổ sung unit test cho normalizer/filter/cursor/signature payload.
   - Integration test cho dashboard load, export auth, maintenance action.

## 5) Kế hoạch test sau refactor

- **Unit**
  - Parse search params: defaults, clamp, preset overrides.
  - Build/verify signed diagnostics payload với expiry.
  - Cursor pagination logic (`nextCursor`/`prevCursor`) không lệch chiều.
  - CSV serialization escape đúng với dữ liệu metadata có dấu phẩy/dấu nháy.
- **Integration**
  - `/admin/observability` trả đủ block dữ liệu khi filter khác nhau.
  - Export routes: signed link hợp lệ cho phép tải; link hết hạn bị chặn.
  - `runMaintenanceNow` ghi nhận runId/alertsCount/deletedTotal đúng contract.
- **Regression UX**
  - Preset buttons vẫn đưa đúng tổ hợp filter.
  - Alert table, runs pagination, export limit selector hoạt động như trước.
  - Signed diagnostics message hiển thị đúng trạng thái valid/expired.

## 6) Tiêu chí hoàn thành

- `page.tsx` và `actions.ts` mỏng, không chứa query/logic hạ tầng lớn.
- Logic share signature và export authorization không bị lặp giữa các route.
- Contracts dữ liệu rõ ràng, testable, và được dùng nhất quán từ service -> UI.
- Không thay đổi behavior nghiệp vụ hiện hữu (chỉ cải thiện cấu trúc/bảo trì).
- Build/lint/test liên quan Admin Observability đều xanh.

## 7) Gợi ý chia PR nhỏ (ít rủi ro merge)

- PR1: Chuẩn hóa types/contracts + extract dashboard service (không đổi UI).
- PR2: Tách diagnostics/signature service + update page/export dùng chung.
- PR3: Refactor export services + CSV pipeline + test integration export.
- PR4: Tách maintenance command handler + webhook notifier abstraction + tests.
- PR5: Dọn props UI sections, tối ưu readability, bổ sung docs vận hành.

## 8) Rủi ro và hướng giảm thiểu

- **Rủi ro lệch filter behavior:** khóa test regression theo preset/filter matrix trước khi đổi lớn.
- **Rủi ro lỗi phân quyền export:** giữ guard check hiện tại, thêm test signed-vs-auth paths.
- **Rủi ro thay đổi payload share link:** version hóa payload key nếu cần mở rộng về sau.
- **Rủi ro query hiệu năng kém:** theo dõi thời gian tải dashboard cho mốc 24h/7d trước-sau refactor.
