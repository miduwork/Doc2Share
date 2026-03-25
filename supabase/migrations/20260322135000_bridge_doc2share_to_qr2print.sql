-- Bridge Migration: Doc2Share -> QR2Print (Payment Integration)
-- Thêm các cột thiếu từ schema của hệ thống thanh toán mới vào bảng orders hiện tại.

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS total_price int4,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'Chưa thanh toán',
ADD COLUMN IF NOT EXISTS print_color text DEFAULT 'bw',
ADD COLUMN IF NOT EXISTS print_sides text DEFAULT 'double',
ADD COLUMN IF NOT EXISTS order_spec jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS delivery_method text DEFAULT 'pickup',
ADD COLUMN IF NOT EXISTS delivery_address text,
ADD COLUMN IF NOT EXISTS shipping_fee int4 DEFAULT 0;

-- Đồng bộ dữ liệu cũ (nếu có)
UPDATE public.orders 
SET 
  total_price = floor(total_amount),
  payment_status = CASE 
    WHEN status = 'completed' THEN 'Đã thanh toán' 
    ELSE 'Chưa thanh toán' 
  END
WHERE total_price IS NULL;

-- Index hỗ trợ tìm kiếm và đối soát
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON public.orders(customer_name);
