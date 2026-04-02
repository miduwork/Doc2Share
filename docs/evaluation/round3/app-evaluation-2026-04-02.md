# Đánh giá ứng dụng Doc2Share (Round 3)

> **Ngày đánh giá:** 2026-04-02  
> **Phiên bản repo:** `0.1.0`  
> **Tech stack (tóm tắt):** Next.js 14 (App Router) · Supabase (PostgreSQL/Auth/Storage/Edge) · Tailwind CSS · TypeScript · Node 22+

---

## Tóm tắt nhanh

Doc2Share tiếp tục là marketplace tài liệu theo mô hình **secure access**: thanh toán qua **SePay/VietQR** rồi truy cập qua **Secure Reader** với cơ chế **zero-vector enforcement (SSW/image-mode)**, **watermark/forensic tracing**, và **RBAC + single-session binding** ở cả Next và Edge.

**Điểm mạnh nổi bật (Round 3)**

- **SSW image-mode được ép cho mọi tài liệu**: `POST /api/secure-pdf` luôn trả `403` kèm `X-D2S-*` watermark headers và `is_high_value: true`, khiến `SecureReader` luôn dùng `SecureImageRenderer`.
- **Forensic ID nâng cấp cho steganography**: `POST /api/secure-document-image` tạo `X-D2S-Forensic` theo dạng `D2S:<wmShort>:<sha256(device_id).slice(0,8)>` (tăng tính phân biệt so với chỉ `deviceId.slice(0,4)`).
- **Behavioral detection được “đưa vào đường chạy”**: `BehavioralTracker` phát hiện các mẫu lật trang bất thường và gửi sự kiện tới `POST /api/reader-observability`, nơi route cập nhật `risk_score` (RPC `increment_profile_risk_score`) và ghi `security_logs`.
- **SePay webhook idempotency & semantics retry đúng kỳ vọng**: handler dùng stable hashing + `register_webhook_event`/`complete_webhook_event`; `amount_mismatch` trả `400`, `ambiguous_order_match` trả `409`.
- **OTT resolver atomic one-time**: `supabase/functions/resolve-ott/index.ts` thực hiện conditional update `used=false` + `expires_at > now` để chống race.

**Rủi ro / điểm cần cải thiện ưu tiên**

- **Rate limiting hiện neo vào “open doc flow” (`secure-pdf`)**: `secure-document-image` không gọi `logSuccess()`, nên nếu kẻ tấn công gọi trực tiếp image endpoint có thể bớt/né phần quota dựa trên `access_logs.status='success'` của `secure-pdf`.
- **`/api/secure-pdf` gán `is_high_value: true` cho mọi tài liệu**: giúp ép client vào SSW, nhưng làm lệch ý nghĩa “high-value tier” nếu DB đang phân biệt `documents.is_high_value`.
- **`reader-observability` dùng in-memory rate limiting theo IP**: có thể bypass (thay đổi IP) và Map có nguy cơ tăng trưởng không được dọn dẹp theo thời gian (memory pressure) khi có nhiều IP.
- **Deterrence vẫn là client-side**: chặn copy/cut/drag/screenshot/phím tắt giúp giảm rủi ro phổ thông, nhưng không phải hard DRM (trích xuất vẫn có thể theo hướng ảnh raster/forensics).

---

## Phạm vi & phương pháp

### Phạm vi đánh giá (đã khảo sát)

- **Auth & Admin RBAC**: `src/middleware.ts`, `src/lib/supabase/middleware.ts`, `src/lib/admin/guards.ts`, `src/lib/admin/guards-core.ts`.
- **Single session binding**: `src/lib/auth/single-session/registerDeviceAndSession.ts`, `src/lib/auth/single-session/validate.ts` + policy ở `src/lib/secure-access/run-next-secure-document-access.ts` và rule thuần `src/lib/secure-access/secure-access-core.ts`.
- **Checkout & Payment**: `src/app/checkout/actions.ts`, domain checkout ports/adapters (`src/lib/domain/checkout/...`).
- **Secure access (Next + core + Edge + OTT)**:
  - Next gate: `src/lib/secure-access/run-next-secure-document-access.ts`.
  - Secure endpoints: `src/app/api/secure-pdf/route.ts`, `src/app/api/secure-document-image/route.ts`.
  - Edge: `supabase/functions/get-secure-link/index.ts`.
  - OTT resolver: `supabase/functions/resolve-ott/index.ts`.
