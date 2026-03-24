# Đánh giá toàn diện: Trang Tài liệu (Admin Console)

*Góc nhìn chuyên gia: Quản lý tài liệu*

---

## 1. Tổng quan kiến trúc

| Thành phần | Mô tả |
|------------|--------|
| **Danh sách** | `/admin/documents` — Server component (filters, pagination), Client (Upload, Filters, Bulk, Table, Edit modal) |
| **Chi tiết** | `/admin/documents/[id]` — Metadata, Versions (so sánh + diff), Audit log (lọc + phân trang) |
| **Phân quyền** | Chỉ **super_admin** và **content_manager** (document managers); approve/reject/hard delete chỉ **super_admin** |
| **Luồng dữ liệu** | Upload → session → document (draft/processing) → job postprocess → ready; Approval: draft → pending → approved/rejected |

---

## 2. Điểm mạnh

- **Hai giai đoạn tải lên**: Session + finalize, có idempotency, tách rõ upload và xử lý.
- **Pipeline xử lý**: Bảng `document_processing_jobs`, trạng thái queued/processing/done/failed, retry từng tài liệu và bulk.
- **Phê duyệt xuất bản**: Submit for approval → pending → approve/reject (chỉ super_admin), có note; publish (ready) chỉ khi approved.
- **Chất lượng dữ liệu**: quality_score, data_quality_status, quality_flags; preset "Chất lượng thấp", trigger tự động.
- **Version & audit**: Bảng versions (snapshot), audit log theo document; trang chi tiết có so sánh version và lọc audit.
- **Bulk actions**: Publish, gửi duyệt, approve, reject, archive, retry processing, xóa mềm; giới hạn 100 tài liệu/lần.
- **Bộ lọc & preset**: Tìm theo tiêu đề, status, subject/grade/exam, sort; preset: Lỗi xử lý, Chờ duyệt, Chất lượng thấp, Thiếu thumbnail/preview.
- **Sửa nhanh**: Inline sửa giá; modal sửa metadata (title, description, price, category, status, is_downloadable).
- **Phân quyền rõ**: Hard delete và approve/reject chỉ super_admin; content_manager có CRUD và gửi duyệt.

---

## 3. Khoảng trống và vấn đề

### 3.1 Dữ liệu & tính đúng đắn

| Vấn đề | Mô tả |
|--------|--------|
| **Versions từ `document_versions`** | Bảng chỉ có `snapshot` (JSONB); trang chi tiết đang `select("id, version_no, ..., title, description, price, ...")`. Nếu không có view/cột trải từ snapshot thì các cột này có thể null → diff "hiện tại vs version" sai hoặc toàn "—". Cần view hoặc map từ `snapshot` ở app. |
| **Rollback** | Hàm `rollback_document_to_version(document_id, version_id, created_by)` có trong DB (service_role) nhưng không có nút/hành động trên trang Chi tiết → admin không rollback được từ UI. |

### 3.2 Trải nghiệm quản lý

| Vấn đề | Mô tả |
|--------|--------|
| **Trạng thái hiển thị** | Cột trạng thái hiện: 3 badge (status, approval, quality) dạng raw (draft, approval: draft, quality: needs_review (0)) — dày, khó đọc. Thiếu nhãn tiếng Việt và màu theo trạng thái (vd: pending = vàng, approved = xanh). |
| **Chu trình sống không được giải thích** | Người dùng mới không rõ: draft → Gửi duyệt → pending → Duyệt/Từ chối → approved → Publish (ready). Nên có tooltip hoặc 1 dòng mô tả luồng trên trang. |
| **Xem nhanh bản công khai** | Không có link "Xem trang bán" / "Preview" từ danh sách hoặc chi tiết tới `/tai-lieu/[id]/[slug]` — khó kiểm tra cách hiển thị cho khách. |
| **Tài liệu đã xóa** | Query loại `status = deleted`, dropdown trạng thái không có option "deleted" → không xem lại danh sách đã xóa (có thể cần cho hoàn tác hoặc kiểm tra). |
| **Phân trang** | Chỉ "Trang trước / Trang sau" và "Trang X/Y"; không có "đến trang" hoặc hiển thị khoảng "1–20 / 500". |

### 3.3 Form & thao tác

| Vấn đề | Mô tả |
|--------|--------|
| **Form lọc và preset** | Dùng `preset: "custom"` khi submit form; nếu thiếu hidden đầy đủ có thể mất filter khác. Cần đảm bảo mọi tham số đều được giữ khi "Áp dụng". |
| **Sửa giá inline** | Mỗi lần thay đổi số gọi ngay `updateDoc` — dễ gây nhiều request khi gõ nhanh. Nên debounce hoặc nút "Lưu" cho từng dòng. |
| **Reject từng tài liệu** | Dùng `window.prompt` cho lý do reject — trải nghiệm thô; nên dùng modal có textarea như bulk reject. |
| **Upload** | Một bộ file (main + cover + preview) mỗi lần; không có "lưu nháp" hoặc hàng đợi nhiều tài liệu (queue) trên một trang. |

### 3.4 Chi tiết tài liệu

