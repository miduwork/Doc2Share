# Role và Admin role – Xem và điều chỉnh

## 1. Hai loại “role” trong hệ thống

| Trường | Bảng | Ý nghĩa | Giá trị |
|--------|------|---------|---------|
| **role** | `profiles` | Vai trò người dùng | `student`, `teacher`, `admin` |
| **admin_role** | `profiles` | Cấp quyền admin (chỉ khi `role = 'admin'`) | `super_admin`, `content_manager`, `support_agent` |

- **role**: Ai cũng có (mặc định `student`). `admin` = vào được khu vực Admin.
- **admin_role**: Chỉ có ý nghĩa khi `role = 'admin'`. Quyết định được làm gì trong Admin (quản lý tài liệu, quản lý user, v.v.).

## 2. Cách xem role / admin_role

### Trong ứng dụng (Admin)

- **Admin → Khách hàng & CRM** (`/admin/users`): cột **Vai trò** = `profiles.role` (student / teacher / admin).
- **Chi tiết user** (`/admin/users/[id]`): hiển thị **Role** và **Admin role** (nếu là admin) trong header.

### Trong Supabase

- **Dashboard → Table Editor → `profiles`**: xem/sửa trực tiếp cột `role` và `admin_role`.
- **SQL Editor**: ví dụ `SELECT id, full_name, role, admin_role, is_active FROM profiles WHERE id = '...';`

## 3. Cách điều chỉnh role / admin_role

### Cách 1: Trong ứng dụng (chỉ Super Admin)

- Vào **Admin → Khách hàng & CRM** → chọn user → vào **Hồ sơ khách hàng**.
- Nếu bạn đăng nhập bằng tài khoản **super_admin**, sẽ thấy mục **Phân quyền** với:
  - **Role**: Student / Teacher / Admin
  - **Admin role**: (chỉ khi Role = Admin) Super Admin / Content Manager / Support Agent
- Chỉnh xong → bấm **Lưu thay đổi**.

### Cách 2: Supabase Dashboard

1. Vào **Supabase Dashboard** → project của bạn.
2. **Table Editor** → chọn bảng **profiles**.
3. Tìm dòng theo `id` (User ID) hoặc `full_name` / email (nếu có).
4. Sửa cột **role** và/hoặc **admin_role** → Save.

### Cách 3: SQL (Supabase SQL Editor)

```sql
-- Đặt user thành admin với quyền support_agent
UPDATE profiles
SET role = 'admin', admin_role = 'support_agent', updated_at = NOW()
WHERE id = '0842c9fe-2c74-4c53-bff0-c5bf53e9c1e8';

-- Chỉ đổi admin_role (user đã là admin)
UPDATE profiles
SET admin_role = 'content_manager', updated_at = NOW()
WHERE id = '...' AND role = 'admin';
```

Giá trị hợp lệ:

- **role**: `student`, `teacher`, `admin`
- **admin_role**: `super_admin`, `content_manager`, `support_agent` (hoặc `NULL` nếu không phải admin)

## 4. Ý nghĩa từng admin_role

| admin_role | Quản lý tài liệu | Quản lý người dùng | Mở khóa thủ công (cấp quyền) |
|------------|------------------|--------------------|------------------------------|
| **super_admin** | Có | Có | Có |
| **content_manager** | Có | Không | Có |
| **support_agent** | Không | Có | Có (sau khi bật policy RLS) |

- **super_admin**: toàn quyền admin, có thể đổi role/admin_role của user khác.
- **content_manager**: quản lý tài liệu, cấp quyền xem tài liệu.
- **support_agent**: quản lý khách hàng (user), cấp quyền xem tài liệu (mở khóa thủ công).