- **Secure Reader & chống trích xuất (deterrence + watermark/forensic)**:
  - UI: `src/features/documents/read/components/SecureReader.tsx`.
  - Deterrence guards: `src/features/documents/read/hooks/useReaderSecurityGuards.ts`.
  - Fetch/decode + auto-heal session: `src/features/documents/read/hooks/usePdfFetchAndDecode.ts`.
  - Forensic mode: `src/features/documents/read/components/SecureImageRenderer.tsx` (được kích hoạt qua `isHighValueDoc`).
- **Observability & Security analytics**:
  - Reader observability route: `src/app/api/reader-observability/route.ts`.
  - Watermark fallback event: `watermark_degraded_fallback` (handled trong route).
- **Upload & Pipeline**: `src/app/admin/documents/upload-document-with-metadata-action.ts`, `src/lib/domain/document-upload/services/upload-orchestrator.ts`, `src/app/api/internal/document-pipeline/run/route.ts`.
- **Testing/CI/Docs**:
  - Integration test: `src/test-integration/webhook-sepay-route-level.test.ts`, `src/test-integration/ott-resolve-race.integration.test.ts`, `src/test-integration/secure-pdf-watermark.integration.test.ts`.
  - CI gates: `/.github/workflows/ci.yml` và scripts test trong `package.json`.

---

## Sơ đồ luồng

### 1) Checkout -> Webhook -> Permissions -> Secure Reader

```mermaid
flowchart TB
  subgraph checkout[Checkout]
    A[SePay/VietQR checkout<br/>`src/app/checkout/actions.ts`] --> B[create_checkout_order]
  end

  subgraph pay[SePay Webhook]
    C[SePay POST<br/>`src/app/api/webhook/sepay/route.ts`] --> D[`src/lib/webhooks/sepay.ts`<br/>register/complete webhook event]
    D --> E[match orders + validate amount]
    E --> F[RPC complete_order_and_grant_permissions]
  end

  subgraph access[Secure Access + Reader]
    G[Doc read page<br/>`src/app/doc/[id]/read/page.tsx`] --> H[`SecureReader.tsx`]
    H --> I[POST /api/secure-pdf -> 403 + SSW headers]
    I --> J[SecureImageRenderer -> POST /api/secure-document-image<br/>rasterize + forensic watermark]
  end
```

### 2) Secure access core -> Next vs Edge + OTT

```mermaid
flowchart LR
  R[secure-access-core.ts<br/>pure rules] --> N[Next gate<br/>run-next-secure-document-access.ts]
  R --> E1[Edge gate (get-secure-link)<br/>`supabase/functions/get-secure-link/index.ts`]
  E1 --> OTT[OTT nonce -> resolve-ott]
  OTT --> RES[Single-use signed URL]
```

---

## Đánh giá chi tiết (7 mảng)

### 1) `feat` (Chức năng & luồng nghiệp vụ)

**Đã làm được**

- **SePay webhook route-level idempotency và retry semantics**:
  - stable hashing (`stableStringify` -> `payloadHash` -> `eventId`) và `admin.rpc("register_webhook_event", ...)`.
  - Chỉ khi `should_process=true` mới thực sự match đơn/validate amount.
  - Luôn gọi `complete_webhook_event` khi kết thúc nhánh xử lý (`processed`/`ignored`/`error`).
  - `amount_mismatch` trả `400` và `ambiguous_order_match` trả `409`.
- **OTT resolver atomic one-time**:
  - `resolve-ott` dùng conditional update `.update({ used: true }).eq("used", false).gt("expires_at", nowIso).select("storage_path")`.
  - Nếu không match row atomic, còn có follow-up phân loại `403/410` (invalid/expired/used).
- **Zero-vector enforcement cho mọi tài liệu**:
  - `POST /api/secure-pdf` luôn trả `403` + `X-D2S-WM-*` headers và `is_high_value: true`.
  - `SecureReader` chọn `SecureImageRenderer` khi `isHighValueDoc` (vì client lấy từ header `X-D2S-Is-High-Value` / body `is_high_value`).
- **Forensic tracing đi kèm rasterized output**:
  - `POST /api/secure-document-image` tạo `X-D2S-Forensic` phục vụ steganography và gửi kèm response headers cho UI/đối soát.
- **Behavioral detection được đưa vào đường chạy**:
  - `BehavioralTracker` theo dõi thời gian lật trang; phát hiện `high_frequency_flipping` và `robotic_regularity`.
  - `POST /api/reader-observability` nhận event và cập nhật `risk_score` qua RPC.

