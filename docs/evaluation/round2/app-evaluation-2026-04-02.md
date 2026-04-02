# Đánh giá ứng dụng Doc2Share (Round 2)

> **Ngày đánh giá:** 2026-04-02  
> **Phiên bản repo:** `0.1.0`  
> **Tech stack (tóm tắt):** Next.js 14 (App Router) · Supabase (PostgreSQL/Auth/Storage/Edge) · Tailwind CSS · TypeScript · Node 22+

---

## Tóm tắt nhanh

Doc2Share vẫn là marketplace tài liệu theo mô hình **secure access**: người dùng thanh toán qua **SePay/VietQR**, sau đó truy cập tài liệu thông qua lớp **Secure Reader** (watermark/forensic + deterrence) với luồng backend tập trung vào `POST /api/webhook/sepay`, quyền truy cập trong DB, và gate đọc tài liệu trong `src/lib/secure-access/run-next-secure-document-access.ts` + core rules `src/lib/secure-access/secure-access-core.ts` (sync sang Edge).

**Điểm mạnh nổi bật**

- **Route-level idempotency & HTTP semantics cho SePay đã được áp dụng trong handler**:
  - `handleSePayWebhook` gọi `register_webhook_event` ngay trong `src/lib/webhooks/sepay.ts`.
  - Chỉ khi `should_process=true` mới đi vào bước match/validate/complete, và luôn “complete event” trong các nhánh kết thúc.
  - `amount_mismatch` trả `400`, `ambiguous_order_match` trả `409` (khớp kỳ vọng retry của provider).
- **OTT single-use race được sửa theo hướng atomic**:
  - `supabase/functions/resolve-ott/index.ts` dùng conditional update `used=false` + `expires_at > now` rồi lấy `storage_path` trong cùng round-trip.
- **Zero-vector được áp dụng cho mọi tài liệu**:
  - `src/app/api/secure-pdf/route.ts` luôn trả `403` + headers SSW để client chuyển sang image mode (không còn trả vector PDF).
  - Watermark forensic tracing headers luôn đi kèm response (hoặc fallback watermark).
- **Testing/CI có bằng chứng route-level**:
  - `src/test-integration/webhook-sepay-route-level.test.ts` xác nhận happy path + amount mismatch + replay (assert cả `webhook_events` và `permissions.granted_at`).

**Rủi ro / điểm cần cải thiện ưu tiên**

- **Deterrence vẫn là client-side**: cơ chế che/chặn chủ yếu giúp giảm rủi ro phổ thông; sau P0, đường vector PDF bị loại bỏ, nhưng việc trích xuất vẫn có thể xảy ra theo hướng từ ảnh đã rasterize.
- **Edge active-session policy đã được auto-create nhưng cần rà metrics**:
  - Edge `get-secure-link` giờ tự tạo `active_sessions` khi thiếu; phía Next vẫn phụ thuộc cookie/`active_sessions` cho `/api/secure-pdf`.
- **Audit “success”/views có thể diễn giải khác**:
  - Vì P0 loại bỏ `logSuccess()` mỗi lần render image page, `access_logs`/rate-limit analytics cho image mode có thể cần diễn giải lại.

---

## Phạm vi & phương pháp

### Phạm vi đánh giá (đã khảo sát)

- **Auth & Admin RBAC:** `src/middleware.ts`, `src/lib/supabase/middleware.ts`, các integration test RLS/admin bảo vệ.
- **Single session binding:** `src/lib/auth/single-session/registerDeviceAndSession.ts`, `src/lib/auth/single-session/validate.ts` và policy logic.
- **Checkout & Payment:** `src/app/checkout/actions.ts` + core parse/match `src/lib/payments/sepay-webhook-core.ts` + webhook handler `src/lib/webhooks/sepay.ts`.
- **Secure access (Next + core + Edge + OTT):**
  - Next gate: `src/lib/secure-access/run-next-secure-document-access.ts`
  - Secure endpoints: `src/app/api/secure-pdf/route.ts`, `src/app/api/secure-document-image/route.ts`
  - Edge: `supabase/functions/get-secure-link/index.ts`
  - OTT resolver: `supabase/functions/resolve-ott/index.ts`
