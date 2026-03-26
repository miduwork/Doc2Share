# Hướng dẫn tích hợp thanh toán qua mã QR (VietQR + SePay)

Tài liệu này giải thích cách ứng dụng Doc2Share tích hợp **VietQR** (tạo mã QR) và **SePay** (nhận thông báo khi khách chuyển khoản), giúp bạn hiểu và vận hành đúng luồng thanh toán.

---

## 1. Tổng quan: Hai phần tách biệt

| Thành phần | Vai trò | Nơi dùng |
|------------|--------|----------|
| **VietQR** | Tạo **ảnh mã QR** + **nội dung chuyển khoản** (số tiền, nội dung CK) để khách quét và chuyển tiền vào tài khoản của bạn. | Next.js (server): `src/lib/payments/vietqr.ts` + provider `sepay` |
| **SePay** | Dịch vụ bên thứ ba: khi có giao dịch chuyển khoản vào tài khoản của bạn, SePay gọi **webhook** (HTTP POST) tới server của bạn để báo “đã nhận tiền” → ứng dụng cập nhật đơn hàng và cấp quyền xem tài liệu. | Next.js: `POST /api/webhook/sepay` (`src/app/api/webhook/sepay/route.ts`, logic `src/lib/webhooks/sepay.ts`) |

- **VietQR**: chỉ cần số tài khoản ngân hàng (BIN + số TK + tên TK) → không cần đăng ký SePay để **tạo mã QR**.
- **SePay**: cần đăng ký tài khoản SePay, kết nối ngân hàng, và cấu hình **URL webhook + API key** để **nhận thông báo** khi có tiền vào.

---

## 2. Luồng thanh toán từ A → Z

```
[Khách] Chọn tài liệu → Nhấn "Mua" → Đến /checkout?document_id=xxx
        ↓
[Next.js] createCheckoutVietQr(documentId)
        → Gọi Supabase RPC create_checkout_order → tạo bản ghi orders (pending, external_id = D2S-{user4}-{order8})
        → Provider "sepay" buildCheckoutPayment():
             - transferContent = external_id (format: D2S-XXXX-YYYY = ứng dụng - 4 ký tự user - 8 ký tự đơn)
             - paymentLink = URL ảnh VietQR (img.vietqr.io) với amount + addInfo = transferContent
        → Trả về orderId, amount, transferContent, paymentLink cho client
        ↓
[Trang Checkout] Hiển thị:
        - Số tiền, nội dung chuyển khoản (copy)
        - Ảnh mã QR (paymentLink) — khách quét bằng app ngân hàng
        - Nút "Tôi đã thanh toán" (polling trạng thái đơn mỗi 12s)
        ↓
[Khách] Mở app ngân hàng → Quét QR (hoặc chuyển khoản đúng số tiền + nội dung CK)
        ↓
[SePay] Phát hiện giao dịch vào tài khoản của bạn → Gửi POST tới Webhook URL của bạn
        (Body JSON: id, content, description, transferType, transferAmount, referenceCode...)
        ↓
[Next.js API] POST /api/webhook/sepay
        → Kiểm tra Authorization header (Apikey WEBHOOK_SEPAY_API_KEY)
        → Parse body → extractOrderReferences (D2S-XXXX-YYYY, D2S-xxx, VQR-xxx, UUID...)
        → Idempotency: register_webhook_event (tránh xử lý trùng)
        → Chỉ xử lý transferType === "in" (tiền vào)
        → Tìm đơn hàng: orders theo external_id hoặc id (fallback D2S-8 ký tự)
        → Kiểm tra transferAmount === total_amount đơn hàng
        → RPC complete_order_and_grant_permissions → cập nhật orders + insert permissions
        → Trả về 200 { success: true }
        ↓
[Khách] Trang checkout polling → getCheckoutOrderStatus → status = "completed"
        → Hiển thị "Thanh toán đã xác nhận", link "Về Tủ sách"
```