**Điểm mạnh**

- Luồng payment -> permission -> secure read có tính “khép kín” hơn round trước nhờ route-level idempotency đã được tích hợp và verified bằng integration test.
- Zero-vector enforcement giảm đáng kể bề mặt “vector PDF exposure” và làm client render thống nhất ở image mode.
- ForensicId có độ phân biệt tốt hơn, giúp tăng khả năng tracing và điều tra rò rỉ.

**Rủi ro / yếu điểm (tác động thực tế)**

- **Rate limiting bypass theo endpoint**:
  - `runNextSecureDocumentAccess` áp quota theo `access_logs` action `secure_pdf` với `status='success'`.
  - `secure-document-image` không gọi `logSuccess()`, nên nếu gọi trực tiếp image endpoint thì quota “open doc” có thể không bị ghi tăng tương ứng.
- **High-value semantics bị “đồng nhất hóa”**:
  - `secure-pdf` hard-code `is_high_value: true` dù rule gate vẫn đọc `doc.is_high_value`.
  - Nếu product/DB kỳ vọng phân biệt tier, hiện tại client sẽ luôn vào mode “high-value/SSW”.
- **Behavioral tracking là tín hiệu client-side**:
  - Có thể gây false positive/over-sensitivity khi user flip trang nhanh hợp lệ.
  - Route đã “report once per session per anomaly type”, nhưng không có threshold/normalization theo bối cảnh (môi trường, tốc độ đọc khác nhau).

**Khuyến nghị**

- Siết quota cho `secure-document-image` theo 1 trong các hướng:
  - thêm action/logSuccess “image open” (log 1 lần/doc hoặc 1 lần/khung thời gian) để quota không bị bypass; hoặc
  - yêu cầu client gửi “open-flow request id”/token khi gọi image endpoint và validate server-side; hoặc
  - áp quota riêng cho action image endpoint (dựa trên `access_logs.action='secure_document_image'`).

---

### 2) `arch` (Kiến trúc & code quality)

**Đã làm được**

- Core rule tách pure math/policy: `src/lib/secure-access/secure-access-core.ts` định nghĩa device limit, session/device binding, permission expiry và các ngưỡng rate math.
- Handler Next/Edge chỉ làm I/O + gọi rule:
  - Next gate: `run-next-secure-document-access.ts`.
  - Edge gate: `supabase/functions/get-secure-link/index.ts` (đồng bộ theo tài liệu sync).
- SePay webhook “contract-first”:
  - route-level orchestration nằm ở `src/lib/webhooks/sepay.ts` thông qua RPC `register_webhook_event` và `complete_webhook_event`.
- OTT atomic single-use:
  - race được giải bằng conditional update và follow-up classification.

**Điểm mạnh**

- Có sự “kỷ luật contract” giữa DB/RPC và handler.
- Cách tái tạo Request trong `secure-document-image` để tránh body stream bị consume là thực dụng và giảm lỗi lặt vặt.

**Rủi ro / điểm còn thiếu**

- Một số “policy” gắn theo action `secure_pdf` có thể không phủ hết endpoint image (như vấn đề rate-limit bypass).

---

### 3) `ui` (UI/UX & trải nghiệm)

**Đã làm được**

- Trải nghiệm reader rõ ràng: có trạng thái loading/error, hướng dẫn retry và link quay về `/tu-sach`.
- Khả năng điều khiển có `aria-label` (phóng to/thu nhỏ, trang trước/sau, đóng).
- Deterrence được nâng cấp:
  - Chặn `contextmenu`, `copy`, `cut`, `dragstart`.
  - Chặn phím tắt `Ctrl/Cmd + (c/p/s/x)` và chặn `F12`.
  - Chặn `PrintScreen`/`Snapshot` và các biến thể macOS screenshot `Cmd+Shift+3/4/5`, đồng thời bật overlay `contentHidden`.
- Overlay `contentHidden` được kích hoạt khi `document.visibilityState==='hidden'` và cho phép click/Enter để tiếp tục khi tab visible trở lại.

**Điểm mạnh**

- Deterrence “UX-friendly” hơn: không che toàn bộ theo focus/blur như một số triển khai thô, mà tập trung vào tab-visibility để giảm gây khó đọc.
- Có integration BehavioralTracker mà không làm UI quá nặng (event chỉ gửi khi phát hiện anomaly theo ngưỡng).