- **Secure Reader & chống trích xuất (deterrence + watermark/forensic):**
  - `src/features/documents/read/components/SecureReader.tsx`
  - `src/features/documents/read/hooks/usePdfFetchAndDecode.ts`
  - `src/features/documents/read/components/PdfCanvasRenderer.tsx`
  - `src/features/documents/read/components/SecureImageRenderer.tsx`
  - `src/lib/watermark/watermark-issuer.ts`, `src/lib/watermark/watermark-overlay.ts`
- **Observability/Audit:** `src/lib/access-log.ts`, `src/app/api/reader-observability/route.ts`.
- **Upload & Pipeline:** `src/app/admin/documents/upload-document-with-metadata-action.ts`, `src/lib/domain/document-upload/services/upload-orchestrator.ts`, và `src/app/api/internal/document-pipeline/run/route.ts`.
- **Testing/CI/Docs:** `TESTING.md`, `/.github/workflows/ci.yml`, các test integration/unit + checklist secure access sync.

### Dữ liệu đầu vào

Phần đánh giá dựa trên evidence trực tiếp từ code và tài liệu trong repo (được liệt kê ở Appendix).

---

## Sơ đồ luồng

### 1) Checkout -> Webhook -> Permissions -> Secure Reader

```mermaid
flowchart TB
  subgraph checkout[Checkout]
    A[createCheckoutVietQr<br/>`src/app/checkout/actions.ts`] --> B[runCheckoutOrchestrator<br/>`src/lib/domain/checkout/...`]
    B --> C[orders.external_id + amount]
    C --> D[VietQR link build]
  end

  subgraph pay[SePay Webhook]
    E[SePay POST<br/>`src/app/api/webhook/sepay/route.ts`] --> F[handleSePayWebhook<br/>`src/lib/webhooks/sepay.ts`]
    F --> G[RPC register_webhook_event]
    F -->|should_process=true| H[match orders + validate amount]
    H --> I[RPC complete_order_and_grant_permissions]
    F --> J[RPC complete_webhook_event]
  end

  subgraph access[Secure Access + Reader]
    K[Doc read page<br/>`src/app/doc/[id]/read/page.tsx` (entrypoint)] --> L[SecureReader UI]
    L --> O[POST /api/secure-document-image<br/>rasterize + forensic + cache pdfBuffer]
  end
```

### 2) Secure access core -> Next vs Edge + OTT

```mermaid
flowchart LR
  subgraph core[SecureAccess Core Rules]
    R[secure-access-core.ts<br/>pure device/session/permission/rate]
  end

  subgraph next[Next API]
    SP[POST /api/secure-pdf<br/>403 SSW hint (never returns vector PDF)] --> S1[runNextSecureDocumentAccess]
    SI[POST /api/secure-document-image<br/>rasterize SSW pages] --> S2[runNextSecureDocumentAccess]
  end

  subgraph edge[Edge + OTT]
    GSI[Edge get-secure-link<br/>`supabase/functions/get-secure-link/index.ts`] --> OTT[OTT nonce -> resolve-ott]
    OTTN[supabase/functions/resolve-ott/index.ts<br/>atomic used marking] --> SIGNED[createSignedUrl + 1-time redirect]
  end

  R --> S1
  R --> S2
  R --> GSI
```

---

## Đánh giá chi tiết (7 mảng)

### 1) `feat` (Chức năng & luồng nghiệp vụ)

**Đã làm được**

- SePay webhook đã có đầy đủ route-level idempotency:
  - `register_webhook_event` + `complete_webhook_event` nằm trong `src/lib/webhooks/sepay.ts`.
  - Stable hashing: `stableStringify` -> `payloadHash` -> `eventId` qua `resolveEventId` trong `src/lib/payments/sepay-webhook-core.ts`.
