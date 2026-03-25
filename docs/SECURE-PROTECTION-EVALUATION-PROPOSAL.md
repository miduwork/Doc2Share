# Đánh giá & Đề xuất Nâng cấp Hệ thống Bảo mật Tài liệu (Doc2Share)

**Ngày lập:** 2026-03-25  
**Tình trạng:** Bản dự thảo đề xuất (Draft Proposal)

---

## 1. Đánh giá chi tiết Cơ chế hiện tại (tháng 03/2026)

### 1.1 Điểm mạnh (Strengths)
*   **Bảo mật Đa lớp (Defense in Depth):** Sự kết hợp giữa Gatekeeper (Server), Render-time Deterrence (Frontend), và Forensic Watermarking (Traceability) tạo ra rào cản lớn cho người dùng thông thường.
*   **Kiến trúc Thống nhất (Shared Core):** Việc dùng `secure-access-core.ts` giữa Next.js và Supabase Edge giúp giảm thiểu logic drift đáng kể.
*   **Trải nghiệm người dùng (UX vs Security):** Canvas rendering đảm bảo tài liệu hiển thị sắc nét (vector-based) mà vẫn ngăn chặn được copy-paste. Kỹ thuật Adaptive Watermark giúp dấu vết luôn hiện diện mà không che mất nội dung quan trọng.
*   **Audit Trail:** Bản ghi `access_logs` khá chi tiết, cung cấp đủ dữ liệu cho việc điều tra (forensic) khi có sự cố rò rỉ.

### 1.2 Điểm yếu & Rủi ro (Weaknesses & Risks)
*   **Lỗ hổng Drift tại Edge Function (Critical):** Hiện tại Edge `get-secure-link` đang tự động cập nhật `device_id` thay vì chặn truy cập khi phát hiện mismatch session-device. Điều này cho phép kẻ xấu chia sẻ token/token hopping giữa các thiết bị.
*   **Rủi ro Trích xuất nội dung (Content Extraction):** Do PDF được render tại Client, người dùng có kỹ thuật cao có thể intercept `arrayBuffer` từ network hoặc lấy PDF proxy trực tiếp từ bộ nhớ để bypass lớp Canvas.
*   **Giới hạn của Client-side Blackout:** Các cơ chế che màn hình khi `blur` hay `mouse-out` chỉ mang tính chất ngăn chặn người dùng phổ thông. Các phần mềm quay phim màn hình chuyên dụng hoặc phần cứng capture card vẫn có thể ghi lại nội dung.
*   **Phụ thuộc vào Client Clock:** Một số logic kiểm tra hết hạn (`expires_at`) dựa trên giờ của thiết bị người dùng thay vì giờ server tuyệt đối (cần kiểm tra lại implement ở `secure-access-core`).

---

## 2. Đề xuất cải thiện (Roadmap P2 - P4)

Dưới đây là lộ trình nâng cấp nhằm biến Doc2Share thành một nền tảng nội dung an toàn cấp độ doanh nghiệp (Enterprise-grade security).

### Giai đoạn P2: Fix & Hardening (Ưu tiên Cao)
*   **2.1 Đồng bộ hóa tuyệt đối (Hard Enforcement):**
    *   Sửa logic Edge Function: Chặn (403 Forbidden) thay vì update `device_id` khi mismatch.
    *   Tích hợp `check-sync-drift.mjs` vào CI/CD để chặn build nếu Next và Edge bị lệch logic.
*   **2.2 One-Time Token (OTT) cho Signed URL:**
    *   Signed URL từ Edge chỉ cho phép tải 01 lần duy nhất (Single-use). Nếu người dùng F5 hoặc copy link sang tab khác, link sẽ vô hiệu ngay lập tức.
    *   Giảm TTL của signed URL xuống tối đa (vd: 15 giây).
*   **2.3 Forensic Mapping Automation:**
    *   Xây dựng tool nội bộ cho admin để chỉ cần nhập `D2S:{wm_short}`, hệ thống tự động truy vấn ngược ra `user_id`, `ip_address`, và lịch sử phiên làm việc tương ứng.

### Giai đoạn P3: Advanced Security Tier (Tài liệu nhạy cảm)
*   **3.1 Server-side Watermarking (SSW):**
    *   Đối với các tài liệu "High-Value", chuyển sang model gửi ảnh (rasterized images) đã được đóng dấu watermark "chết" từ phía server thay vì gửi PDF vector. 
    *   Triệt tiêu 100% khả năng dùng `arrayBuffer` để tái tạo lại file PDF gốc.
*   **3.2 Invisible Watermarking (Steganography):**
    *   Nhúng thông tin định danh (ID người dùng/phiên) ẩn vào các pixel của ảnh hoặc cấu trúc tệp mà mắt thường không thấy được.
    *   Giúp truy vết được nguồn rò rỉ ngay cả khi người dùng cố tình xóa mờ hoặc crop watermark hiển thị.

### Giai đoạn P4: AI & Behavioral Protection
*   **4.1 Phân tích hành vi bất thường (Anomaly Detection):**
    *   Sử dụng AI để phân tích `access_logs`, phát hiện các pattern của tool crawl hoặc hành vi "quét ảnh thủ công" (vd: lật 100 trang trong 100 giây một cách đều đặn).
    *   Tự động khóa hoặc yêu cầu Multi-factor Authentication (MFA) khi phát hiện dấu hiệu nghi ngờ.
*   **4.2 Device Fingerprinting Nâng cao:**
    *   Thu thập thêm các tín hiệu phần cứng (Canvas fingerprinting, Audio context, GPU renderer) để nhận diện thiết bị chính xác hơn là chỉ dựa vào một ID lưu trong localStorage.

---

## 3. Kết luận & Khuyến nghị
Cơ chế hiện tại của dự án rất triển vọng nhưng cần được "vá" lỗ hổng tại Edge Function ngay lập tức để đảm bảo tính toàn vẹn của cơ chế Single Session. Roadmap tiếp theo nên tập trung vào việc chuyển dịch dần lên **Server-side Rendering** cho các Tier tài liệu cao cấp để bảo vệ mã nguồn PDF một cách tuyệt đối.
