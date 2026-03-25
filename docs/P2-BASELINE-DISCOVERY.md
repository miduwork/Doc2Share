# P2 Baseline Discovery - Secure Reader

Ngay cap nhat: 2026-03-24

## 1) Muc tieu baseline

Tai lieu nay chot hien trang "truy vet ro ri tai lieu" truoc khi vao pha code P2:

- Xac dinh du lieu nao da co san de forensic.
- Xac dinh diem thieu trong watermark va logging.
- Chot KPI thanh cong cho P2 design phase va implementation phase tiep theo.

## 2) Hien trang ky thuat (as-is)

### 2.1 Reader watermark hien tai

- File: `src/features/documents/read/components/PdfCanvasRenderer.tsx`
- Watermark hien thi: `userEmail + "Doc2Share"` theo vi tri co dinh.
- Chua co token truy vet theo request/session.
- Chua co quy trinh decode token -> user/session.

Tac dong:
- Co tinh re deterrence, nhung forensic traceability chua manh.
- Neu email bi che/crop, kha nang quy nguon giam manh.

### 2.2 Server-side secure access/logging

- Secure PDF route: `src/app/api/secure-pdf/route.ts`
- Core gate: `src/lib/secure-access/run-next-secure-document-access.ts`
- Audit log: `src/lib/access-log.ts`

Du lieu da co:
- `access_logs` da ghi `user_id`, `document_id`, `status`, `ip_address`, `device_id`, `correlation_id`, `metadata`.
- `request_id/correlation_id` da co trong metadata.

Du lieu chua co:
- `wm_id` (watermark token id)
- `wm_issued_at_bucket`
- Mapping token -> user/session/document de tra nguoc nhanh.

### 2.3 Security/admin view hien tai

- `src/app/admin/security/page.tsx`
- `src/lib/admin/security-dashboard.service.ts`

He thong da co dashboard theo logs/sessions/geo/incidents, nhung chua co:
- Dashboard query truc tiep theo `wm_id`.
- Playbook chinh thuc cho leak-forensics theo watermark token.

## 3) Gap analysis cho P2

1. **Gap truy vet watermark**
   - Watermark hien tai la PII (email) va khong co id forensic rieng.
   - Chua co link mot-mot tu watermark artifact -> log record.

2. **Gap runbook**
   - Chua co quy trinh SLA ro rang khi nhan bao cao leak.
   - Chua co checklist bang chung can thu theo thu tu uu tien.

3. **Gap governance**
   - Chua co co che tier hoa noi dung de quyet dinh muc do bao ve (standard/premium/high-sensitive).

## 4) KPI thanh cong de theo doi P2

## KPI cho design phase (P2 hien tai)

- D1: Co dac ta watermark token va metadata contract du ro de dev implement.
- D2: Co ma tran lua chon DRM/business controls theo tier, co go/no-go recommendation.
- D3: Co runbook incident leak + RACI + SLA xu ly.

## KPI cho implementation phase (sau P2)

- I1: `>= 90%` leak samples co token co the trich xuat.
- I2: Thoi gian tra nguoc token -> user/session `< 15 phut` (p95).
- I3: Ty le false attribution `< 1%`.
- I4: Mean time to triage leak incident `< 30 phut`.

### KPI mapping theo tier (de danh gia DRM/business controls)

| Tier | KPI van hanh chinh | Nguong theo doi |
|---|---|---|
| T1 | Leak incident xac minh / 30 ngay / category | < 2 (neu >= 2 -> xem xet tang len T2 controls) |
| T2 | Forensic attribution p95 | <= 15 phut |
| T2 | UX complaint rate sau hardening/pilot | < 5% |
| T3 | Incident nghiem trong da quy nguon | = 0 muc tieu; neu >= 1 -> bat buoc PoC C/D trong 2 tuan |
| T3 | Decision latency tu incident -> containment | <= 6 gio |

Ghi chu:
- KPI nay la input truc tiep cho scoring workbook va go/no-go gate trong `docs/P2-DRM-BUSINESS-EVAL.md`.
- Neu metric vuot nguong 2 chu ky lien tiep, can re-tier category hoac tang cap controls.

## 5) Pham vi tiep theo

Tai lieu baseline nay la input cho:

- `docs/P2-WATERMARK-TRACE-DESIGN.md`
- `docs/P2-DRM-BUSINESS-EVAL.md`
- `docs/P2-LEAK-INCIDENT-RUNBOOK.md`
- `docs/P2-APPROVAL-PACKAGE.md`
