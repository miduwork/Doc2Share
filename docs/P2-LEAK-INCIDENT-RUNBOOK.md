# P2 Leak Incident Runbook

Ngay cap nhat: 2026-03-24
Trang thai: Draft for governance approval

## 1) Muc tieu

Chuan hoa xu ly khi phat hien ro ri tai lieu:

- Triage nhanh
- Thu thap bang chung dung thu tu
- Truy vet nguon leak bang watermark token va logs
- Quyet dinh bien phap giam thieu va thong bao

## 2) Muc SLA de xuat

- T0 acknowledgement: <= 15 phut
- T1 triage initial severity: <= 30 phut
- T2 forensic attribution (neu co token hop le): <= 4 gio
- T3 containment decision: <= 6 gio

## 3) RACI

- Incident Commander (IC): Security lead
- Technical Investigator: Backend + Data engineer
- Product Owner: quyet dinh anh huong user/business
- Legal/Compliance: tham gia khi co phat tan cong khai hoac doi tac thu 3
- Support: tiep nhan ticket va outbound communication

## 4) Severity rubric

- Sev-1: leak high-sensitive, phat tan cong khai, tac dong business lon
- Sev-2: leak premium, phat tan trong nhom han che
- Sev-3: artifact nghi ngo, chua xac minh

## 5) Playbook quy trinh

1. **Nhan signal**
   - Nguon: ticket, social, crawler, admin alert.
   - Tao incident ID.

2. **Bao toan bang chung**
   - Luu ban goc image/video/url.
   - Ghi timestamp, nguon, context phat hien.
   - Hash file bang chung (sha256) de bao toan chain-of-custody.

3. **Trich watermark token**
   - Tim chuoi `D2S:{wm_short}` (hoac pattern version tuong ung).
   - Neu khong co token, danh dau "non-attributable" tam thoi.

4. **Forensic lookup**
   - Query `access_logs` theo `metadata.wm_short` + window thoi gian.
   - Doi chieu `document_id`, `user_id`, `device_id`, `ip_address`, `correlation_id`.
   - Kiem tra co multi-match hay single-match.

5. **Containment**
   - Co the revoke session/device theo policy.
   - Tang monitoring cho user/correlation lien quan.
   - Neu can: tam an noi dung/tier policy escalation.

6. **Communication**
   - Noi bo: cap nhat timeline va quyet dinh.
   - Ben ngoai: thong bao toi stakeholder theo template da duyet.

7. **Post-incident**
   - Root-cause summary.
   - Action items voi owner + due date.
   - Cap nhat risk register.

8. **Tier escalation gate (N1/N2)**
   - Doi chieu incident voi nguong operational trong `P2-DRM-BUSINESS-EVAL.md`.
   - N1 (>=2 leak xac minh / 30 ngay / category): kich hoat Tier 2 controls + dua vao review queue.
   - N2 (>=1 leak nghiem trong high-sensitive da quy nguon): kich hoat PoC Tier 3 (Option C/D) trong 2 tuan.
   - Lap decision record va owner ky xac nhan (Product + Security + Engineering).

## 6) Checklist bang chung

- [ ] Artifact goc duoc luu va hash
- [ ] Timestamp UTC + timezone duoc ghi
- [ ] Token watermark duoc trich (neu co)
- [ ] Query logs va ket qua duoc snapshot
- [ ] Quyet dinh containment duoc ky boi IC
- [ ] Biên ban communication duoc luu

## 7) Governance gate truoc implementation phase

Truoc khi vao phase code P2:

- [ ] Product + Security thong nhat rubric severity
- [ ] Engineering xac nhan kha nang query theo token metadata
- [ ] Legal duyet template communication
- [ ] On-call rota co owner ro cho leak incident
- [ ] Nguong escalation N1/N2 da duoc map vao on-call playbook
- [ ] Co template decision log cho re-tier/go-no-go DRM controls

## 8) Truy van forensic mau cho watermark v1

Dung khi da trich duoc token tu artifact leak:

```sql
-- Input:
--   :wm_short      (vd A7K9M2QX)
--   :doc_id        (optional, neu da biet document)
--   :from_utc      (timestamp)
--   :to_utc        (timestamp)
select
  created_at,
  user_id,
  document_id,
  device_id,
  ip_address,
  correlation_id,
  metadata->>'wm_short' as wm_short,
  metadata->>'wm_doc_short' as wm_doc_short,
  metadata->>'wm_issued_at_bucket' as wm_issued_at_bucket,
  metadata->>'wm_version' as wm_version
from access_logs
where action = 'secure_pdf'
  and status = 'success'
  and metadata->>'wm_short' = :wm_short
  and created_at between :from_utc and :to_utc
  and (:doc_id is null or document_id = :doc_id)
order by created_at desc;
```## 9) Checklist rollout watermark tracing

- [ ] Reader hien thi `D2S:{wm_short}` va dong `DOC:{wm_doc_short} T:{bucket_mm}`.
- [ ] Access logs success co day du: `wm_id`, `wm_short`, `wm_doc_short`, `wm_issued_at_bucket`, `wm_version`.
- [ ] Thu nghiem crop screenshot van nhin thay it nhat 1 watermark token.
- [ ] Co ket qua query forensic mau cho 1 token test trong moi truong staging.

## 10) Decision log template (DRM/business controls)

Su dung khi vuot nguong N1/N2:

- Incident ID:
- Category / Tier hien tai:
- Trigger:
  - [ ] N1 (>=2 leak xac minh/30 ngay)
  - [ ] N2 (>=1 leak nghiem trong high-sensitive)
- Options duoc xem xet: A / B / C / D
- Scoring snapshot:
  - Sec:
  - Trace:
  - UX:
  - Cost:
  - Integration:
  - Total:
- Quyet dinh:
  - [ ] Go
  - [ ] Conditional pilot
  - [ ] No-go
- Owner ky:
  - Product:
  - Security:
  - Engineering:
