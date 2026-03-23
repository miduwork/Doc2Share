# Lộ trình Refactor Secure Access (ROI, ít rủi ro)

Mục tiêu của tài liệu này là đưa ra kế hoạch “làm ít nhưng hiệu quả” bắt đầu từ 2 điểm có ROI cao:

1. **Stream hóa** `POST /api/secure-pdf` để giảm RAM/latency khi PDF lớn.
2. **Rút ngắn thời gian I/O** trong `run-next-secure-document-access.ts` bằng `Promise.all` (và đề xuất index để database không phải scan nhiều).

Tài liệu này chỉ mô tả kế hoạch và tiêu chí kiểm tra. Khi triển khai, ưu tiên chỉnh **handler Next** (không chạm core thuần) để tránh lệch logic đồng bộ Edge.

---

## A. Stream hóa `secure-pdf` để giảm RAM/latency

### A1. Vấn đề hiện tại

`src/app/api/secure-pdf/route.ts` đang:

- Tải PDF từ Supabase Storage dưới dạng `blob`
- Sau đó gọi `blob.arrayBuffer()` để lấy toàn bộ buffer
- Trả về `NextResponse(buffer, ...)`

Hệ quả:

- Tốn RAM theo kích thước file (toàn bộ PDF nằm trong memory cùng lúc)
- Tăng TTFB/latency vì phải chờ convert sang buffer hoàn tất

Tham chiếu: `src/app/api/secure-pdf/route.ts`.

### A2. Mục tiêu kỹ thuật

Thay `arrayBuffer()` bằng **stream** (nếu runtime cho phép), để:

- Bắt đầu gửi dữ liệu sớm hơn
- Giảm peak memory
- Giữ nguyên headers và contract API

### A3. Cách làm “ít rủi ro” (khuyến nghị)

1. Giữ nguyên toàn bộ phần **auth + secure-access** (`runNextSecureDocumentAccess`) và phần **logging audit**.
2. Chỉ thay đoạn trả response ở cuối route:
   - Nếu `blob.stream` tồn tại: trả `new NextResponse(blob.stream(), { headers... })`
   - Nếu không tồn tại hoặc stream fail: fallback sang `arrayBuffer()` như trước
3. Giữ nguyên headers:
   - `Content-Type: application/pdf`
   - `Cache-Control: private, no-store`

Pseudo-code định hướng (không áp dụng trực tiếp trong tài liệu):

```ts
const { data: blob } = await storage.download(...)
const canStream = typeof blob?.stream === "function"
if (canStream) return new NextResponse(blob.stream(), { headers })
const buffer = await blob.arrayBuffer()
return new NextResponse(buffer, { headers })
```

### A4. Tiêu chí kiểm tra (trước/sau)

1. Nhấn “Đọc” một tài liệu PDF hợp lệ:
   - Response status `200`
   - Header `Content-Type` đúng `application/pdf`
   - Trình đọc (`SecureReader`) render được bình thường
2. Thử file lớn (so với trước):
   - Theo dõi memory/process (Task Manager hoặc đo runtime nếu có)
   - Không xuất hiện lỗi “out of memory”
3. Thử các trường hợp bảo mật:
   - `401` khi session hết hạn
   - `403` khi device/session/permission sai
   - `429` khi rate limit vượt ngưỡng

### A5. Rủi ro & cách giảm

- Runtime không hỗ trợ stream đúng cách: có fallback buffer để đảm bảo không “fail hard”.
- Nếu stream trả về mà client vẫn cần `arrayBuffer`, cần xác nhận `SecureReader` hiện tại dùng `res.arrayBuffer()` sau khi gọi `/api/secure-pdf`. Việc stream hóa ở server vẫn đúng, nhưng Tối ưu RAM ở server sẽ giảm; client vẫn buffer hóa trong trình duyệt.
  - Nếu muốn tối ưu triệt để cả client, sẽ cần đổi `SecureReader` sang xử lý theo cách khác (nằm ngoài phạm vi tài liệu này).

---

## B. Tối ưu `run-next-secure-document-access.ts` bằng `Promise.all` + index

### B1. Vấn đề hiện tại

File `src/lib/secure-access/run-next-secure-document-access.ts` thực hiện nhiều query Supabase theo thứ tự:

- Brute-force blocked (count)
- IP rate limit (count)
- Profile lookup
- (Nếu không super admin) device logs + active session
- (Nếu không admin read any) permission lookup
- Rate limits (countHour + recentSuccess)
- Fetch `documents.file_path`

Các query **không phụ thuộc nhau** (trong từng “đoạn” sau khi qua gate) có thể chạy song song để giảm tổng latency.

### B2. Giữ nguyên semantics “ít rủi ro”

Nguyên tắc:

- Không thay thứ tự quyết định (gate nào fail thì fail giống y hệt)
- Chỉ song song hóa những query **độc lập** và chỉ chạy song song sau khi đã qua các gate cần thiết

### B3. Những chỗ có thể song song hóa an toàn

#### B3.1. Trong nhánh “không super admin”

Sau khi đã có `profile` và xác định `!isSuperAdmin`:

- chạy song song:
  - `device_logs` (lấy `device_id`)
  - `active_sessions` (lấy device_id gần nhất)
- sau đó mới `evaluateDeviceGate(...)` và `evaluateSessionDevice(...)`

Kết quả không đổi, vì cả hai đều chỉ phụ thuộc `user.id` và `deviceId`.

#### B3.2. Sau khi đã qua device/session + permission gate

Sau khi:

- device/session gate pass (nếu có)
- permission gate pass (nếu có)

thì có thể chạy song song:

- `access_logs` count `status=success` trong 1 giờ (rate limit hourly)
- `access_logs` select `document_id` trong 10 phút (high frequency distinct docs)
- `documents` select `file_path` theo `id`

Sau khi nhận kết quả song song:

- kiểm tra rate limit hourly
- kiểm tra high frequency distinct docs
- nếu ok, return `filePath`

Lý do an toàn: cả 3 đều dùng chung cùng `user.id` + `documentId` và không ảnh hưởng “gate” trước đó.

### B4. Đề xuất index để giảm scan (Postgres/Supabase)

Tài liệu này đề xuất index theo pattern filter trong `run-next-secure-document-access.ts`.

Lưu ý: thực tế index nên dựa trên `EXPLAIN (ANALYZE, BUFFERS)` của các query production. Nếu bạn không muốn làm “big change”, có thể bắt đầu bằng index cho các query count + gte created_at.

#### B4.1. `access_logs`

Các query dùng filter:

- Brute-force:
  - `action = ACTION_SECURE_PDF`
  - `status = blocked`
  - `user_id = user.id`
  - `created_at >= ...`
- IP limit:
  - `action = ACTION_SECURE_PDF`
  - `ip_address = ip`
  - `created_at >= ...`
- Hourly success count:
  - `action = ACTION_SECURE_PDF`
  - `status = success`
  - `user_id = user.id`
  - `created_at >= ...`
- High freq distinct:
  - `action = ACTION_SECURE_PDF`
  - `status = success`
  - `user_id = user.id`
  - `created_at >= ...`
  - (select `document_id`)

Đề xuất index:

1. Index cho brute-force + hourly success:

```sql
create index if not exists access_logs_user_action_status_created_at_idx
on access_logs (user_id, action, status, created_at);
```

2. Index cho IP limit:

```sql
create index if not exists access_logs_ip_action_created_at_idx
on access_logs (ip_address, action, created_at);
```

#### B4.2. `permissions`

Query:

- `permissions.user_id = user.id`
- `permissions.document_id = documentId`

Đề xuất:

```sql
create index if not exists permissions_user_document_idx
on permissions (user_id, document_id);
```

#### B4.3. `device_logs`

Query:

- select `device_id` where `user_id = user.id`

Đề xuất:

```sql
create index if not exists device_logs_user_idx
on device_logs (user_id);
```

(Unique/composite index `(user_id, device_id)` cần có sẵn để phục vụ `upsert ... onConflict: "user_id,device_id"`.)

#### B4.4. `active_sessions`

Query:

- select gần nhất: `where user_id = ... order by created_at desc limit 1`

Đề xuất:

```sql
create index if not exists active_sessions_user_created_at_desc_idx
on active_sessions (user_id, created_at desc);
```

### B5. Tiêu chí kiểm tra (trước/sau)

1. Thử đo latency trung bình của endpoint:
   - ít nhất với 2 tình huống: super admin và normal user
2. Đảm bảo “gate fail” vẫn trả đúng status/message:
   - `403` device limit / session mismatch / inactive profile / expired permission
   - `404` tài liệu không tồn tại
   - `429` rate limit theo đúng `Retry-After`
3. Theo dõi query plan (nếu có khả năng):
   - `EXPLAIN` trước/sau để xác nhận index được dùng

### B6. Rủi ro & cách giảm

- Promise.all làm đổi thời điểm query chạy: nhưng không đổi điều kiện quyết định nếu chỉ song song hóa “đoạn” sau gate.
- Index không tồn tại/không đúng: có thể bỏ index mới và giữ refactor Promise.all trước (thường ROI vẫn có dù ít hơn).

---

## C. Thứ tự triển khai khuyến nghị

1. Làm **Stream hóa `secure-pdf`** trước (giảm RAM/latency ở một entrypoint rõ ràng).
2. Làm **Promise.all** trong `run-next-secure-document-access.ts` tiếp theo.
3. Sau cùng (hoặc song song theo khả năng), áp dụng **index** theo đề xuất trong mục B4.

---

## D. Checklist “không lệch Edge/Sync”

Vì:

- Stream hóa nằm trong Next route `src/app/api/secure-pdf/route.ts` (không đụng core)
- Promise.all nằm trong helper Next `src/lib/secure-access/run-next-secure-document-access.ts` (không đụng `secure-access-core.ts`)

nên **không cần** sync `secure-access-core` qua Edge như tài liệu `docs/SECURE-ACCESS-SYNC.md`.

Nếu bạn có thay đổi business logic (thay `reason`, thay rules rate, đổi điều kiện permission) thì khi đó mới cần rà lại checklist sync.

