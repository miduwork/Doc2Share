# Đánh giá toàn diện: Trang Tổng quan (Admin Console)

*Góc nhìn chuyên gia: Trình bày tổng quan sức khỏe kinh doanh*

---

## 0. Đánh giá nhanh (trạng thái sau cải tiến)

Trang đã được nâng cấp theo chuẩn **tổng quan sức khỏe kinh doanh**:

| Tiêu chí | Trạng thái |
|----------|------------|
| **Scope thời gian** | ✅ Rõ: toàn bộ KPI + bảng top = **30 ngày qua** |
| **So sánh kỳ** | ✅ Có % thay đổi (doanh thu, đơn) vs 30 ngày trước, màu ↑/↓ |
| **Leading / hành động** | ✅ Thẻ **Đơn đang chờ** + link "Cần xử lý thanh toán" |
| **Biểu đồ** | ✅ Trục X dd/MM, tooltip: doanh thu + số đơn |
| **Cập nhật lúc** | ✅ Footer: "Dữ liệu cập nhật lúc HH:mm, dd/MM/yyyy" |
| **Drill-down** | ✅ Trang **Admin → Đơn hàng** (`/admin/orders`) với bộ lọc trạng thái; link đơn chờ → `?status=pending`; thẻ Doanh thu / Đơn hoàn thành → `?status=completed` |
| **Sức khỏe kho tài liệu** | ❌ Chưa có (tổng / sẵn sàng bán) |
| **Tùy chọn 7/30/90 ngày** | ✅ Dropdown/tabs **7 ngày / 30 ngày / 90 ngày** (query `?range=7|30|90`), server component refetch theo range |

**Kết luận**: Trang đủ dùng cho "đọc nhanh sức khỏe kinh doanh" trong 30 giây, với linh hoạt khoảng thời gian. Các bước tiếp theo (tùy chọn): block sức khỏe kho tài liệu, mục tiêu/benchmark.

---

## 1. Hiện trạng (chi tiết)

### 1.1 Nội dung hiện có

| Thành phần | Mô tả |
|------------|--------|
| **4 thẻ KPI** | Doanh thu thực (30 ngày, sau phí 2%) + % so với 30 ngày trước; Đơn hoàn thành (30 ngày) + %; AOV (30 ngày); **Đơn đang chờ** (pending) + link |
| **1 biểu đồ** | Doanh thu theo ngày, 30 ngày lịch (fill 0), trục dd/MM, tooltip doanh thu + số đơn |
| **1 bảng** | Top 10 tài liệu bán chạy trong 30 ngày (số lượng bán + doanh thu) |
| **Footer** | Dữ liệu cập nhật lúc ... |

### 1.2 Điểm mạnh

- **Tập trung đúng đối tượng**: Super admin, dữ liệu từ đơn completed (và pending cho leading).
- **Số liệu nhất quán**: 30 ngày thống nhất cho KPI, biểu đồ, top products.
- **Có thể hành động**: Đơn chờ + link; top tài liệu gợi ý sản xuất thêm nội dung.
- **Giao diện**: Semantic tokens, accessibility, cấu trúc rõ.

---

## 2. Khoảng trống so với chuẩn "sức khỏe kinh doanh"

### 2.1 Phạm vi thời gian không rõ và không thống nhất

- **Vấn đề**: Bốn thẻ KPI đang dùng **toàn bộ** đơn completed (all-time), trong khi subtitle là "30 giây" và biểu đồ là "30 ngày". Người xem không biết con số đang xem là "từ trước đến nay" hay "30 ngày".
- **Chuẩn**: Mỗi KPI cần gắn rõ **khoảng thời gian** (vd: "30 ngày qua", "Tháng này") và **nhất quán** với phần còn lại của trang.

### 2.2 Thiếu so sánh với kỳ trước

- **Vấn đề**: Chỉ có một con số (vd: 50M) mà không có so sánh (tăng/giảm bao nhiêu % so với 30 ngày trước). Khó đánh giá "sức khỏe" là đang tốt hay xấu.
- **Chuẩn**: Cần **so sánh với kỳ trước** (vd: 30 ngày qua vs 30 ngày trước đó): % thay đổi, có thể kèm mũi tên lên/xuống hoặc màu.

### 2.3 Thiếu chỉ số dẫn dắt (leading) và hành động cần làm

- **Vấn đề**: Chỉ có chỉ số "kết quả" (doanh thu, đơn hoàn thành). Không thấy **đơn pending** (chờ thanh toán) — là tín hiệu sớm và là việc cần xử lý.
- **Chuẩn**: Cần ít nhất một **leading indicator** và một **call-to-action** rõ (vd: "5 đơn đang chờ — Kiểm tra").

### 2.4 Biểu đồ chưa tối ưu cho "đọc nhanh"

- **Vấn đề**: Trục X dùng format ISO (yyyy-mm-dd), khó đọc với người Việt; tooltip chỉ có doanh thu, không có số đơn trong ngày; không có xu hướng (vd: so với tuần trước).
- **Chuẩn**: Ngày hiển thị dd/MM; tooltip có cả doanh thu + số đơn; có thể thêm đường xu hướng hoặc so sánh với kỳ trước.

