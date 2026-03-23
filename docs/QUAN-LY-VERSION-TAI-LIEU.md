# Quản lý version tài liệu

Hệ thống lưu **bản chụp (snapshot)** mỗi khi tài liệu được admin chỉnh sửa hoặc xóa, giúp bạn xem lịch sử thay đổi và (nếu cần) khôi phục về phiên bản cũ.

---

## 1. Version được tạo khi nào?

| Hành động | Kết quả |
|-----------|--------|
| **Admin cập nhật metadata** (title, mô tả, giá, trạng thái, v.v.) | Tạo version mới trước khi ghi đè (reason: `admin_update`) |
| **Admin xóa / khóa tài liệu** (soft delete hoặc hard delete) | Tạo version trước khi xóa (reason: `admin_soft_delete` / `admin_hard_delete`) |

Mỗi version có **version_no** tăng dần (v1, v2, v3, …) và lưu toàn bộ trạng thái tài liệu tại thời điểm đó (title, description, price, file_path, preview_url, status, v.v.) trong `document_versions.snapshot`.

---

## 2. Xem và so sánh version ở đâu?

1. Vào **Admin → Tài liệu** (`/admin/documents`).
2. Chọn tài liệu cần xem (bấm vào hàng hoặc link).
3. Mở trang **Chi tiết tài liệu** (`/admin/documents/[id]`).
4. Kéo xuống section **Versions**:
   - **Bảng danh sách**: Version (v1, v2, …), Reason, Actor, Created.
   - **Chọn version để so sánh**: Dropdown “Chọn version để so sánh” → chọn một version → bấm **So sánh với hiện tại**.
   - **Diff chi tiết**: Bảng so sánh từng trường (Title, Description, Price, Status, …) giữa **hiện tại** và **version đã chọn** (cột “Trạng thái”: Same / Changed).

Chỉ **Document manager** (super_admin hoặc content_manager) mới vào được trang Chi tiết và section Versions.

---

## 3. Rollback (khôi phục về version cũ)

Hàm **`rollback_document_to_version(document_id, version_id, created_by)`** trong database sẽ:

1. Tạo một version mới (backup trạng thái hiện tại) với reason dạng `rollback_backup_from_vX`.
2. Ghi đè tài liệu bằng nội dung từ version bạn chọn (title, description, price, file_path, preview_url, status, …).

Hiện tại hàm này chỉ được gán cho **service_role**. Có hai cách dùng:

### Cách 1: Chạy SQL trong Supabase (SQL Editor dùng service role / Dashboard)

1. Lấy **document_id** (UUID của tài liệu) và **version_id** (UUID của version cần rollback) từ trang Chi tiết (URL hoặc bảng Versions; version_id có thể lấy từ API/DB).
2. Trong **Supabase Dashboard → SQL Editor**, chạy:

```sql
SELECT * FROM public.rollback_document_to_version(
  'document-uuid-here'::UUID,
  'version-uuid-here'::UUID,
  NULL  -- hoặc admin user UUID nếu muốn ghi lại created_by
);
```

Kết quả trả về: `rolled_back` (true/false), `restored_from_version` (số version đã khôi phục), `new_version_id` (id của bản backup vừa tạo).

### Cách 2: Thêm nút “Rollback” trong Admin (cần implement)

Có thể thêm server action (hoặc API route) dùng **Supabase client với service_role** để gọi `rollback_document_to_version`, rồi trong trang Chi tiết tài liệu thêm nút **“Rollback về version này”** cạnh mỗi version (hoặc cạnh dropdown so sánh). Khi đó admin chỉ cần bấm nút thay vì chạy SQL.

---

## 4. Tóm tắt

| Việc | Cách làm |
|------|----------|
| **Xem danh sách version** | Admin → Tài liệu → [chọn tài liệu] → Chi tiết → section **Versions** |
| **So sánh version với hiện tại** | Trong Versions: chọn version từ dropdown → **So sánh với hiện tại** → xem bảng Diff |
| **Rollback về version cũ** | Chạy SQL `rollback_document_to_version(...)` (SQL Editor) hoặc dùng nút Rollback trong Admin (nếu đã thêm) |

Version được tạo **tự động** mỗi khi admin cập nhật hoặc xóa tài liệu; không cần thao tác “tạo version” riêng.
