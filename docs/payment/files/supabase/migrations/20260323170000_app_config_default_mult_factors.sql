-- Hệ số màu/mặt mặc định khác 1 để resolvePricePerPage phân biệt đen trắng/màu và 1 mặt/2 mặt
-- (trước đây seed dùng toàn 1 → đổi tùy chọn form không đổi giá).
-- Giá trị tham chiếu: docs/APP-ADMIN-SETTINGS-PRICING-PLAN.md §4.1

UPDATE public.app_config
SET config = jsonb_set(
  jsonb_set(
    config,
    '{pricing,multByColor}',
    '{"bw": 1, "color": 1.5}'::jsonb,
    true
  ),
  '{pricing,multBySides}',
  '{"double": 1, "single": 0.8}'::jsonb,
  true
)
WHERE id = 1;
