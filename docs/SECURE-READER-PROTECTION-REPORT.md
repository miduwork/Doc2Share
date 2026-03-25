# Bao Cao Bao Ve Xem Tai Lieu

Ngay lap: 2026-03-24

## 1) Pham vi danh gia

Bao cao danh gia co che bao ve luong "xem tai lieu" trong du an Doc2Share, tap trung vao:

- Trang doc tai lieu: `src/app/doc/[id]/read/page.tsx`
- API cap/noi dung tai lieu: `src/app/api/secure-pdf/route.ts`, `src/app/api/secure-link/route.ts`
- Policy truy cap dung chung: `src/lib/secure-access/secure-access-core.ts`, `src/lib/secure-access/run-next-secure-document-access.ts`
- Reader frontend va guard: `src/features/documents/read/components/SecureReader.tsx`, `src/features/documents/read/hooks/useReaderSecurityGuards.ts`, `src/features/documents/read/components/PdfCanvasRenderer.tsx`
- Session/device binding: `src/lib/auth/single-session/registerDeviceAndSession.ts`, `src/lib/auth/single-session/validate.ts`, `src/lib/auth/session-binding-adapter.ts`
- Edge function lien quan: `supabase/functions/get-secure-link/index.ts`

## 2) Tong quan kien truc bao ve hien tai

He thong dang trien khai nhieu lop bao ve:

- **Lop xac thuc + quyen truy cap**:
  - Bat buoc user dang nhap.
  - Kiem tra profile active/ban.
  - Kiem tra quyen da mua tai lieu (`permissions`) va han su dung.
  - Co ngoai le cho admin role duoc phep doc rong hon.

- **Lop session/device binding**:
  - Dang ky thiet bi + session (`active_sessions`) qua `registerDeviceAndSession`.
  - Gioi han so thiet bi theo policy (`MAX_DEVICES_PER_USER = 2`).
  - API secure access check device/session truoc khi tra noi dung.

- **Lop rate limit va abuse control**:
  - Gioi han tan suat theo user/IP.
  - Gioi han truy cap nhieu tai lieu khac nhau trong 10 phut.
  - Co co che block neu so lan bi tu choi tang cao (brute-force signal).

- **Lop delivery noi dung**:
  - `secure-pdf` stream server-side tu private bucket, khong expose direct public URL trong luong chinh.
  - `secure-link` cap signed URL co TTL ngan (`SIGNED_URL_EXPIRY_SECONDS = 60`).

- **Lop ghi nhat ky/audit**:
  - Ghi `access_logs` cho success/blocked.
  - Co `security_logs`/`observability_events` cho mot so truong hop nguy co.

- **Lop phong ngua tren frontend (deterrence)**:
  - Chan mot so thao tac copy/cut/print shortcut/context-menu.
  - Che den noi dung khi blur, hidden tab, mouse out viewport.
  - Watermark theo email tren canvas.

## 3) Danh gia nhanh theo muc do

### Muc do Tot (hien trang)

- Chinh sach truy cap duoc tach ra thanh core rule (`secure-access-core`) de giam drift.
- Luong doc chinh (`/api/secure-pdf`) ap dung gate server-side truoc khi tra PDF.
- Co ghi audit log chi tiet (IP, device, reason, correlation id).
- Co test cho secure-access core va run-secure-access core.

### Phat hien/rui ro uu tien cao

1. **Lech policy giua Next API va Edge function (quan trong)**
   - Trong Next API (`run-next-secure-document-access`), mismatch device session bi chan.
   - Trong Edge `get-secure-link`, khi `activeSession.device_id !== device_id` thi code dang update lai session theo device moi thay vi chan.
   - Tac dong: Lam yeu rang buoc single-session tren Edge path; mo rong kha nang "session hopping" neu token bi lo.

2. **Ton tai 2 duong cap noi dung co hanh vi khac nhau (`secure-pdf` vs `get-secure-link`)**
   - Duong signed URL (Edge) va duong stream (Next) co hanh vi va action log khac (`get_secure_link` vs `secure_pdf`).
   - Tac dong: Kho quan ly policy dong nhat, kho soat bao cao bao mat, de xay ra bypass chinh sach theo endpoint.

### Phat hien/rui ro muc trung binh

1. **Bao ve frontend chi mang tinh ngan chan co ban**
   - Cac ky thuat chan screenshot/shortcut/blur la deterrence, khong chong duoc camera ngoai, extension, custom devtools, hook renderer.
   - Tac dong: Khong nen xem day la lop bao ve chinh cho noi dung co gia tri cao.

2. **Phu thuoc worker tu CDN ben ngoai trong reader**
   - `pdf.worker.min.mjs` dang tai tu unpkg.
   - Tac dong: Rui ro supply-chain/network availability; anh huong den do tin cay va compliance.

3. **Khong co bang chung CSRF token rieng cho secure endpoints**
   - Hien tai dua vao same-origin + cookie policy.
   - Tac dong: Rui ro thuc te khong cao trong boi canh hien tai, nhung nen co them defense-in-depth neu mo rong client/API.

### Phat hien/rui ro muc thap