**Rủi ro**

- Deterrence là client-side: kẻ tấn công vẫn có thể bỏ qua/chụp qua kỹ thuật cao (devtools/network/capture từ ảnh raster).

---

### 4) `perf` (Hiệu năng & độ ổn định)

**Đã làm được**

- `secure-pdf` không streaming vector PDF nữa; client đi SSW image-mode thống nhất.
- `secure-document-image` có cache in-memory cho `pdfBuffer`:
  - TTL 5 phút (`CACHE_TTL_MS`), giới hạn tối đa 10 entries (`MAX_CACHE_ENTRIES`).
- Rasterize có kiểm soát:
  - `rasterizePdfPage(... scale: 2.0)` cố định độ nét để giảm lỗi “mờ” làm tăng tranh cãi chất lượng.
- `reader-observability` có in-memory throttling:
  - chặn lạm dụng API trong cửa sổ 10 phút (10 events/IP/window) để hạn chế lạm dụng điểm rủi ro.

**Rủi ro / điểm cần chú ý**

- In-memory cache và Map trong observability là theo instance:
  - multi-instance/multi-container sẽ làm giảm hiệu quả throttling/caching.
  - Map trong observability không có cơ chế dọn key cũ ngoài reset theo `resetAt`, nên có nguy cơ tăng kích thước Map khi số IP tăng theo thời gian.

---

### 5) `sec` (Bảo mật & tuân thủ)

**Đã làm được (nền tảng)**

- Gate server-side:
  - `runNextSecureDocumentAccess` kiểm tra auth, validate `document_id`, validate `device_id`, profile lock/banned_until, device limit, session/device binding (`no_active_session` vs `device_mismatch`), permission + expiry, và rate math.
  - Error trả về có `code`/`reason` phục vụ client auto-heal có điều kiện.
- Single-session / session binding semantics được phân biệt:
  - `SESSION_BINDING_FAILED` + `body.reason` phân loại rõ `no_active_session` (client được auto-register) và `device_mismatch` (client không auto-register).
- Deterrence + zero-vector:
  - `secure-pdf` ép client vào image mode (tránh vector PDF).
  - `secure-document-image` embed forensic ID theo watermark/device signature.
- OTT atomic one-time:
  - update used trong cùng round-trip, giảm race.
- Behavioral security signaling:
  - Route `reader-observability` có whitelist event types và cập nhật `risk_score` qua RPC.

**Rủi ro / yếu điểm bảo mật quan trọng**

- **Rate-limit bypass qua endpoint image** (nêu ở `feat/arch`):
  - quota dựa vào `secure_pdf success` nên có thể bị né bằng call trực tiếp `secure-document-image`.
- **Deterrence client-side**:
  - không đạt hard DRM; chỉ là deterrence + watermark/traceability.
- **Observability rate-limiting keyed theo IP**:
  - attacker có thể đổi IP để gửi nhiều event; và Map không có eviction chủ động.

---

### 6) `test` (Kiểm thử & CI/CD)

**Đã làm được**

- Integration test SePay route-level:
  - `src/test-integration/webhook-sepay-route-level.test.ts` assert `webhook_events.status`, `error_message`, và `permissions.granted_at`.
- Concurrency test OTT atomic:
  - `src/test-integration/ott-resolve-race.integration.test.ts` gửi 2 request song song cùng token và assert đúng `302`/`410`/`403`.
- Watermark integration:
  - `src/test-integration/secure-pdf-watermark.integration.test.ts` kiểm header watermark tracing.
- CI có gates thông qua scripts trong `package.json` (unit/integration/e2e).

**Rủi ro / lỗ hổng test**

- Chưa thấy test đặc thù cho:
  - `POST /api/reader-observability` (throttle + cập nhật risk score + whitelist event type).
  - rate-limit consistency giữa `secure-pdf` và `secure-document-image` (để đảm bảo không bypass quota).

---

### 7) `docs` (Tài liệu & hướng dẫn sử dụng)

**Đã làm được**

- Có tài liệu secure access sync để giữ “một nguồn sự thật” giữa Next và Edge.
- Có checklist và runbook phục vụ route-level và ops.

**Rủi ro**

- Nếu `secure-pdf` đã ép SSW cho mọi tài liệu, docs/từ ngữ “high-value tier” cần được rà để tránh hiểu nhầm giữa `documents.is_high_value` và behavior thực tế.

---

## Chấm điểm tổng hợp

