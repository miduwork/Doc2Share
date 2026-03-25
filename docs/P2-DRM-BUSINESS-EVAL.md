# P2 DRM and Business Controls Evaluation

Ngay cap nhat: 2026-03-24
Trang thai: Decision draft (design only)

## 1) Muc tieu

- Chon mo hinh bao ve noi dung theo tier thay vi "mot co che cho tat ca".
- Can bang giua: bao mat, UX, chi phi, va toc do van hanh.

## 2) Tier hoa noi dung

## Tier 1 - Standard content

- Dac trung: tai lieu pho thong, muc do that thoat chap nhan duoc.
- Bao ve de xuat:
  - `secure-pdf` stream route
  - watermark tracing token (P2-A)
  - rate limit + session/device controls hien co
- DRM: **No-go** (khong can).

## Tier 2 - Premium content

- Dac trung: tai lieu co gia tri thuong mai cao hon.
- Bao ve de xuat:
  - Toan bo Tier 1
  - Rule nghiem hon cho anomaly (IP shift, high-frequency)
  - Review queue ban tu dong khi score rui ro cao
- DRM: **Conditional** (pilot nho neu leak tang vuot nguong).

## Tier 3 - High-sensitive content

- Dac trung: tai lieu nhay cam cao, leak gay ton that lon.
- Bao ve de xuat:
  - Toan bo Tier 2
  - Xem xet secure workspace/no-download environment
  - Can co quy trinh legal + incident response chuan
- DRM: **Go for deep evaluation** (vendor PoC hoac walled environment).

## 3) Ma tran options

| Option | Risk reduction | UX impact | Cost | Integrate effort | Phu hop tier |
|---|---:|---:|---:|---:|---|
| A. Secure-pdf + watermark token (P2-A) | Trung binh | Thap | Thap | Thap | T1, T2 |
| B. Server burn-in watermark (P2-B) | Trung binh-cao | Trung binh | Trung binh | Trung binh-cao | T2, T3 |
| C. Vendor DRM full stack | Cao | Trung binh-cao | Cao | Cao | T3 |
| D. Secure VDI/no-download workspace | Rat cao | Cao | Rat cao | Cao | T3 (dac biet) |

## 4) Scoring framework

Thang diem 1-5 (cao hon la tot hon, tru "cost" va "UX impact" la diem dao nguoc):

- Security effectiveness (trong so 35%)
- Forensic traceability (20%)
- UX continuity (15%)
- Cost efficiency (15%)
- Integration complexity (15%)

Cong thuc de xuat:

- `Total = 0.35*Sec + 0.20*Trace + 0.15*UX + 0.15*Cost + 0.15*Integration`
- Score >= 3.8: go candidate
- 3.2 - 3.79: conditional pilot
- < 3.2: no-go

### 4.1 Quy tac cham diem chi tiet

De tranh danh gia chu quan, ap dung mot thang chung:

- Security effectiveness (`Sec`)
  - 1: gan nhu khong giam leak
  - 3: giam leak o muc deterrence + kho khai thac hang loat
  - 5: giam leak manh, co rang buoc ky thuat nghiem
- Forensic traceability (`Trace`)
  - 1: kho quy nguon, thieu bang chung lien ket
  - 3: quy nguon duoc phan lon case neu co artifact tot
  - 5: truy vet nhanh, do tin cay cao, phu hop incident response
- UX continuity (`UX`)
  - 1: UX xau ro ret, friction cao
  - 3: anh huong vua phai, chap nhan duoc cho premium
  - 5: tac dong thap, gan voi hien trang
- Cost efficiency (`Cost`)
  - 1: chi phi rat cao so voi gia tri bao ve
  - 3: chi phi trung binh, can justify theo tier
  - 5: hieu qua chi phi tot
- Integration complexity (`Integration`)
  - 1: tich hop rat phuc tap, doi rui ro rollout cao
  - 3: tich hop trung binh, can pilot/guardrail
  - 5: tich hop de, thay doi nho

Luu y chuan hoa:
- `UX impact`, `Cost`, `Integrate effort` trong bang option goc la "tieu chi tac dong/xau". Khi cham diem framework thi phai doi sang `UX continuity`, `Cost efficiency`, `Integration complexity` theo huong "cao la tot".
- Dung 0.5 step (vd 3.5) khi can.

### 4.2 Cong thuc va nguong quyet dinh

- `Total = 0.35*Sec + 0.20*Trace + 0.15*UX + 0.15*Cost + 0.15*Integration`
- `>= 3.8`: Go (du dieu kien rollout hoac scale pilot)
- `3.2 - 3.79`: Conditional pilot (time-boxed + exit criteria)
- `< 3.2`: No-go (giu control hien tai + re-evaluate theo nguong N1/N2)

### 4.3 Input data bat buoc truoc khi cham diem

Cho moi scenario bat buoc co:
- Loai noi dung + tier + owner nghiep vu
- Baseline leak signal 30/90 ngay (incident da xac minh)
- Muc tieu kinh doanh (doanh thu/tac dong neu leak)
- Rang buoc phap ly/compliance (neu co)
- Nang luc van hanh hien tai (on-call, forensic readiness, legal workflow)

## 5) Mapping category -> tier -> owner (de xac nhan)

Bang nay la mau de Product/Security chot truoc phase code:

| Category | Tier de xuat | Owner chinh | Backup owner | Trigger review |
|---|---|---|---|---|
| Tai lieu luyen de dai tra | T1 | Product Content | Engineering | Hang quy |
| Tai lieu premium ban chay | T2 | Product Monetization | Security | Khi vuot N1 |
| Tai lieu de thi/bo de nhay cam cao | T3 | Security Lead | Product Owner | Khi vuot N2 hoac thay doi phap ly |
| Tai lieu doi tac giu ban quyen chat | T3 | Legal/Compliance | Security Lead | Theo dieu khoan hop dong |

Nguyen tac:
- Moi category phai co owner ra quyet dinh cuoi.
- Tier review toi thieu 1 lan/quarter, hoac ngay khi co incident nghiem trong.

## 6) De xuat go/no-go hien tai

1. **T1**
   - Go: Option A
   - No-go: Option C, D

2. **T2**
   - Go: Option A + policy hardening
   - Conditional: Option B pilot theo nhom tai lieu
   - No-go mac dinh: Option C (chi khi leak threshold vuot)

3. **T3**
   - Go for evaluation: Option C (vendor DRM) va/hoac D (walled environment)
   - Tam thoi: Option B la minimum truoc khi co ket qua PoC

## 7) Scoring workbook (3-5 scenario dai dien)

### 7.1 Bang cham diem mau (decision log)

| Scenario | Tier | Option | Sec | Trace | UX | Cost | Integration | Total | Ket luan |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| S1: T1 general content | T1 | A | 3.0 | 4.0 | 4.5 | 4.5 | 4.5 | 3.85 | Go |
| S2: T2 premium exam pack | T2 | A + hardening | 3.5 | 4.0 | 4.0 | 4.0 | 4.0 | 3.83 | Go |
| S3: T2 premium exam pack | T2 | B pilot | 4.0 | 4.5 | 3.0 | 3.0 | 2.5 | 3.58 | Conditional pilot |
| S4: T3 high-sensitive | T3 | C PoC | 4.5 | 4.5 | 2.5 | 2.0 | 2.0 | 3.53 | Conditional PoC |
| S5: T3 special partner | T3 | D PoC | 5.0 | 4.0 | 1.5 | 1.0 | 2.0 | 3.23 | Conditional PoC hep |

### 7.2 Assumptions can ghi cung decision

- Option B co kha nang tang traceability neu burn-in gan voi session/request.
- Option C phu thuoc nang luc tich hop SDK + legal review + device compatibility.
- Option D chi phu hop nhom user hep do friction UX va chi phi cao.
- Neu baseline leak incidence giam va duy tri < N1 thi uu tien giu A/B nhe.

## 8) Pilot charters (thuc thi cho nhanh conditional/go-eval)

### 8.1 T2 - Option B (server burn-in) pilot charter

- Scope: 1-2 category premium, toi da 10-15% luot xem premium.
- Duration: 2-3 tuan, co checkpoint moi tuan.
- Success criteria:
  - Leak signal giam >= 30% tren nhom pilot (vs baseline 30 ngay)
  - Forensic attribution <= 15 phut (p95)
  - Ty le than phien UX tang < 5%
- Exit criteria:
  - Neu `Total` cap nhat >= 3.8 va KPI dat -> de xuat mo rong.
  - Neu UX regression lon hoac gain nho -> rollback, giu Option A + hardening.

### 8.2 T3 - Option C/D PoC charter

- Scope: 1 category high-sensitive + nhom nguoi dung han che.
- Duration: 2 tuan cho discovery + 2 tuan cho technical PoC.
- Output bat buoc:
  - Bao cao compatibility (web, desktop, mobile)
  - Mo hinh chi phi 6-12 thang
  - Risk register: legal, data residency, vendor lock-in
- Exit criteria:
  - Co 1 option dat `Total >= 3.8` va khong vi pham rang buoc phap ly/compliance.
  - Neu khong dat: giu B la minimum + tang governance controls.

## 9) Nguong kich hoat tang cap bao ve

De xuat nguong operational:

- Nguong N1: >= 2 incident leak xac minh / 30 ngay / cung mot danh muc
  - Kich hoat Tier 2 controls.
- Nguong N2: >= 1 leak nghiem trong da quy nguon cho tai lieu high-sensitive
  - Kich hoat Tier 3 evaluation (PoC C/D) trong 2 tuan.

Rang buoc thuc thi:
- N1/N2 chi tinh tren incident da xac minh (co artifact + ket qua triage).
- Neu co nghi ngo nhieu nguon nhung chua xac minh, ghi nhan "watchlist", chua auto-escalate tier.

## 10) Dau ra can co truoc khi vao phase code

- Danh sach category -> tier owner xac nhan.
- Bang scoring da dien cho 3-5 kịch ban dai dien.
- Quyet dinh go/no-go duoc ky boi Product + Security + Engineering.

## 11) Checklist phe duyet DRM/business controls

- [ ] Hoan tat tier-owner mapping va duoc Product ky xac nhan.
- [ ] Hoan tat scoring workbook cho it nhat 3 scenario dai dien.
- [ ] Co pilot charter T2 (Option B) voi KPI + exit criteria ro rang.
- [ ] Co PoC charter T3 (Option C/D) voi chi phi/rui ro/vendor constraints.
- [ ] Quyet dinh cuoi duoc dong bo vao approval package + runbook escalation.
