# Báo cáo đối sánh cấu trúc thanh toán (Payment Comparison Report)

Báo cáo này đối sánh cấu trúc thanh toán hiện tại của dự án (**production/src**) với cấu trúc thanh toán mới được đưa vào thư mục (**docs/payment/files**).

## 1. Tổng quan hệ thống (System Overview)

| Thành phần | Cấu trúc hiện tại (Project) | Cấu trúc mới (docs/payment/files) | Đánh giá |
| :--- | :--- | :--- | :--- |
| **Kiến trúc Webhook** | **Supabase Edge Functions** (`supabase/functions/payment-webhook`) | **Next.js API Routes** (`app/api/webhook/sepay/route.ts`) | Thay đổi lớn về nơi xử lý logic thanh toán từ Edge Function sang Next.js API. |
| **Xử lý QR Code** | Hiện tại chưa có API riêng, có thể đang gọi trực tiếp VietQR từ frontend. | **API Route tập trung** (`app/api/qr/route.ts`) | Chuẩn hóa việc tạo QR qua server để bảo mật và quản lý tham số tốt hơn. |
| **Logic đơn hàng** | Phân tán trong các Server Actions hoặc components. | **Thư mục logic riêng biệt** (`lib/orders/`) | Phân tách rõ ràng (create, repository, delivery, types). |
| **Cấu hình Pricing** | Có thể đang hardcode hoặc dùng Supabase trực tiếp. | **Hệ thống App Config sống** (`lib/config/`, `lib/orders/appConfig.server.ts`) | Cho phép Admin chỉnh sửa giá in ấn, phí đóng quyển ngay trên giao diện. |

---

## 2. Chi tiết cấu trúc thư mục (Directory Structure Comparison)

### 2.1. Thư mục Logic (lib)
Hiện tại, logic thanh toán trong `src/lib/payments` khá sơ khai:
- `sepay-webhook-core.ts`: Định nghĩa payload SePay.
- `vietqr.ts`: Hàm `buildVietQrUrl` đơn giản.

Cấu trúc mới trong `docs/payment/files/lib` bổ sung:
- **`lib/orders/`**: Một bộ đầy đủ để tạo đơn, lưu trữ đơn, tính toán phí vận chuyển (delivery).
- **`lib/payments/`**: Bổ sung `pricing.ts`, `printSubtotal.ts` để tính toán giá in ấn phức tạp (với hệ số nhân, phí theo trang).
- **`lib/config/`**: Hệ thống `appConfigSchema` dùng Zod để validate cấu hình từ database.
- **`lib/webhooks/`**: Chuyển logic xử lý webhook vào thư mục chuyên biệt.

### 2.2. Giao diện Admin (components/admin)
Hiện tại, trang quản lý đơn hàng (`src/app/admin/orders/page.tsx`) chỉ hiển thị danh sách đơn giản.

Cấu trúc mới bổ sung bộ UI mạnh mẽ:
- **`components/admin/orders/`**: Chi tiết đơn hàng, chỉnh sửa ghi chú thanh toán, bộ lọc đơn hàng chuyên sâu.
- **`components/admin/settings/`**: Giao diện cho Admin cấu hình giá (PricingTab) và cấu hình vận chuyển (DeliveryTab).

### 2.3. Cơ sở dữ liệu (Database Migrations)
Hiện tại dự án có các migration cũ (từ 2025). Cấu trúc mới đưa vào các migration (2026) quan trọng:
- `20260323140000_app_config.sql`: Bảng lưu trữ cấu hình hệ thống.
- `20260324120000_admin_dashboard_stats_rpc.sql`: Các hàm database để tính toán thống kê doanh thu cho Admin.

---

## 3. Các khoảng trống và khác biệt chính (Key Gaps & Differences)