- Validate nghiệp vụ & semantics rõ ràng:
  - Match order theo refs (UUID/prefix + fallback `external_id`).
  - `amount_mismatch` -> `400` + `webhook_events.error_message='amount_mismatch'`.
  - Ambiguous match -> `409` với `error='ambiguous_order_match'`.
- OTT resolver single-use đã atomic:
  - `resolve-ott/index.ts` update điều kiện `used=false` + `expires_at > now` rồi lấy `storage_path`.
- Secure Reader luôn chuyển sang image mode (zero-vector):
  - Client gọi `POST /api/secure-pdf` và nhận `403` + SSW headers.
  - Sau đó render bằng `POST /api/secure-document-image` (rasterize + watermarkText + forensicId).
- Auto-heal session binding được giới hạn theo reason:
  - `usePdfFetchAndDecode.ts` chỉ auto-register khi `403` + `body.code==='SESSION_BINDING_FAILED'` + `body.reason==='no_active_session'`.

**Điểm mạnh**

- “Contract drift” quan trọng ở round1 (webhook handler thiếu route-level idempotency) đã được fix bằng cách đưa `register_webhook_event` trực tiếp vào handler.
- Conformance cho “retry expectations” đã được kiểm chứng bằng integration test:
  - `src/test-integration/webhook-sepay-route-level.test.ts`.
- Zero-vector enforced qua `secure-pdf` (luôn 403 SSW) giúp loại bỏ rủi ro vector PDF.

**Rủi ro / yếu điểm (tác động thực tế)**

- Trích xuất vẫn có thể xảy ra từ ảnh đã rasterize (zero-vector chỉ giảm “vector extraction”).
- Auto-heal vẫn có trade-off UX vs enforcement: trong trường hợp người dùng không có `active_sessions` row, hệ thống sẽ tự tạo session/device (đúng theo usability), nhưng attacker có thể lợi dụng policy để “hợp thức hóa” lại session bằng cách tạo device/session từ phía client (tùy threat model).
- Edge `get-secure-link` giờ auto-create `active_sessions` khi thiếu; 403 liên quan chủ yếu còn lại ở các gate khác (ví dụ `device_mismatch`).

**Khuyến nghị**

- Với threat model cao: harden image-mode hơn (tăng forensic/invariant, và đảm bảo rate-limit/audit semantics cho render ảnh).
- Rà lại docs/runbook/dashboard cho behavior Edge auto-create `active_sessions` và việc thay đổi log Success ở image-mode.

---

### 2) `arch` (Kiến trúc & code quality)

**Đã làm được**

- Core thuần & sync kỷ luật:
  - `src/lib/secure-access/secure-access-core.ts` là pure rules.
  - Next/Edge chỉ làm I/O + gọi core.
  - `docs/SECURE-ACCESS-SYNC.md` nêu quy trình sync `npm run sync:secure-access`.
- Ports/adapters cho các domain:
  - Checkout và upload orchestrator có cấu trúc ports (`createCheckoutRepository`, `createSupabaseDocumentUploadRepository`).
- ActionResult thống nhất cho server actions:
  - `src/lib/action-result.ts` (dùng xuyên suốt upload/checkout).

**Điểm mạnh**

- Webhook đã “đi đúng kiến trúc contract” (route-level orchestration nằm ở handler; pure parsing/mapping ở core).
- Secure access helpers tách gate logic (`run-next-secure-document-access.ts`) khỏi pure rules (`secure-access-core.ts`).

**Rủi ro / điểm còn thiếu**

- Có dấu hiệu drift giữa tài liệu và code về Edge `active_sessions` policy (điểm cần xử lý để tránh lỗi tích hợp từ mobile/Bearer client).

**Khuyến nghị**

- Thêm “contract tests” cho Edge `get-secure-link` theo policy activeSession/device mismatch (nếu có E2E contract suite cho Edge).

---

### 3) `ui` (UI/UX & trải nghiệm)

**Đã làm được**

