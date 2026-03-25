/** Dữ liệu gửi từ form khách hàng (chỉ insert). id tùy chọn để tránh cần SELECT sau insert (RLS). */
export type OrderInsert = {
  id?: string;
  customer_name: string;
  phone_number: string;
  file_url: string;
  file_name: string | null;
  note: string | null;
  page_count: number | null;
  total_pages: number;
  total_price: number;
  copies: number;
  /** In đen trắng (mặc định) hoặc in màu */
  print_color: "bw" | "color";
  /** In 2 mặt (mặc định) hoặc in 1 mặt */
  print_sides: "double" | "single";
  delivery_method: "pickup" | "delivery";
  delivery_address: string | null;
  shipping_fee: number;
  /** Chi tiết form: loại in tài liệu / sách (schema xem printJobSpec). */
  order_spec?: Record<string, unknown> | null;
};

/** Đơn hàng đầy đủ (trùng schema bảng orders trong Supabase) */
export type Order = {
  id: string;
  created_at: string;
  customer_name: string;
  phone_number: string;
  file_url: string;
  file_name: string | null;
  note: string | null;
  page_count: number | null;
  total_pages: number | null;
  total_price: number | null;
  copies?: number | null;
  /** In đen trắng (bw) hoặc in màu (color). Cũ: null = coi là đen trắng */
  print_color?: "bw" | "color" | null;
  /** In 2 mặt (double) hoặc in 1 mặt (single). Cũ: null = coi là 2 mặt */
  print_sides?: "double" | "single" | null;
  delivery_method?: "pickup" | "delivery" | null;
  delivery_address?: string | null;
  shipping_fee?: number | null;
  order_spec?: Record<string, unknown> | null;
  priority: string;
  status: string;
  payment_status: string | null;
  completed_at: string | null;
  delivered_at: string | null;
};

export const ORDER_PRIORITY = {
  LOW: "Ưu tiên thấp",
  NORMAL: "Ưu tiên",
  HIGH: "Ưu tiên cao",
} as const;

export const ORDER_STATUS = {
  PENDING: "Chưa hoàn thành",
  COMPLETED: "Đã hoàn thành",
  DELIVERED: "Đã giao hàng",
} as const;