1. **Chuyển đổi Webhook**: Cần quyết định sẽ tiếp tục dùng Supabase Edge Function hay chuyển sang Next.js API Route. Cấu trúc mới ưu tiên Next.js để dễ dàng truy cập `lib/orders` và `lib/config`.
2. **Logic tính giá (Pricing Logic)**: Dự án hiện tại chưa có logic tính giá in theo số lượng trang và hệ số nhân. Cấu trúc mới đã hiện thực hóa việc này qua `lib/payments/pricing.ts`.
3. **App Config**: Đây là tính năng mới hoàn toàn, cho phép điều chỉnh tham số kinh doanh (ví dụ: giá mỗi trang in) mà không cần deploy lại code.

## 4. Lộ trình tích hợp chi tiết (Detailed Roadmap)

### Bước 1: Đồng bộ Cơ sở dữ liệu (Database Migration)
Đây là bước tiền đề, đảm bảo hệ thống có đủ các bảng và logic database để chạy mã nguồn mới.
- **Hành động**: 
    1. Sao chép 06 file migration từ `docs/payment/files/supabase/migrations/` sang `supabase/migrations/`. 
    2. Chạy lệnh `npx supabase db push` để áp dụng schema mới (đặc biệt là bảng `app_config` và các trường mới cho bảng `orders`).
- **Lưu ý**: Kiểm tra tệp `supabase/schema.sql` mới để xem có các ràng buộc (constraints) hoặc RLS policies nào quan trọng cần cập nhật hay không.

### Bước 2: Triển khai Lớp xử lý trung tâm (Core Logic & Config)
Thiết lập "bộ não" quản lý đơn hàng và cấu hình động.
- **Hành động**:
    1. Sao chép thư mục `docs/payment/files/lib/config/` vào `src/lib/config/`. Thư mục này chứa logic validate cấu hình in ấn qua Zod.
    2. Sao chép thư mục `docs/payment/files/lib/orders/` vào `src/lib/orders/`. Đây là nơi xử lý logic tạo đơn (`createOrder.ts`) và truy vấn đơn hàng chuyên sâu.
- **Tác động**: Hệ thống sẽ bắt đầu nhận diện được các tham số như `binding_fee`, `print_price_per_page` từ database thay vì hardcode.

### Bước 3: Nâng cấp Công cụ tính giá & Thanh toán (Pricing & Payment)
Thay thế logic cũ bằng bộ công cụ tính toán chính xác hơn.
- **Hành động**:
    1. Cập nhật `src/lib/payments/` bằng các file từ `docs/payment/files/lib/payments/`.
    2. Tập trung vào `pricing.ts` (xử lý logic tính giá in dựa trên trang lẻ/trang chẵn/loại giấy) và `printSubtotal.ts`.
    3. Đồng bộ lại `vietqr.ts` để sinh mã QR theo chuẩn cấu hình mới từ `publicAppConfig`.

### Bước 4: Tích hợp API và Quản lý Webhook (API Integration)
Chuyển đổi từ xử lý Edge Function sang API Route tích hợp.
- **Hành động**:
    1. Sao chép cấu trúc `app/api/` từ `docs/payment/files/` vào `src/app/api/`.
    2. Quan trọng nhất là `api/webhook/sepay/route.ts` - nơi nhận thông báo thanh toán từ SePay và tự động cập nhật trạng thái đơn hàng.
- **Khuyến nghị**: Ngắt kết nối (Pause) Supabase Edge Function `payment-webhook` sau khi API mới hoạt động để tránh xử lý trùng lặp giao dịch.

### Bước 5: Hoàn thiện Giao diện Quản trị & Frontend UI (UI Integration)
Cung cấp công cụ quản lý trực quan cho Admin và trải nghiệm người dùng.
- **Hành động**:
    1. Sao chép bộ UI components vào `src/components/admin/orders/` và `src/components/admin/settings/`.
    2. Cập nhật trang `src/app/admin/orders/page.tsx` để sử dụng các component danh sách đơn chuyên sâu, hỗ trợ bộ lọc trạng thái và tìm kiếm nâng cao.
    3. Tích hợp thanh cấu hình pricing (`AdminSettingsPricingTab.tsx`) vào trang Settings của Admin để có thể đổi giá in ấn trực tiếp trên web.

---
*Báo cáo được lập tự động bởi Antigravity vào ngày 25/03/2026.*