- Secure Reader có trạng thái rõ ràng (loading/error).
- Accessible controls:
  - Nút điều hướng trang có `aria-label` (ví dụ `Trang trước`, `Trang sau`, `Phóng to`, `Thu nhỏ`, `Đóng`).
- Deterrence UX:
  - Che đen khi tab ẩn.
  - Chặn copy/cut/context menu/phím tắt và che đen khi PrintScreen/Snapshot.
- High-value mode được chuyển theo header `X-D2S-Is-High-Value`/payload `is_high_value`.

**Điểm mạnh**

- UX fallback hợp lý:
  - Khi thiếu watermark headers, client chuyển sang watermark degraded mode và gửi observability event `watermark_degraded_fallback`.

**Rủi ro**

- Deterrence chỉ có tính deterrence (không ngăn được extraction bằng kỹ thuật cao, devtools/network capture).
- Blur/ẩn chỉ che nội dung; không có chặn cứng truy cập payload cho vector path.

---

### 4) `perf` (Hiệu năng & độ ổn định)

**Đã làm được**

- `secure-pdf` zero-vector:
  - luôn trả `403` + SSW headers để client chuyển sang `secure-document-image` (không còn streaming vector PDF).
- `secure-document-image` có cache:
  - In-memory `pdfBufferCache` TTL 5 phút, max 10 entries, giảm chi phí download từ storage per-page.
- Rasterize/SSW có cơ chế cache ở server giúp giảm download lặp.

**Rủi ro / điểm cần chú ý**

- `secure-document-image` giờ áp dụng cho mọi tài liệu (P0), có thể làm tăng tải CPU/latency do rasterize nhiều trang.
- Vì `secure-document-image` (P0) không gọi `logSuccess` mỗi trang, cách tính “views thành công”/rate-limit theo access_logs có thể diễn giải khác so với trước.

---

### 5) `sec` (Bảo mật & tuân thủ)

**Đã làm được (nền tảng)**

- Gate server-side trước khi trả nội dung:
  - `runNextSecureDocumentAccess` kiểm tra: auth, profile lock/active, device limit, session/device binding, permission/expiry, rate limits.
- Audit trail:
  - `src/lib/access-log.ts` ghi `access_logs` action `secure_pdf` cho `logSecurePdfAccess`.
- Watermark forensic tracing:
  - `src/lib/watermark/watermark-issuer.ts` tạo `wmShort/wmDocShort/wmIssuedAtBucket/wmVersion`.
  - `PdfCanvasRenderer` render watermark grid + adaptive paint.
  - `secure-pdf` trả headers watermark tracing (`X-D2S-WM-*`).
  - `secure-document-image` trả `X-D2S-Forensic` (forensicId gồm watermark + device slice).
- Single-use OTT race fix:
  - `resolve-ott` atomic mark used + TTL rất ngắn.
- Webhook security:
  - SePay route xác thực API key `isSePayAuthorized` + stable hashing + idempotency contract.

**Rủi ro / yếu điểm bảo mật quan trọng**

- **Không phải hard DRM (zero-vector chỉ giảm “vector extraction”)**:
  - `secure-pdf` giờ luôn trả `403` SSW để loại bỏ việc tải PDF vector; tuy nhiên nội dung vẫn có thể bị trích xuất dưới dạng ảnh raster (tùy threat model).
- **Edge activeSession policy đã được auto-create**:
  - Edge `get-secure-link` tự tạo `active_sessions` khi thiếu; `device_mismatch` vẫn bị chặn bằng `403` (không vô hiệu hóa single-session/device limit).
- **Client auto-heal**:
  - Dù đã giới hạn reason `no_active_session`, cơ chế này vẫn mở đường để “hợp thức hóa session” khi active session chưa tồn tại.

**Khuyến nghị**

- Nếu threat model yêu cầu cao: cân nhắc hardening mạnh hơn cho image mode (giảm bề mặt trích xuất từ ảnh raster).
- Rà lại docs/runbook/metrics cho image mode:
  - do `secure-document-image` không log “success per-page” (để tránh double-count rate-limit), các dashboard “views”/audit có thể cần diễn giải lại.

