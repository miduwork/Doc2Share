# Scripts archive

Scripts one-off hoặc đã lỗi thời, giữ lại để tham khảo.

- **fix-after-orders-exists.sql**: Chạy khi gặp lỗi "relation orders already exists" (migrations chạy một phần, bảng trước `orders` đã có). Schema hiện tại đã có đủ `orders`/`order_items` trong `20250220000001_initial_schema.sql`; script này chỉ dùng để sửa môi trường đã bị lỗi trước đó. Không cần cho setup mới.
