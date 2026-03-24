## Integration test checklist (route-level)

Mục tiêu: test end-to-end cấp quyền đọc tài liệu theo chuỗi nghiệp vụ:
`Checkout → payment-webhook → Tủ sách → /api/secure-pdf (SecureReader)`

Đây là checklist theo hướng **route-level** (test thật handler Next API `/api/secure-pdf`),
không chỉ gọi gate nội bộ.

---

## 0. Setup bắt buộc

1. Chạy Next server (vì test sẽ `fetch` tới route `/api/secure-pdf`)
   - Ví dụ: `npm run dev` và dùng `BASE_URL = http://localhost:3000`

2. ENV (cần có trong môi trường chạy test)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (seed/verify DB)
   - `SUPABASE_ANON_KEY` (hoặc `NEXT_PUBLIC_SUPABASE_ANON_KEY`) (login user)
   - `WEBHOOK_SEPAY_API_KEY` (gọi Edge webhook trực tiếp)
   - `TEST_USER_EMAIL`
   - `TEST_USER_PASSWORD`

3. Chuẩn bị Storage thật (vì `/api/secure-pdf` sẽ `download()` từ bucket `private_documents`)
   - Upload 1 PDF tối thiểu vào bucket `private_documents`
   - Key object phải khớp `documents.file_path` seed

---

## 1. Auth cookie Supabase: điểm khó nhất

Route `/api/secure-pdf` dùng `createClient()` ở `src/lib/supabase/server.ts` (SSR) để đọc session từ cookie.
Vì vậy integration test phải gửi request kèm cookie Supabase session hợp lệ.

Khuyến nghị implement trong test:
1. Sign-in user bằng `supabase-js` nhưng dùng **SSR cookie jar** (in-memory) để gom cookies lại.
2. Sau khi sign-in, trích toàn bộ cookies đã set từ cookie jar → gắn thành header `Cookie` khi `fetch` tới:
   - `POST /api/secure-pdf`

Lưu ý:
- Cookie dự án đang dùng cho “single session” là `doc2share_sid` (set trong `src/app/login/actions.ts`).
- Tuy nhiên `/api/secure-pdf` gate *chính* dựa trên `active_sessions.device_id` (được lookup bằng user session).
- Integration test tối thiểu phải có cookie Supabase session (để route không trả `401 Unauthorized`).
- Nếu thấy fail theo “device mismatch / session replaced”, sau đó mới bổ sung seed `active_sessions` và device cookie/session như UI.

---

## 2. Seed DB tối thiểu cho mỗi test case

Dùng **service-role** để seed/cleanup nhanh (bypass RLS).

Seed tối thiểu:
1. `profiles`
   - User test phải `is_active = true`
   - `role` đặt theo mặc định (thường `student`) hoặc tùy setup của bạn

2. `documents`
   - `id` (UUID)
   - `title` (not null)
   - `price` là số nguyên VND (> 0)
   - `file_path`: key object để route `/api/secure-pdf` download

3. Storage
   - Bucket: `private_documents`
   - Object name: phải đúng `documents.file_path`
   - Nội dung: PDF hợp lệ

4. `device_logs`
   - ít nhất 1 row cho user
   - `device_id = DEVICE_A` (device mà bạn sẽ dùng trong request đọc tài liệu)

5. `active_sessions`
   - ít nhất 1 row cho user
   - `session_id` (string/tự tạo)
   - `device_id = DEVICE_A`

---

## 3. Test case A — Happy path (webhook success → permissions → `/api/secure-pdf` trả PDF)

### Bước 1: Sign-in (tạo auth cookie Supabase)
- Sign-in bằng `TEST_USER_EMAIL / TEST_USER_PASSWORD`
- Lưu cookie jar để dùng cho request `/api/secure-pdf`

### Bước 2: Checkout (tạo order)
- Gọi RPC checkout (tạo order trong DB):
  - `rpc("create_checkout_order", { p_document_id: DOC_ID })`
- Lấy `orderId` trả về từ RPC.
- Query DB để lấy `external_id` của `orderId` (webhook provider dùng `referenceCode = orders.external_id`).

### Bước 3: Gọi Edge webhook trực tiếp
- URL:
  - `${SUPABASE_URL}/functions/v1/payment-webhook`
- Header:
  - `Authorization: Apikey <WEBHOOK_SEPAY_API_KEY>`
  - `Content-Type: application/json`
- Body raw JSON (tối thiểu):
  ```json
  {
    "transferType": "in",
    "transferAmount": <total_amount_as_number>,
    "referenceCode": "<external_id>"
  }
  ```

### Bước 4: Assert DB (service-role)
- `orders.status === "completed"`
- `permissions` có dòng cho `(user_id, document_id)`

### Bước 5: Assert SecureReader route-level
- Gọi:
  - `POST ${BASE_URL}/api/secure-pdf`
- Body:
  ```json
  { "document_id": "<DOC_ID>", "device_id": "<DEVICE_A>" }
  ```
- Cookie header:
  - đính kèm cookies supabase session từ bước sign-in
- Expected:
  - HTTP `200`
  - `content-type` có `application/pdf`
  - bytes bắt đầu bằng `%PDF` (khuyến nghị kiểm tra để đảm bảo stream thật)

---

## 4. Test case B — Amount mismatch (webhook 400, không cấp quyền → `/api/secure-pdf` trả 403)

### Bước 1: Tạo order như Test case A

### Bước 2: Gọi webhook với sai tiền
- `transferAmount = total_amount + 1` (hoặc lệch `Math.round(order.total_amount)`)

### Bước 3: Expected webhook
- HTTP `400`
- JSON `{ error: "Amount mismatch" }` (hoặc message tương đương theo provider)

### Bước 4: Expected DB
- `orders.status` vẫn `pending`
- `permissions` không có dòng cho `(user_id, document_id)`

### Bước 5: Expected SecureReader route-level
- `POST /api/secure-pdf`
- Expected:
  - HTTP `403`
  - message thuộc nhóm “chưa mua / quyền hết hạn” (tùy seed data)

---

## 5. Test case C — Idempotency (gửi webhook trùng rawBody → không cấp quyền lần 2)

### Bước 1: Tạo order như Test case A

### Bước 2: Gọi webhook 2 lần với cùng rawBody string
- Giữ nguyên raw JSON string (để payload hash trùng event_id/hash trùng)

### Bước 3: Expected
- Lần 1: `200 success`
- Lần 2: `200` nhưng rơi vào nhánh duplicate (response msg/code tùy provider)

### Bước 4: Assert DB
- `orders.status === "completed"`
- `permissions` chỉ có đúng 1 row cho `(user_id, document_id)`
- `granted_at` không tăng sau lần gửi thứ 2 (RPC dùng `LEAST(...)` nên không tiến về sau)

---

## 6. Trường hợp cần bổ sung (nếu gặp fail)

1. Nếu `/api/secure-pdf` fail vì device/session:
   - đảm bảo `active_sessions.device_id` khớp `device_id` gửi trong request
   - đảm bảo `device_logs` đã seed device tồn tại

2. Nếu fail vì storage:
   - check `documents.file_path` có đúng key object trong `private_documents` không

3. Nếu fail vì rate-limit:
   - cần seed `access_logs`/timestamp để tránh hitting 429
   - hoặc chạy lại test trên DB sạch

