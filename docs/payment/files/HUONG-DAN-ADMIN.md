# Hướng dẫn sử dụng trang Admin (QR2Print)

Trang Admin dùng để xem và xử lý đơn in do khách hàng gửi từ trang chủ (quét QR).

---

## 1. Đăng nhập

1. Mở trình duyệt, vào địa chỉ: **`/login`**  
   (Ví dụ: `http://localhost:3000/login` khi chạy local.)

2. Nhập **Email** và **Mật khẩu** tài khoản Admin đã tạo trong Supabase (Authentication → Users).

3. Bấm **Đăng nhập**. Nếu đúng, bạn sẽ được chuyển sang trang **`/admin`**.

**Lưu ý:** Nếu chưa đăng nhập mà truy cập `/admin`, hệ thống sẽ tự chuyển bạn về `/login`.

---

## 2. Giao diện trang Admin

Sau khi đăng nhập, bạn thấy:

- **Header:** Tiêu đề "QR2Print · Admin" và nút **Đăng xuất** (góc phải).
- **Nội dung chính:** Danh sách đơn hàng.

Trên **màn hình lớn (máy tính):** đơn hàng hiển thị dạng **bảng**.  
Trên **điện thoại:** mỗi đơn hiển thị dạng **thẻ (card)**.

---

## 3. Các cột / thông tin mỗi đơn

| Thông tin      | Ý nghĩa |
|----------------|--------|
| **Thời gian**  | Thời điểm khách gửi đơn (dạng "5 phút trước", "2 giờ trước", ...). |
| **Khách hàng** | Tên và ghi chú (nếu có). |
| **SĐT**        | Số điện thoại (bấm để gọi). |
| **File**       | Link **Xem** (mở file) và **Tải** (tải file). |
| **Ưu tiên**    | Mức ưu tiên: Ưu tiên thấp / Ưu tiên / Ưu tiên cao. |
| **Trạng thái** | Chưa hoàn thành / Đã hoàn thành / Đã giao hàng. |
| **Thao tác**   | Nút cập nhật trạng thái. |

**Thứ tự hiển thị:** Đơn **ưu tiên cao** và **cũ nhất** luôn nằm **trên cùng**.

---

## 4. Xem và tải file đính kèm

- **Xem:** Bấm **Xem** → file mở trong tab mới (PDF/ảnh trong trình duyệt, Word có thể tải hoặc mở tùy cài đặt).
- **Tải:** Bấm **Tải** → trình duyệt tải file về máy (tên file gốc khách gửi).

---

## 5. Thay đổi mức độ ưu tiên

1. Tìm đơn cần đổi ưu tiên.
2. Ở cột **Ưu tiên**, mở **dropdown** (ô chọn).
3. Chọn một trong ba: **Ưu tiên thấp**, **Ưu tiên**, **Ưu tiên cao**.
4. Giá trị được lưu ngay; danh sách tự sắp xếp lại (ưu tiên cao + cũ nhất lên trên).

---

## 6. Cập nhật trạng thái đơn

### Nút **Hoàn thành**

- Dùng khi đã in xong đơn, chưa giao.
- Bấm **Hoàn thành** → hệ thống cập nhật:
  - **Trạng thái:** "Đã hoàn thành"
  - **Thời gian hoàn thành:** thời điểm bấm nút.

### Nút **Đã giao hàng**

- Dùng khi đã giao đơn cho khách.
- Bấm **Đã giao hàng** → hệ thống cập nhật:
  - **Trạng thái:** "Đã giao hàng"
  - **Thời gian giao hàng:** thời điểm bấm nút.

**Lưu ý:**

- Đơn **Chưa hoàn thành** sẽ có cả hai nút: **Hoàn thành** và **Đã giao hàng**.
- Đơn **Đã hoàn thành** chỉ còn nút **Đã giao hàng**.
- Đơn **Đã giao hàng** không còn nút (chỉ xem).

---

## 7. Tự động cập nhật (auto-refresh)

- Danh sách đơn được **tự tải lại sau mỗi 30 giây**.
- Bạn không cần bấm F5; đơn mới từ khách sẽ xuất hiện trong vòng tối đa 30 giây.
- Khi bấm Hoàn thành / Đã giao hàng hoặc đổi ưu tiên, danh sách cũng được cập nhật ngay.

---

## 8. Đăng xuất

- Bấm **Đăng xuất** ở góc phải header.
- Bạn sẽ được chuyển về trang **`/login`** và phải đăng nhập lại để vào `/admin`.

---

## 9. Theo dõi thanh toán tự động (SePay + VietQR)

Hệ thống có cột ẩn `payment_status` trong bảng `orders` để đánh dấu đơn **đã thanh toán hay chưa**.

- Khi khách quét **VietQR** và chuyển khoản đúng:
  - Nội dung: dạng `IN AN XXXXXXXX` (8 ký tự đầu mã đơn, bạn thấy ở trang thanh toán).
  - Số tiền: đúng bằng **Tổng tiền** hiển thị trên trang `/payment/[id]`.
- SePay gửi webhook tới API:
  - Nếu **tìm được đơn** theo mã trong nội dung và **số tiền khớp**:
    - Cập nhật `payment_status = "Đã thanh toán"`.
    - Đặt `priority = "Ưu tiên"` để đơn nhảy lên trên danh sách in.
  - Mọi giao dịch (kể cả sai mã / sai tiền) đều được lưu vào bảng **`transactions`** để bạn đối soát.

Để xem chi tiết:

- Vào Supabase → **Table editor**:
  - Bảng **`orders`**: cột `payment_status` (Chưa thanh toán / Đã thanh toán).
  - Bảng **`transactions`**: toàn bộ log từ webhook (bao gồm `order_id`, `amount_matched`, `order_updated`, nội dung CK,...).

Nếu bạn muốn đưa trạng thái thanh toán lên UI Admin (badge màu), có thể hỏi để mình hỗ trợ thêm.

---

## 10. Reset / dựng lại CSDL khi cần

Nếu sau này bạn muốn **xóa toàn bộ dữ liệu thử nghiệm** và dựng lại CSDL đúng với code hiện tại:

1. Mở file `supabase/schema.sql` trong project.
2. Vào Supabase Dashboard → **SQL Editor** → **New query**.
3. Copy **toàn bộ nội dung file** (Phần 1 + Phần 2) và **Run**:
   - Phần 1: Xóa bảng `transactions`, `orders` và các policy storage liên quan.
   - Phần 2: Tạo lại bảng `orders`, `transactions`, policy RLS, bucket `documents`, policy upload/read.

**Lưu ý:** Thao tác này sẽ xóa hết dữ liệu đơn cũ. Hãy backup nếu cần trước khi chạy.

---

## Tóm tắt nhanh

| Việc cần làm        | Thao tác |
|---------------------|----------|
| Vào trang Admin     | Mở `/admin` (sẽ chuyển về `/login` nếu chưa đăng nhập). |
| Xem file khách gửi | Bấm **Xem** hoặc **Tải** ở cột File. |
| Sắp xếp việc in    | Đổi **Ưu tiên** bằng dropdown. |
| Đánh dấu in xong   | Bấm **Hoàn thành**. |
| Đánh dấu đã giao   | Bấm **Đã giao hàng**. |
| Thoát tài khoản    | Bấm **Đăng xuất**. |

Nếu bạn cần thêm bước (ví dụ: in QR dán tại quầy, quy trình nội bộ), có thể bổ sung vào tài liệu nội bộ hoặc nhắn mình để gợi ý cập nhật file hướng dẫn này.