1. **Do bao phu observability khong dong nhat giua cac nhanh**
   - Mot so luong co log observability day du, mot so luong chi ghi access log.
   - Tac dong: Giam toc do dieu tra su co.

## 4) Kien nghi cai thien (uu tien theo giai doan)

### P0 (nen lam ngay)

1. **Dong nhat policy session/device**
   - Sua Edge `get-secure-link` de **khong auto-update device_id khi mismatch**.
   - Ap dung cung rule nhu `evaluateApiSessionBinding` ben Next.

2. **Chuan hoa mot duong truy cap tai lieu**
   - Chot endpoint chinh (khuyen nghi: `secure-pdf` stream) va deprecate duong con lai neu khong can thiet.
   - Neu van giu ca hai, bat buoc dung chung adapter/policy + action log dong nhat.

3. **Them canh bao drift policy**
   - Bat script check sync (`scripts/check-sync-drift.mjs`) vao CI gate bat buoc.

### P1 (gan)

1. **Noi bo hoa PDF worker**
   - Host worker tai static asset noi bo thay vi CDN public.

2. **Tang cuong observability**
   - Dong nhat schema metadata cho blocked/success/error giua Next va Edge.
   - Them dashboard canh bao bat thuong theo user + device + IP.

3. **Hardening secure-link**
   - Neu tiep tuc dung signed URL: rang buoc them context (short TTL + one-time semantics neu kha thi).

### P2 (sau do)

1. **Danh gia watermark nang cao**
   - Watermark theo request/session (thoi gian + id rut gon) de truy vet ro rang hon.

2. **Danh gia DRM/business-level controls**
   - Neu tai lieu gia tri cao, can mo hinh DRM/chong leak manh hon thay vi chi chan client-side.

## 5) Ket luan

He thong bao ve xem tai lieu hien tai da co nhieu lop co ban va kha day du cho giai doan tang truong (auth + permission + session/device + rate limit + audit). Tuy nhien, rui ro lon nhat la **do lech policy giua Next va Edge path**, co the lam suy yeu single-session khi truy cap qua Edge `get-secure-link`.

Uu tien cao nhat la dong nhat policy, giam endpoint phan manh, va khoa drift bang CI.

## 8) Bo tai lieu P2 (design phase)

Bo tai lieu P2 da duoc lap de chuyen sang phase implementation:

- `docs/P2-BASELINE-DISCOVERY.md`
- `docs/P2-WATERMARK-TRACE-DESIGN.md`
- `docs/P2-DRM-BUSINESS-EVAL.md`
- `docs/P2-LEAK-INCIDENT-RUNBOOK.md`
- `docs/P2-APPROVAL-PACKAGE.md`

Tom tat huong P2:

- P2-A: watermark tracing token (uu tien implementation truoc).
- P2-B: danh gia burn-in watermark cho tier nhay cam cao hon.
- DRM/business controls ap dung theo tier, khong bat buoc mot mo hinh duy nhat cho toan bo noi dung.

## 6) Cap nhat trien khai P1 (2026-03-24)

Da thuc hien cac muc P1 sau:

1. **Noi bo hoa PDF worker**
   - Reader khong con tai worker tu CDN unpkg.
   - Worker duoc copy tu `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` sang `public/pdf.worker.min.mjs`.
   - `usePdfFetchAndDecode` dung `GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"`.

2. **Tang cuong observability secure access**
   - Edge `get-secure-link` da bo sung `logObservability(event_type="blocked")` cho cac nhanh:
     - `expired`
     - `rate_limit`
     - `high_frequency`
   - KPI secure-doc blocked duoc cap nhat tooltip de phan anh day du blocked reasons.

3. **Hardening secure-link**
   - Them cau hinh TTL qua env:
     - `SIGNED_URL_EXPIRY_SECONDS` (fallback: `SECURE_ACCESS_DEFAULTS.SIGNED_URL_EXPIRY_SECONDS`).
   - CORS khong con wildcard `*`, chuyen sang allowlist env-driven:
     - `SECURE_LINK_ALLOWED_ORIGINS` (danh sach origin, phan tach boi dau phay).
     - Neu khong set env, fallback local/dev:
       - `http://localhost:3000`
       - `http://127.0.0.1:3000`

## 7) Huong dan rollout P1

1. **Cap nhat env truoc deploy**
   - `SIGNED_URL_EXPIRY_SECONDS` (de xuat: 30-120 tuy traffic/client behavior).
   - `SECURE_LINK_ALLOWED_ORIGINS` (bat buoc set day du domain production va staging).

2. **Checklist sau deploy**
   - Reader van doc tai lieu binh thuong va khong goi worker CDN.
   - Alerts preset secure document blocked tang du lieu hop ly (co event `expired`, `rate_limit`, `high_frequency`).
   - Edge `get-secure-link` tra signed URL dung TTL mong muon.

3. **Fallback behavior**
   - Neu thieu env allowlist, he thong chi cho phep origin local/dev fallback o tren.
   - Neu `SIGNED_URL_EXPIRY_SECONDS` khong hop le, he thong dung gia tri fallback trong `secure-access-core`.