---

### 6) `test` (Kiểm thử & CI/CD)

**Đã làm được**

- Unit tests cho core & parsing:
  - `src/lib/secure-access/secure-access-core.test.ts`
  - `src/lib/payments/sepay-webhook.test.ts`
- Integration tests route-level:
  - `src/test-integration/webhook-sepay-route-level.test.ts` (SePay webhook + DB contract + replay).
  - `src/test-integration/secure-pdf-watermark.integration.test.ts` (watermark tracing headers).
- Integration tests bảo mật admin/RLS:
  - `src/test-integration/rls-admin.test.ts`
  - `src/test-integration/admin-security-p0/p1/p2.integration.test.ts`
- E2E Playwright có các spec chính (login, checkout pending, admin pending, filters).
- CI:
  - `/.github/workflows/ci.yml` chạy `npm run check:sync`, `npm run lint`, `npm run test`, `npm run build`, và suite e2e + observability.

**Rủi ro / lỗ hổng test**

- Một số test integration còn deferred/skip (ví dụ logout cleanup integration đang `{ skip: true }`), có thể bỏ sót contract cookie clear / session revoke end-to-end.
- Chưa thấy test concurrency cụ thể cho OTT resolver trong suite (dù code đã atomic; vẫn nên có “race test” ở môi trường Supabase local/staging).

**Khuyến nghị**

- Bổ sung concurrency test cho OTT resolver (2 request song song cùng token => chỉ 1 nhận signed URL).
- Re-enable/logout cleanup integration khi fixture auth cookie ổn định.

---

### 7) `docs` (Tài liệu & hướng dẫn sử dụng)

**Đã làm được**

- README/ARCHITECTURE/RUNBOOK/TESTING có cấu trúc rõ và có nhắc entrypoints + cách vận hành.
- Secure access sync guide:
  - `docs/SECURE-ACCESS-SYNC.md` mô tả “một nguồn sự thật” và pipeline sync từ core sang Edge.
- Integration checklist route-level:
  - `docs/INTEGRATION-CHECKLIST-checkout-webhook-tu-sach-secure-reader-route-level.md`.

**Rủi ro**

- Potential drift giữa docs/metrics và code thực tế `get-secure-link` (giờ auto-create `active_sessions` khi thiếu; cần rà dashboard/observability cho đúng semantics).
- `POST /api/secure-link` đã deprecate hard 410, tài liệu/nhắc cũ cần đảm bảo khớp behavior (dù route này đang hướng dẫn dùng `secure-pdf`).

---

## Chấm điểm tổng hợp

| Tiêu chí | Điểm (1-10) | Nhận xét ngắn |
|---|---:|---|
| Kiến trúc & Tổ chức | 9.4 | Core sync kỷ luật + webhook/OTT đã “đúng hợp đồng”. |
| Code Quality | 9.0 | TypeScript rõ ràng, tách pure/I/O tốt. |
| UI/UX & Accessibility | 8.3 | Trạng thái UX tốt, deterrence cơ bản; cần hard enforcement nếu tier cao. |
| Hiệu năng & Độ ổn định | 7.9 | Rasterize/SSW cho mọi tài liệu (tăng CPU/latency); rate-limit/audit semantics cho image mode cần diễn giải đúng. |
| Bảo mật & Tuân thủ | 9.2 | RLS/gate mạnh + idempotency/OTT atomic; zero-vector loại bỏ vector PDF exposure. |
| Testing & CI/CD | 8.9 | Có route-level integration + watermark + RLS/admin + CI gates. |
| Tài liệu hóa & vận hành | 8.6 | Có đầy đủ guide; cần rà runbook/dashboard cho auto-create session và image-mode metrics. |

**Tổng trung bình (ước lượng): `8.8/10`**

---

## Ưu tiên hành động (P0/P1/P2)

### P0 (Khẩn cấp, high impact)