### 2.1 Cấu trúc Nội dung chuyển khoản (transfer content)

Nội dung CK dùng format **ứng dụng – người dùng – đơn hàng** để dễ đối soát khi một tài khoản nhận nhiều kênh:

| Phần      | Ý nghĩa        | Ví dụ   |
|-----------|----------------|---------|
| **D2S**   | Ứng dụng Doc2Share | Cố định |
| **XXXX**  | 4 ký tự đầu của `user_id` (hex) | A1B2 |
| **YYYY**  | 8 ký tự đầu của `order_id` (hex) | C3D4E5F6 |

**Ví dụ đầy đủ:** `D2S-A1B2-C3D4E5F6` (tổng 16 ký tự, phù hợp giới hạn nội dung CK của ngân hàng).  
Giá trị này được lưu trong `orders.external_id` và gửi lên VietQR/SePay; webhook trích đúng ref này để tìm đơn và cấp quyền.

---

## 3. Cấu hình môi trường

### 3.1 Tạo mã QR (VietQR) — chạy Next.js

Trong `.env.local` (hoặc biến môi trường server):

```env
# Bắt buộc để có ảnh QR và nội dung CK đúng
VIETQR_BANK_BIN=970422
VIETQR_ACCOUNT_NO=0937534192
VIETQR_ACCOUNT_NAME=DOC2SHARE
VIETQR_TEMPLATE=compact2
```

- **VIETQR_BANK_BIN**: Mã BIN ngân hàng (ví dụ MB Bank = 970422). Tra cứu theo ngân hàng của bạn.
- **VIETQR_ACCOUNT_NO**: Số tài khoản nhận tiền.
- **VIETQR_ACCOUNT_NAME**: Tên chủ tài khoản (hiển thị trên VietQR).
- **VIETQR_TEMPLATE**: Mẫu giao diện QR (`compact2` thường dùng).

Nếu **không** set đủ 3 biến trên, trang checkout vẫn chạy nhưng `paymentLink = null` → chỉ hiển thị nội dung chuyển khoản, không có ảnh QR (và có thông báo "Chưa cấu hình VietQR").

### 3.2 Nhận webhook SePay — Next.js (hosting production)

Trên **môi trường chạy Next.js** (Vercel, VPS, Docker, …), đặt biến:

```env
# Bắt buộc để handler chấp nhận request từ SePay
WEBHOOK_SEPAY_API_KEY=<your-sepay-webhook-api-key>
# Bắt buộc để cập nhật đơn + cấp quyền (giống các API server khác)
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

- `WEBHOOK_SEPAY_API_KEY`: bạn **tự đặt**; SePay gửi trong header:
  - `Authorization: Apikey <WEBHOOK_SEPAY_API_KEY>` hoặc `Authorization: <WEBHOOK_SEPAY_API_KEY>`
- Trên my.sepay.vn nhập **cùng** giá trị làm API Key webhook.

Không còn Supabase Edge Function `payment-webhook`; không cần deploy function này cho thanh toán.

---

## 4. Đăng ký và cấu hình SePay

Để **nhận được** thông báo khi có tiền chuyển vào tài khoản, bạn cần:

1. **Đăng ký tài khoản SePay** (ví dụ tại [sepay.vn](https://sepay.vn) hoặc nền tảng ngân hàng hỗ trợ SePay).
2. **Kết nối tài khoản ngân hàng** (cùng số TK với VIETQR_ACCOUNT_NO).
3. **Tạo / cấu hình Webhook** trong dashboard SePay (xem chi tiết mục 4.1 bên dưới).

Sau khi lưu, SePay sẽ gửi mỗi giao dịch đến (body JSON) tới URL webhook với header `Authorization: Apikey <key>`.

### 4.1 Cấu hình webhook tại my.sepay.vn (MB Bank)

Bạn dùng **SePay qua ngân hàng Quân đội MB** và đã kết nối ngân hàng. Cấu hình webhook tại:

**https://my.sepay.vn/webhooks**

#### Bước 1: Lấy URL công khai của app và tạo API Key

- **URL webhook** (Next.js, phải **HTTPS** trên Internet):
  ```
  https://<domain-của-bạn>/api/webhook/sepay
  ```
  Ví dụ production: `https://doc2share.example.com/api/webhook/sepay`. Localhost không nhận webhook từ SePay trừ khi dùng tunnel (ngrok, cloudflared).