### 2.5 Thẻ "Top tài liệu (hiển thị)" ít giá trị

- **Vấn đề**: Thẻ thứ 4 chỉ hiển thị số 10 (hoặc <10) — không phải KPI đo sức khỏe, dễ gây hiểu nhầm.
- **Chuẩn**: Nên thay bằng KPI có ý nghĩa (vd: **Đơn đang chờ**, **Tài liệu sẵn sàng bán**, hoặc **Conversion** nếu có dữ liệu).

### 2.6 Không có drill-down và không có "cập nhật lúc"

- **Vấn đề**: Click vào số không dẫn tới trang chi tiết; không biết dữ liệu "cập nhật lúc nào".
- **Chuẩn**: Thẻ KPI có link đến trang liên quan (vd: đơn chờ → trang quản lý đơn / checkout); có dòng "Cập nhật lúc HH:mm dd/MM" (theo thời điểm render).

### 2.7 Thiếu bối cảnh "kho tài liệu"

- **Vấn đề**: Không thấy tổng số tài liệu, số tài liệu **ready** (đang bán) vs draft/reject — là một phần sức khỏe nguồn cung.
- **Chuẩn**: Có thể thêm một thẻ hoặc một dòng: "Tài liệu: X sẵn sàng / Y tổng" (nếu có trường status/approval).

---

## 3. Kiến nghị theo mức độ ưu tiên

### P0 — Nên làm ngay (rõ ràng, tác động cao)

1. **Gắn scope thời gian cho KPI**
   - Thêm nhãn rõ: "Tổng từ trước đến nay" hoặc "30 ngày qua" cho từng thẻ.
   - Ưu tiên: **30 ngày qua** cho 4 thẻ (để đồng bộ với biểu đồ và câu "30 giây") và tùy chọn hiển thị thêm "Tổng" (all-time) nhỏ hơn bên dưới hoặc trong tooltip.

2. **So sánh với kỳ trước (30 ngày)**
   - Tính thêm: doanh thu & số đơn của **30 ngày trước đó** (ngày 31–60).
   - Hiển thị % thay đổi (vd: "+12% so với 30 ngày trước") kèm mũi tên/màu (xanh tăng, đỏ giảm khi phù hợp ngữ cảnh).

3. **Đơn đang chờ (pending)**
   - Thêm một thẻ hoặc banner: "Đơn chờ thanh toán: N" với link tới trang có danh sách đơn pending (hoặc checkout/admin).
   - Coi đây là **leading indicator** và **hành động cần làm**.

### P1 — Nên có trong phiên bản gần

4. **Cải thiện biểu đồ**
   - Trục X & tooltip: format ngày **dd/MM**.
   - Tooltip: hiển thị cả **Doanh thu** và **Số đơn** trong ngày.

5. **Thay thẻ "Top tài liệu (hiển thị)"**
   - Thay bằng **"Đơn đang chờ"** (số đơn pending) hoặc **"Tài liệu sẵn sàng"** (số documents status = ready), có link drill-down.

6. **Cập nhật lúc**
   - Footer hoặc góc: "Dữ liệu cập nhật lúc HH:mm, dd/MM/yyyy" (thời điểm render server).

### P2 — Cải thiện dài hạn

7. **Drill-down**
   - Thẻ Doanh thu / Đơn hàng → trang báo cáo hoặc danh sách đơn với bộ lọc tương ứng.

8. **Sức khỏe kho tài liệu**
   - Một block nhỏ: tổng tài liệu, số "ready", số "pending approval" (nếu có), link tới Admin → Tài liệu.

9. **Tùy chọn khoảng thời gian**
   - Dropdown: 7 ngày / 30 ngày / 90 ngày (có thể dùng query params + refetch hoặc server component với searchParams).

10. **Mục tiêu / benchmark (nếu có)**
    - Nếu có target doanh thu hoặc target đơn: hiển thị tiến độ (vd: "Đạt 80% mục tiêu tháng").

---

## 4. Tóm tắt

| Tiêu chí | Trước cải tiến | Sau cải tiến (hiện tại) |
|----------|----------------|--------------------------|
| Scope thời gian | Không rõ (all-time) | ✅ Rõ: "30 ngày qua" cho mọi KPI + bảng |
| So sánh kỳ | Không | ✅ % thay đổi vs 30 ngày trước (doanh thu, đơn) |
| Leading / hành động | Không | ✅ Đơn pending + link "Cần xử lý thanh toán" |
| Biểu đồ | ISO ngày, tooltip chỉ doanh thu | ✅ dd/MM, tooltip doanh thu + số đơn |
| Thẻ KPI thứ 4 | "Top tài liệu (hiển thị)" | ✅ "Đơn đang chờ" |
| Cập nhật lúc | Không | ✅ Có (footer) |
| Drill-down | Không | ⚠️ Link đơn chờ → /admin (chưa có trang đơn) |

**Đã thực hiện**: toàn bộ P0 và P1 (scope, so sánh kỳ, đơn chờ, biểu đồ, cập nhật lúc). **Còn lại**: drill-down thật (trang Admin → Đơn hàng), sức khỏe kho tài liệu, tùy chọn 7/30/90 ngày, mục tiêu/benchmark (P2).