1. **Đã thực hiện: Edge `get-secure-link` auto-create `active_sessions` khi thiếu**
   - Evidence: `supabase/functions/get-secure-link/index.ts` không còn trả 403 “no_active_session”; thay vào đó tạo session sau khi validate device gate.
2. **Đã thực hiện: Zero-vector cho mọi tài liệu**
   - Evidence: `src/app/api/secure-pdf/route.ts` luôn trả `403` SSW (không còn `application/pdf`); Secure Reader render image qua `src/app/api/secure-document-image/route.ts`.

### P1 (Quan trọng, medium effort)

1. **Đã thực hiện: OTT resolver race test**
   - Evidence: `src/test-integration/ott-resolve-race.integration.test.ts` (2 request song song cùng token => đúng 1 `302`, request còn lại `410/403`).
2. **Đã thực hiện: Audit/metrics semantics cho image mode**
   - Evidence: `src/app/api/secure-pdf/route.ts` gọi `access.ctx.logSuccess()` đúng 1 lần (dù trả `403` SSW) và `src/test-integration/secure-pdf-watermark.integration.test.ts` assert `access_logs` có `secure_pdf/success` theo `X-D2S-Request-ID`.
   - Và `secure-document-image` không double-count: test assert không có `access_logs` tương ứng với `X-D2S-Request-ID` của ảnh.
3. **Đã thực hiện: Hardening forensicId**
   - Evidence: `src/app/api/secure-document-image/route.ts` đổi từ `deviceId.slice(0, 4)` sang `sha256(deviceId)` truncated, giữ prefix `D2S:` cho header `X-D2S-Forensic`.

### P2 (Cải tiến sau)

1. **Tăng cường đo/detect deterrence gaps**
   - Xem `BehavioralTracker` hiện ở dạng nháp; mở rộng mô hình phát hiện bất thường theo “chống extraction” ở mức threat model.
2. **Chuẩn hóa docs về deprecation**
   - `POST /api/secure-link` đang trả 410; rà doc/links cũ để tránh người dùng/QA gọi nhầm.

---

## Verification checklist (chèn vào file)

- **Auto-heal:**
  - `no_active_session` => auto-heal OK (client gọi `registerDeviceAndSession(...)` và retry `/api/secure-pdf`).
  - `device_mismatch` => không auto-heal (không gọi `registerDeviceAndSession(...)`, trả lỗi theo UI).
- **Webhooks route-level (SePay):**
  - Happy path => HTTP `200`, `webhook_events.status='processed'`, `orders.status='completed'`, và `permissions.granted_at` xuất hiện.
  - Amount mismatch => HTTP `400`, `webhook_events.status='error'`, `error_message='amount_mismatch'`, và không cấp/không đổi `permissions`.
  - Replay => HTTP `200`, `granted_at` không đổi.
  - Ambiguous match => HTTP `409` và không grant quyền sai.
- **OTT resolver:**
  - Atomic mark used => 2 request song song cùng token chỉ 1 nhận signed URL; request còn lại nhận `410/403` (token đã used/expired).
- **Watermark tracing headers:**
  - `secure-pdf` trả `X-D2S-WM-Short`, `X-D2S-WM-Doc-Short`, `X-D2S-WM-Issued-At-Bucket`, `X-D2S-WM-Version`.

---

## Checklist “không bỏ sót” (đối chiếu theo yêu cầu)

- [x] Login/session (Supabase auth + single-session cookies)
  - Evidence: `src/app/login/actions.ts` (entry), `src/lib/auth/single-session/registerDeviceAndSession.ts`, `src/lib/auth/single-session/validate.ts`
- [x] Admin gate (middleware RBAC + guards)
  - Evidence: `src/lib/supabase/middleware.ts`, `src/middleware.ts`, RLS integration tests
- [x] Checkout & tạo order
  - Evidence: `src/app/checkout/actions.ts` + checkout integration usage in SePay route-level tests
- [x] Webhook SePay (parse refs/amount -> complete order -> permissions)
  - Evidence: `src/app/api/webhook/sepay/route.ts`, `src/lib/webhooks/sepay.ts`, `src/lib/payments/sepay-webhook-core.ts`, `src/test-integration/webhook-sepay-route-level.test.ts`