| Tiêu chí | Điểm (1-10) | Nhận xét ngắn |
|---|---:|---|
| Kiến trúc & Tổ chức | 9.2 | Core thuần + hợp đồng RPC/webhook/OTT tốt; policy drift chủ yếu nằm ở rate-limit endpoint. |
| Code Quality | 9.0 | TS ổn định, nhiều guardrails thực dụng (rebuild Request, stable hashing). |
| UI/UX & Accessibility | 8.8 | Deterrence và overlay logic rõ ràng; thêm BehavioralTracker không ảnh hưởng UX. |
| Hiệu năng & Độ ổn định | 8.4 | Rasterize + cache tốt, nhưng in-memory Map có rủi ro instance-local/throttle. |
| Bảo mật & Tuân thủ | 8.9 | Zero-vector + forensic + risk signaling mạnh; rate-limit bypass endpoint là điểm cần fix. |
| Testing & CI/CD | 8.6 | Có route-level webhook + OTT race + watermark integration; thiếu tests cho reader-observability và quota consistency. |
| Tài liệu hóa & vận hành | 8.6 | Đủ tài liệu nền; cần rà lại thuật ngữ/tier nếu behavior đã ép SSW cho mọi tài liệu. |

**Tổng trung bình (ước lượng): `8.7/10`**

---

## Ưu tiên hành động (P0/P1/P2)

### P0 (Khẩn cấp, high impact)

1. **Chặn rate-limit bypass qua `secure-document-image`**
   - Xác định rõ “quota unit” nên là theo `secure_pdf open`, theo `image render`, hay theo “document open session”.
   - Triển khai cơ chế đảm bảo gọi trực tiếp image endpoint vẫn bị giới hạn tương đương với call thông qua open flow.

### P1 (Quan trọng, medium effort)

1. **Đã thực hiện: thêm test cho `POST /api/reader-observability`**
   - Thêm integration test `src/test-integration/reader-observability-route-level.test.ts` để kiểm whitelist `event_type`, validate schema (`document_id`, `device_id`), verify side-effects DB theo `anomaly_type` (RPC `increment_profile_risk_score` + `security_logs`) và kiểm throttling không thể bypass bằng thay đổi `x-forwarded-for`.
2. **Đã thực hiện: chuẩn hóa throttling theo user (không chỉ IP)**
   - Cập nhật `src/app/api/reader-observability/route.ts` để rate limiting keyed theo `user_id` và dọn Map các bucket đã hết hạn (kèm hard cap để tránh tăng trưởng bộ nhớ ngoài dự kiến).

### P2 (Cải tiến sau)

1. **Rà lại docs về “high-value tier semantics”**
   - Làm rõ: hiện tại `secure-pdf` ép SSW cho mọi tài liệu (behavior thực tế) và `documents.is_high_value` đang đóng vai trò gì trong UI/logic.

---

## Verification checklist (chèn vào file)

- **SSW / Zero-vector enforcement**
  - `POST /api/secure-pdf` luôn trả `403` với `X-D2S-Is-High-Value=true` và watermark headers.
  - `SecureReader` luôn render `SecureImageRenderer` (vì `isHighValueDoc` true).
- **SePay route-level idempotency**
  - Happy path => HTTP `200`, `webhook_events.status=processed`, `orders.status=completed`, `permissions.granted_at` xuất hiện.
  - Amount mismatch => HTTP `400`, `webhook_events.status=error`, `error_message=amount_mismatch`, không grant permissions.
  - Replay => HTTP `200`, `permissions.granted_at` không đổi.
- **OTT resolver**
  - 2 request song song cùng token => đúng 1 redirect `302`, request còn lại `410` hoặc `403`.
- **Reader deterrence**
  - PrintScreen/Snapshot => overlay `contentHidden=true`.
  - Visibility hidden => overlay bật; visibility visible => overlay tắt.
- **Behavioral detection**
  - Lật trang bất thường => gọi `/api/reader-observability` và cập nhật risk score/security logs (đúng anomaly type).

---

## Checklist “không bỏ sót” (đối chiếu theo yêu cầu)

- [x] Login/session (Supabase auth + single-session cookies)  
  Evidence: `src/lib/auth/single-session/registerDeviceAndSession.ts`, `src/lib/auth/single-session/validate.ts`, `src/lib/secure-access/run-next-secure-document-access.ts`
- [x] Admin gate (middleware RBAC + guards)  
  Evidence: `src/middleware.ts`, `src/lib/supabase/middleware.ts`, `src/lib/admin/guards.ts`, `src/lib/admin/guards-core.ts`
