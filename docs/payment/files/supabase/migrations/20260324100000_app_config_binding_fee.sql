-- Phí đóng gáy sách (VNĐ/cuốn) trong pricing — chỉ thêm khi bản ghi cũ chưa có khóa.
UPDATE public.app_config
SET config = jsonb_set(
  config,
  '{pricing,bindingFeeVnd}',
  '{"spring_metal":0,"spring_plastic":0,"glue":0}'::jsonb,
  true
)
WHERE id = 1
  AND (
    (config #> '{pricing,bindingFeeVnd}') IS NULL
    OR jsonb_typeof(config #> '{pricing,bindingFeeVnd}') = 'null'
  );