| Vấn đề | Mô tả |
|--------|--------|
| **Actor trong Versions / Audit** | Chỉ hiển thị `actor_id` dạng UUID (8 ký tự); không resolve sang tên (profiles) → khó biết ai thao tác. |
| **Rollback** | Đã nêu: cần nút "Rollback về version này" (gọi server action dùng service_role hoặc RPC đã cấp). |
| **Semantic / a11y** | Một số chỗ còn class slate cứng; nên thống nhất semantic tokens (text-muted, border-line, …) và label/aria cho form. |

### 3.5 Hiệu năng & scale

| Vấn đề | Mô tả |
|--------|--------|
| **Số lượng job** | Lấy job theo `document_id in (docIds)` cho 1 trang — ổn. Khi mở rộng, có thể cần index (document_id, status). |
| **Bulk tuần tự** | Bulk xử lý từng tài liệu trong vòng lặp; với 100 tài liệu có thể chậm. Cân nhắc batch RPC hoặc job queue cho bulk nặng. |

---

## 4. Kiến nghị theo mức độ ưu tiên

### P0 — Sửa để dữ liệu đúng và hành vi rõ ràng ✅ Đã thực hiện

1. **Versions: đọc từ `snapshot`** ✅  
   - Trang Chi tiết lấy `id, version_no, reason, created_by, created_at, snapshot` từ `document_versions`; map `snapshot` → title, description, price, … ở server để hiển thị và build diff.  
   - Diff "hiện tại vs version chọn" dùng đúng dữ liệu từ snapshot.

2. **Rollback từ UI** ✅  
   - Server action `rollbackDocumentToVersion` trong `manage-actions.ts` (requireSuperAdminContext + createServiceRoleClient().rpc).  
   - Trang Chi tiết: cột "Thao tác" trong bảng Versions có nút "Rollback về version này" (client component, confirm trước khi gọi). Chỉ hiển thị khi super_admin.

### P1 — Cải thiện trải nghiệm quản lý

3. **Trạng thái dễ đọc**  
   - Thay 3 badge raw bằng nhãn tiếng Việt (vd: draft → Nháp, pending → Chờ duyệt, approved → Đã duyệt, ready → Đang bán).  
   - Dùng màu theo ý nghĩa: pending = cảnh báo, approved/ready = thành công, rejected/failed = lỗi.

4. **Chu trình sống**  
   - Thêm 1 dòng hoặc block ngắn trên trang Tài liệu: "Luồng: Nháp → Gửi duyệt → Chờ duyệt → Duyệt/Từ chối → Đang bán (ready) / Lưu trữ."

5. **Link xem trang bán**  
   - Trong danh sách (hoặc chi tiết): link "Xem trang bán" / "Preview" tới `/tai-lieu/[id]/[slug]` (slug có thể từ title hoặc id nếu chưa có slug).

6. **Reject từng tài liệu**  
   - Thay `window.prompt` bằng modal có textarea "Lý do reject (bắt buộc)" và nút Hủy / Từ chối, giống luồng bulk reject.

7. **Sửa giá inline**  
   - Debounce (vd 500–800ms) trước khi gọi `updateDoc`, hoặc thêm nút "Lưu" trên dòng để người dùng chủ động lưu.

### P2 — Mở rộng và vận hành

8. **Tùy chọn xem "Đã xóa"**  
   - Trong filter trạng thái: thêm option "deleted" (hoặc preset "Đã xóa"); query dùng `.eq("status", "deleted")` khi chọn. Có thể giới hạn role (vd chỉ super_admin).

9. **Phân trang**  
   - Hiển thị khoảng bản ghi ("1–20 / 500") và tùy chọn "Đến trang" (input + nút) khi totalPages lớn.

10. **Actor có tên**  
    - Ở trang Chi tiết: lấy `profiles(id, full_name)` cho các `actor_id` / `created_by` trong audit và versions; hiển thị tên (hoặc fallback UUID).

11. **Export danh sách**  
    - Nút "Xuất CSV" (hoặc Excel) cho bộ lọc hiện tại: id, title, status, approval_status, price, created_at, … (có thể giới hạn số dòng tối đa).

12. **Bulk performance**  
    - Với bulk approve/reject/archive: cân nhắc 1 RPC nhận mảng document_id và thực hiện trong transaction, hoặc queue job thay vì gọi tuần tự từng tài liệu.

---

## 5. Tóm tắt

| Tiêu chí | Đánh giá |
|----------|----------|
| **Upload & pipeline** | Tốt: 2 phase, jobs, retry. |
| **Approval & publish** | Tốt: submit/approve/reject, chỉ super_admin duyệt. |
| **Bộ lọc & bulk** | Tốt: preset, filter, bulk đa thao tác. |
| **Versions & audit** | Cấu trúc tốt; cần sửa nguồn dữ liệu version (snapshot) và thêm rollback UI. |
| **Hiển thị trạng thái** | Cần cải thiện: nhãn tiếng Việt, màu, giảm độ dày badge. |
| **Luồng sống & link công khai** | Thiếu mô tả luồng và link "Xem trang bán". |
| **Form & UX chi tiết** | Reject modal, debounce giá, actor có tên. |

Trang Tài liệu đã có nền tảng quản lý chặt chẽ (upload, pipeline, approval, version, audit). Để đạt chuẩn "quản lý tài liệu" cao: **sửa đọc version từ snapshot và thêm rollback**, **làm rõ trạng thái và luồng sống**, **cải thiện UX thao tác** (reject, giá, link xem bán, phân trang, actor).