- **API Key** (mật khẩu webhook): bạn **tự tạo** một chuỗi bí mật. Ví dụ PowerShell:
  ```powershell
  [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
  ```
  **Lưu** giá trị — nhập ở **my.sepay.vn** và trong biến **`WEBHOOK_SEPAY_API_KEY`** trên hosting Next.js.

#### Bước 2: Khai báo biến môi trường trên hosting Next.js

- Thêm `WEBHOOK_SEPAY_API_KEY` và `SUPABASE_SERVICE_ROLE_KEY` (và các biến Supabase cần cho app) trong dashboard deploy (Vercel Environment Variables, v.v.), rồi **redeploy**.

#### Bước 3: Tạo webhook trên my.sepay.vn — điền từng trường

Vào [https://my.sepay.vn/webhooks](https://my.sepay.vn/webhooks) và điền form theo bảng dưới. **Lưu ý**: URL trong ảnh có lỗi gõ (`s.pabase.co`, `v//`, `wobhook`) — cần sửa đúng như mục **Gọi đến URL** bên dưới.

| Trường trên form | Giá trị cần điền / chọn |
|------------------|--------------------------|
| **Đặt tên** | `Doc2Share payment` (hoặc giữ "Thanh toán Mb Bank") |
| **1. Chọn sự kiện** → Bắn WebHooks khi | **Có tiền vào** ✓ |
| **2. Chọn điều kiện** → Khi tài khoản ngân hàng là | Chọn đúng tài khoản MB của bạn (vd: MBBank - 093783036) ✓ |
| **2. Chọn điều kiện** → Bỏ qua nếu nội dung giao dịch không có Code thanh toán? | **Không** — để vẫn nhận mọi giao dịch vào; app sẽ tự kiểm tra nội dung D2S-xxx. |
| **3. Thuộc tính Webhooks** → **Gọi đến URL** | `https://<domain-của-bạn>/api/webhook/sepay` — đúng HTTPS, đúng domain đã deploy Next.js. |
| **3. Thuộc tính** → Là WebHooks xác thực thanh toán? | **Không** ✓ (app tự xác thực bằng số tiền + đơn hàng) |
| **3. Thuộc tính** → Gọi lại Webhooks khi? | **Code không nằm trong phạm vi từ 200 đến 299** ✓ (retry khi lỗi) |
| **4. Cấu hình chứng thực** → **Kiểu chứng thực** | **Bắt buộc đổi**: chọn **Có chứng thực** (hoặc API Key / Header), **không** để "Không cần chứng thực". Nếu không, handler trả 401. |
| **4. Cấu hình chứng thực** (khi chọn có chứng thực) | Nhập **cùng** chuỗi đã set trong `WEBHOOK_SEPAY_API_KEY` trên hosting. Nếu SePay có ô Header: name = `Authorization`, value = `Apikey <chuỗi_key>` hoặc chỉ `<chuỗi_key>`. |
| **Request Content type** | `application/json` ✓ |
| **Trạng thái** → Kích hoạt | **Kích hoạt** ✓ |

- Sau khi sửa **URL** và **bật chứng thực** (API Key), nhấn lưu.

#### Bước 4: Kiểm tra

- Trên my.sepay.vn thường có mục **Lịch sử webhook** hoặc **Test**: gửi thử một request đến URL. Hoặc thực hiện **một giao dịch chuyển khoản thật** (số tiền nhỏ, đúng nội dung D2S-xxx của một đơn test).
- Ứng dụng: vào `/checkout?document_id=<id>` → tạo đơn → chuyển khoản đúng số tiền + nội dung CK → trong vòng vài chục giây trạng thái đơn chuyển **completed** và có nút "Về Tủ sách".

#### MB Bank (Ngân hàng Quân đội)

- **BIN VietQR**: `970422` (đúng với MB). Trong `.env.local` bạn đã set:
  - `VIETQR_BANK_BIN=970422`
  - `VIETQR_ACCOUNT_NO=<số tài khoản MB của bạn>`
  - `VIETQR_ACCOUNT_NAME=<tên chủ tài khoản>`
- Tài khoản SePay kết nối MB phải **trùng** số tài khoản với `VIETQR_ACCOUNT_NO` thì webhook mới nhận đúng giao dịch từ VietQR.

---

## 5. Các file quan trọng trong code

| File | Mô tả |
|------|--------|
| `src/lib/payments/vietqr.ts` | Hàm `buildVietQrUrl()` — tạo URL ảnh QR từ img.vietqr.io với amount + addInfo. |
| `src/lib/payments/providers/sepay.ts` | Provider “sepay”: `buildCheckoutPayment()` dùng VIETQR_* để tạo `transferContent` + `paymentLink`. |
| `src/app/checkout/actions.ts` | Server actions: `createCheckoutVietQr`, `getCheckoutOrderStatus` — tạo đơn, lấy paymentLink/transferContent, poll trạng thái. |
| `src/app/checkout/page.tsx` | UI checkout: gọi createCheckoutVietQr, hiển thị QR + nội dung CK, polling, “Tôi đã thanh toán”. |
| `src/app/api/webhook/sepay/route.ts` | Route POST: xác thực header, parse JSON, gọi `handleSePayWebhook`. |
| `src/lib/webhooks/sepay.ts` | Xử lý webhook: normalize payload, tìm đơn, idempotency, `complete_order_and_grant_permissions`. |
| `src/lib/payments/sepay-webhook-core.ts` | Logic parse payload SePay thuần (extract refs, amount, `isIncomingTransfer`, …). |

---

## 6. Đối soát đơn hàng (nội dung chuyển khoản)

- Khi tạo đơn, `transferContent` gửi cho khách thường là **D2S-XXXXXXXX** (8 ký tự đầu của `orderId` UUID).
- SePay gửi trong webhook các trường như `content`, `description`, `referenceCode`. Code **trích ra** mọi chuỗi có dạng:
  - `D2S-XXXXXXXX`
  - `VQR-xxx`
  - UUID đơn hàng
- Webhook tìm đơn bằng: khớp `orders.id` (UUID) hoặc `orders.external_id` (sau khi chuẩn hóa). Nếu dùng D2S-8 ký tự thì có fallback match theo 8 ký tự đầu của UUID.
- **Quan trọng**: Khách **phải** chuyển khoản đúng **số tiền** và **nội dung** (ít nhất đủ để trích ra D2S-xxx hoặc mã bạn dùng). Nếu sai số tiền, webhook trả 400 “Amount mismatch” và không cấp quyền.

---

## 7. Kiểm tra nhanh

1. **Chỉ VietQR (không SePay)**  
   - Set đủ `VIETQR_BANK_BIN`, `VIETQR_ACCOUNT_NO`, `VIETQR_ACCOUNT_NAME`.  
   - Vào `/checkout?document_id=<id>` → thấy ảnh QR + nội dung CK.  
   - Thanh toán thật → đơn **sẽ không** tự chuyển sang “completed” (vì không có webhook).

2. **Đủ VietQR + SePay**  
   - Set `WEBHOOK_SEPAY_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` trên hosting Next.js; cấu hình URL `/api/webhook/sepay` + API key trên SePay.  
   - Sau khi chuyển khoản, SePay gọi webhook → đơn chuyển completed, permissions được tạo.  
   - Trang checkout (polling) sẽ hiển thị “Thanh toán đã xác nhận” và “Về Tủ sách”.

3. **Admin**  
   - Trong **Admin → Tools** có mục liên quan “SePay/VietQR” (kiểm tra nhật ký, thanh toán treo).  
   - Có thể xem bảng `webhook_events`, `orders`, `permissions` trong Supabase để đối soát.

---

## 8. Checklist nhanh (MB Bank + my.sepay.vn)

| Bước | Việc cần làm | Trạng thái gợi ý |
|------|----------------|-------------------|
| 1 | `.env.local`: `VIETQR_BANK_BIN=970422`, `VIETQR_ACCOUNT_NO`, `VIETQR_ACCOUNT_NAME` | ✅ Bạn đã set |
| 2 | SePay: đăng ký + kết nối ngân hàng MB | ✅ Bạn đã làm |
| 3 | Tạo một chuỗi API Key (bí mật) dùng cho webhook | Làm 1 lần |
| 4 | Hosting Next.js: thêm `WEBHOOK_SEPAY_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` | Cần làm |
| 5 | [my.sepay.vn/webhooks](https://my.sepay.vn/webhooks): URL `https://<domain>/api/webhook/sepay` + cùng API Key | Cần làm |

Sau bước 4 và 5, chuyển khoản thử (đúng số tiền + nội dung D2S-xxx) → đơn sẽ tự chuyển **completed**.

---

## 9. Xử lý lỗi thường gặp

| Triệu chứng | Nguyên nhân có thể | Cách xử lý |
|-------------|--------------------|------------|
| Trang checkout không có ảnh QR, báo "Chưa cấu hình VietQR" | Thiếu hoặc sai `VIETQR_BANK_BIN` / `VIETQR_ACCOUNT_NO` / `VIETQR_ACCOUNT_NAME` | Kiểm tra `.env.local`, restart `npm run dev`. |
| Có QR, khách đã chuyển khoản nhưng đơn vẫn pending | Webhook chưa gọi tới hoặc gọi sai / bị 401 | Kiểm tra my.sepay.vn: URL đúng `https://<domain>/api/webhook/sepay`, API Key trùng `WEBHOOK_SEPAY_API_KEY` trên hosting. Xem log server (Vercel Logs, v.v.). |
| Webhook trả 401 Unauthorized | SePay gửi header Authorization khác với giá trị `WEBHOOK_SEPAY_API_KEY` | Code chấp nhận `Authorization: Apikey <key>` hoặc `Authorization: <key>`. Đảm bảo trên my.sepay.vn nhập **đúng** chuỗi (không thêm khoảng trắng, không nhầm key khác). |
| Webhook trả 400 Amount mismatch | Số tiền chuyển khoản ≠ tổng đơn | Khách phải chuyển **đúng** số tiền hiển thị trên checkout. |
| Webhook trả 409 Ambiguous order match | Nhiều đơn trùng reference (hiếm) | Kiểm tra `orders.external_id` / nội dung CK; tránh dùng mã quá ngắn hoặc trùng. |

---

## 10. Tóm tắt

- **Tích hợp “SePay” trong app = VietQR (tạo QR) + SePay (webhook nhận thông báo).**
- **VietQR**: chỉ cần cấu hình 3 biến VIETQR_* trên Next.js là có mã QR và nội dung CK. **MB Bank**: BIN = `970422`.
- **SePay**: đăng ký, kết nối ngân hàng, rồi tại **[my.sepay.vn/webhooks](https://my.sepay.vn/webhooks)** cấu hình URL `https://<domain>/api/webhook/sepay` + API Key; đồng thời set `WEBHOOK_SEPAY_API_KEY` (và `SUPABASE_SERVICE_ROLE_KEY`) trên hosting Next.js.