- [x] Secure-pdf -> SecureReader (watermark + audit + rate limit)
  - Evidence: `src/app/api/secure-pdf/route.ts`, `src/lib/secure-access/run-next-secure-document-access.ts`, reader components/hooks
- [x] Secure-image mode (SSW tier + forensic)
  - Evidence: `src/app/api/secure-document-image/route.ts`, `src/features/documents/read/components/SecureImageRenderer.tsx`
- [x] Secure-link/Edge path + OTT resolver
  - Evidence: `supabase/functions/get-secure-link/index.ts`, `supabase/functions/resolve-ott/index.ts`
- [x] Upload & pipeline tick
  - Evidence: `src/app/admin/documents/upload-document-with-metadata-action.ts`, `src/lib/domain/document-upload/services/upload-orchestrator.ts`, `src/app/api/internal/document-pipeline/run/route.ts`
- [x] Observability (access_logs/security_logs/observability_events)
  - Evidence: `src/lib/access-log.ts`, `src/app/api/reader-observability/route.ts`
- [x] Testing/CI & build gates
  - Evidence: `TESTING.md`, `/.github/workflows/ci.yml`, unit/integration/e2e suite (including SePay route-level tests and watermark integration)
- [x] Documentation & runbook for ops
  - Evidence: `README.md`, `ARCHITECTURE.md`, `RUNBOOK.md`, `TESTING.md`, `docs/SECURE-ACCESS-SYNC.md`

---

## Appendix: Evidence (theo nhóm)

### Secure access (core/handlers/Edge/OTT)
- `src/lib/secure-access/secure-access-core.ts`
- `src/lib/secure-access/run-next-secure-document-access.ts`
- `src/app/api/secure-pdf/route.ts`
- `src/app/api/secure-document-image/route.ts`
- `supabase/functions/get-secure-link/index.ts`
- `supabase/functions/resolve-ott/index.ts`
- `docs/SECURE-ACCESS-SYNC.md`

### Secure Reader (deterrence + watermark + high-value)
- `src/features/documents/read/components/SecureReader.tsx`
- `src/features/documents/read/hooks/usePdfFetchAndDecode.ts`
- `src/features/documents/read/components/PdfCanvasRenderer.tsx`
- `src/features/documents/read/components/SecureImageRenderer.tsx`
- `src/features/documents/read/hooks/useReaderSecurityGuards.ts`
- `src/lib/watermark/watermark-issuer.ts`
- `src/lib/watermark/watermark-overlay.ts`

### Auth/RBAC/Single-session
- `src/middleware.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/auth/single-session/registerDeviceAndSession.ts`
- `src/lib/auth/single-session/validate.ts`

### Checkout & SePay webhook
- `src/app/checkout/actions.ts`
- `src/app/api/webhook/sepay/route.ts`
- `src/lib/webhooks/sepay.ts`
- `src/lib/payments/sepay-webhook-core.ts`

### Upload & Pipeline
- `src/app/admin/documents/upload-document-with-metadata-action.ts`
- `src/lib/domain/document-upload/services/upload-orchestrator.ts`
- `src/app/api/internal/document-pipeline/run/route.ts`

### Observability/Audit
- `src/lib/access-log.ts`
- `src/app/api/reader-observability/route.ts`

### Testing/CI/Docs
- `TESTING.md`
- `/.github/workflows/ci.yml`
- `src/test-integration/webhook-sepay-route-level.test.ts`
- `src/test-integration/secure-pdf-watermark.integration.test.ts`
- `src/test-integration/rls-admin.test.ts`
- `src/test-integration/admin-security-p0.integration.test.ts`
- `src/test-integration/admin-security-p1.integration.test.ts`
- `src/test-integration/admin-security-p2.integration.test.ts`
- `e2e/*.spec.ts`
- `docs/INTEGRATION-CHECKLIST-checkout-webhook-tu-sach-secure-reader-route-level.md`

