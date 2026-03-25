# P2 Approval Package - Secure Reader Protection

Ngay cap nhat: 2026-03-24
Trang thai: Ready for review

## 1) Muc tieu package

Gom bo tai lieu quyet dinh de phe duyet pha implementation tiep theo (MVP ky thuat):

- Baseline + KPI
- Watermark trace design
- DRM/business controls evaluation
- Leak incident runbook + governance checklist

## 2) Tai lieu thanh phan

- Baseline: `docs/P2-BASELINE-DISCOVERY.md`
- Watermark design: `docs/P2-WATERMARK-TRACE-DESIGN.md`
- DRM/business eval: `docs/P2-DRM-BUSINESS-EVAL.md`
- Runbook: `docs/P2-LEAK-INCIDENT-RUNBOOK.md`
- Bao cao tong: `docs/SECURE-READER-PROTECTION-REPORT.md`

## 3) Quyet dinh de xuat (for approval)

1. **Watermark strategy**
   - Chon huong P2-A truoc: overlay watermark token truy vet (`wm_short`) + metadata mapping.
   - P2-B (server burn-in) de danh gia tiep theo cho Tier 2/3 neu can.

2. **Tier policy**
   - Tier 1: secure-pdf + watermark token (go).
   - Tier 2: them policy anomaly + can nhac burn-in pilot (conditional).
   - Tier 3: bat dau danh gia DRM/VDI PoC (go for evaluation).
   - Category-tier mapping va owner xac nhan theo bang trong `docs/P2-DRM-BUSINESS-EVAL.md`.

3. **Incident governance**
   - Ap dung runbook va SLA triage/forensic da de xuat.
   - Chot RACI truoc khi bat dau coding phase.

## 4) Scope implementation MVP (phase sau P2)

Backlog MVP de xuat:

1. Mo rong logging contract trong `src/lib/access-log.ts` de ghi watermark metadata.
2. Mo rong secure access context trong `src/lib/secure-access/run-next-secure-document-access.ts`.
3. Tra watermark payload cho reader flow va render token trong `PdfCanvasRenderer`.
4. Them truy van admin tra cuu theo `wm_short` (security workspace).
5. Them test cho:
   - token generation format
   - metadata persistence
   - deterministic overlay placement

## 5) Acceptance criteria de vao phase code

- [ ] Product approve tier classification.
- [ ] Security approve runbook + SLA + RACI.
- [ ] Engineering estimate MVP effort va release window.
- [ ] Legal approve communication template cho leak incident.
- [ ] Hoan tat scoring workbook 3-5 scenario dai dien theo cong thuc P2 DRM eval.
- [ ] Co pilot charter Option B (T2) va PoC charter Option C/D (T3) voi exit criteria.

## 6) Risk mo con lai

- Watermark overlay client-side van co the bi chup lai (deterrence + traceability, khong phai DRM day du).
- Forensic attribution phu thuoc chat luong artifact leak va token visibility.
- DRM deep integration co the tang cost va UX friction dang ke.

## 7) De xuat buoc tiep theo

Neu duoc duyet:

1. Tao ke hoach implementation MVP P2-A (1 sprint).
2. Tao branch ky thuat rieng cho watermark trace.
3. Chot migration/log schema va test plan truoc khi merge.

## 8) DRM/business controls decision snapshot

Tom tat ket qua theo tier (decision-ready):

| Tier | Option de xuat | Trang thai | Dieu kien |
|---|---|---|---|
| T1 | A (secure-pdf + watermark tracing) | Go | Rollout theo luong hien tai |
| T2 | A + policy hardening | Go | Ap dung ngay theo baseline risk |
| T2 | B (server burn-in watermark) | Conditional pilot | Time-box 2-3 tuan, theo KPI pilot charter |
| T3 | C (Vendor DRM) | Go for PoC | Danh gia compatibility + cost + legal |
| T3 | D (VDI/no-download) | Conditional PoC hep | Chi cho category dac biet/high-sensitive |

## 9) Governance gate bo sung cho DRM eval

- [ ] Tier owner review dinh ky hang quy duoc chot.
- [ ] Nguong escalation N1/N2 duoc noi vao runbook va on-call process.
- [ ] Product/Security/Engineering ky decision log sau workshop scoring.
