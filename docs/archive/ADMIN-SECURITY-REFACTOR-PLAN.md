# Kế hoạch refactor Admin > An ninh

## 1) Mục tiêu refactor

- Tách rõ 3 lớp: `data/query`, `risk+geo domain`, `UI presentation`.
- Giảm coupling giữa `page.tsx` và logic nghiệp vụ.
- Dễ test, dễ benchmark, dễ rollback từng phần.
- Chuẩn hóa luồng điều tra: log filters -> risk signals -> incident review -> benchmark.

## 2) Vấn đề hiện tại cần xử lý

- `src/app/admin/security/page.tsx` đang ôm nhiều trách nhiệm (fetch logs, compute risk, geo resolve, sync incidents).
- `AdminSecurityClient` đã lớn, chứa nhiều section và action logic.
- Logic benchmark/risk đang nằm rải rác, chưa có tầng orchestration rõ ràng.
- Chưa có chuẩn component boundary cho từng khối UI (Risk, Map, Incidents, Logs).

## 3) Thiết kế mục tiêu sau refactor

- **Server orchestration layer**
  - Tạo module như `src/lib/admin/security-dashboard.service.ts`.
  - Trả về một DTO duy nhất cho trang admin security.
- **Domain layer**
  - Giữ và chuẩn hóa:
    - `security-log-query.ts`
    - `security-risk.ts`
    - `ip-geo-resolver.ts`
  - Tách thêm helper nhỏ: `risk-normalization.ts`, `incident-sync.ts`, `benchmark-metrics.ts`.
- **UI layer**
  - Tách `AdminSecurityClient` thành các component:
    - `SecurityFiltersPanel`
    - `RiskUsersPanel`
    - `IpGeoPanel`
    - `IncidentsReviewPanel`
    - `AccessLogsPanel`
    - `SecurityLogsPanel`
  - Client chỉ giữ interaction state và action calls, không chứa transform data nặng.

## 4) Lộ trình thực hiện

1. **Stabilize API contracts**
   - Định nghĩa type `AdminSecurityDashboardData` cho dữ liệu page.
   - Chuẩn hóa kiểu dữ liệu giữa page/service/client.
2. **Extract orchestration khỏi page**
   - Di chuyển toàn bộ fetch/compute/sync vào `security-dashboard.service.ts`.
   - `page.tsx` chỉ: guard -> gọi service -> render.
3. **Tách UI thành section components**
   - Cắt dần từng section từ `AdminSecurityClient`.
   - Giữ behavior không đổi (same props/action endpoints).
4. **Refactor risk/geolocation internals**
   - Tách nhỏ các hàm tính điểm và normalize action thành pure utils.
   - Tối ưu xử lý bulk cho IP resolve/cache.
5. **Refactor incident + benchmark**
   - Tách logic incident review/sync thành module riêng.
   - Tách benchmark endpoint sang metric service dùng lại được.
6. **Test + regression**
   - Unit test cho module mới.
   - Snapshot/interaction test cho các section UI chính.
   - Verify benchmark endpoint và flows review không regress.

## 5) Kế hoạch test sau refactor

- **Unit**
  - score calculation, action normalization, proxy precision calc.
- **Integration**
  - dashboard service trả dữ liệu đầy đủ theo filter/cursor.
  - incident sync không duplicate.
- **UI**
  - filter/pagination/export vẫn hoạt động.
  - review incident update đúng trạng thái.
- **Non-functional**
  - so sánh thời gian load trước/sau (30 ngày logs).
  - kiểm tra số query DB giảm hoặc không tăng bất thường.

## 6) Tiêu chí hoàn thành

- `page.tsx` mỏng, không còn business logic lớn.
- `AdminSecurityClient` giảm kích thước đáng kể, các panel tách độc lập.
- Domain modules có test rõ ràng, benchmark endpoint ổn định.
- Không đổi behavior người dùng (ngoại trừ cải thiện performance/readability).

## 7) Gợi ý triển khai theo PR nhỏ (ít rủi ro merge)

- PR1: tách service orchestration + type contracts.
- PR2: tách UI panels, không đổi logic.
- PR3: tách risk/benchmark internals + bổ sung unit tests.
- PR4: polish performance + regression suite + docs cập nhật.
