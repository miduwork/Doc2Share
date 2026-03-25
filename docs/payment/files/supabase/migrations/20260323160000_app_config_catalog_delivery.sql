-- Bổ sung catalog + delivery mặc định (khớp code trước P2/P3).

UPDATE public.app_config
SET
  config =
    config
    || '{"catalog":{"v":1,"paperSizes":["A3","A4","A5"],"gsmOptions":["70","80","100","120","150","200","250","300"],"bindingOptions":[{"value":"spring_metal","label":"Lò xo kẽm"},{"value":"spring_plastic","label":"Lò xo nhựa"},{"value":"glue","label":"Keo"}],"printJobKindOptions":[{"value":"document","label":"In tài liệu thường"},{"value":"book","label":"In sách"}]}}'::jsonb
    || '{"delivery":{"v":1,"freeshipThresholdVnd":200000,"shippingFeeDelivery":20000,"wards":["Phường Vũng Tàu","Phường Tam Thắng","Phường Rạch Dừa","Phường Phước Thắng"],"city":"TP. Hồ Chí Minh"}}'::jsonb
WHERE
  id = 1;