- [x] Checkout & tạo order  
  Evidence: `src/app/checkout/actions.ts`, domain checkout ports/adapters
- [x] Webhook SePay (parse refs/amount -> complete order -> permissions)  
  Evidence: `src/app/api/webhook/sepay/route.ts`, `src/lib/webhooks/sepay.ts`, test `src/test-integration/webhook-sepay-route-level.test.ts`
- [x] Secure-pdf -> SecureReader (SSW + watermark + audit)  
  Evidence: `src/app/api/secure-pdf/route.ts`, `src/features/documents/read/components/SecureReader.tsx`, `src/lib/secure-access/run-next-secure-document-access.ts`
- [x] Secure-image mode (rasterize + forensic + cache + no double-count logSuccess)  
  Evidence: `src/app/api/secure-document-image/route.ts`, `src/features/documents/read/components/SecureImageRenderer.tsx`
- [x] Secure-link/Edge path + OTT resolver  
  Evidence: `supabase/functions/get-secure-link/index.ts`, `supabase/functions/resolve-ott/index.ts`
- [x] Behavioral/security signaling (reader observability + risk score)  
  Evidence: `src/lib/secure-access/behavioral/behavioral-tracker.ts`, `src/app/api/reader-observability/route.ts`
- [x] Upload & pipeline tick  
  Evidence: `src/app/admin/documents/upload-document-with-metadata-action.ts`, `src/lib/domain/document-upload/services/upload-orchestrator.ts`, `src/app/api/internal/document-pipeline/run/route.ts`
- [x] Observability/Audit (access_logs/security_logs/observability events)  
  Evidence: `src/lib/access-log.ts`, `src/app/api/reader-observability/route.ts`
- [x] Testing/CI & build gates  
  Evidence: `src/test-integration/webhook-sepay-route-level.test.ts`, `src/test-integration/ott-resolve-race.integration.test.ts`, `src/test-integration/secure-pdf-watermark.integration.test.ts`, `/.github/workflows/ci.yml`
- [x] Documentation & runbook for ops  
  Evidence: `README.md`, secure access sync doc (`docs/SECURE-ACCESS-SYNC.md`), checklist/tài liệu route-level

---

## Appendix: Evidence (theo nhóm)

### Secure access (core/handlers/Edge/OTT)

- `src/lib/secure-access/secure-access-core.ts`
- `src/lib/secure-access/run-next-secure-document-access.ts`
- `src/app/api/secure-pdf/route.ts`
- `src/app/api/secure-document-image/route.ts`
- `supabase/functions/get-secure-link/index.ts`
- `supabase/functions/resolve-ott/index.ts`
- `src/app/api/secure-link/route.ts` (deprecated endpoint)

### Secure Reader (deterrence + behavioral + watermark/forensic)

- `src/features/documents/read/components/SecureReader.tsx`
- `src/features/documents/read/hooks/useReaderSecurityGuards.ts`
- `src/features/documents/read/hooks/usePdfFetchAndDecode.ts`
- `src/lib/secure-access/behavioral/behavioral-tracker.ts`
- `src/app/api/reader-observability/route.ts`

### Auth/RBAC/Single-session

- `src/middleware.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/admin/guards.ts`
- `src/lib/admin/guards-core.ts`
- `src/lib/auth/single-session/registerDeviceAndSession.ts`
- `src/lib/auth/single-session/validate.ts`

### Checkout & SePay webhook

- `src/app/checkout/actions.ts`
- `src/app/api/webhook/sepay/route.ts`
- `src/lib/webhooks/sepay.ts`
- `src/lib/payments/sepay-webhook-core.ts` (mapping refs/payload)
- `src/test-integration/webhook-sepay-route-level.test.ts`

### Upload & Pipeline

- `src/app/admin/documents/upload-document-with-metadata-action.ts`
- `src/lib/domain/document-upload/services/upload-orchestrator.ts`
- `src/app/api/internal/document-pipeline/run/route.ts`

### Observability/Audit

- `src/lib/access-log.ts`
- `src/app/api/reader-observability/route.ts`

### Testing/CI/Docs

- `src/test-integration/ott-resolve-race.integration.test.ts`
- `src/test-integration/secure-pdf-watermark.integration.test.ts`
- `/.github/workflows/ci.yml`
- `docs/SECURE-ACCESS-SYNC.md`

