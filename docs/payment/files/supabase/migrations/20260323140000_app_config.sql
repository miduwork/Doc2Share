-- Singleton cấu hình ứng dụng (giá in hybrid, mở rộng sau).
-- Seed: một mức base 500 VNĐ/trang, mult màu/mặt = 1 — khớp NEXT_PUBLIC_PRICE_PER_PAGE mặc định.
-- Chỉnh tay trong DB hoặc API P1 nếu deploy dùng giá khác.

CREATE TABLE public.app_config (
  id smallint PRIMARY KEY CHECK (id = 1),
  config jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_app_config_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_config_set_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_app_config_updated_at();

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Không policy cho anon/authenticated: chỉ service role (bỏ qua RLS) đọc/ghi từ server.

INSERT INTO public.app_config (id, config)
VALUES (
  1,
  $cfg${
    "v": 1,
    "pricing": {
      "v": 1,
      "basePerPageByPaper": {
        "A3": {
          "70": 500,
          "80": 500,
          "100": 500,
          "120": 500,
          "150": 500,
          "200": 500,
          "250": 500,
          "300": 500
        },
        "A4": {
          "70": 500,
          "80": 500,
          "100": 500,
          "120": 500,
          "150": 500,
          "200": 500,
          "250": 500,
          "300": 500
        },
        "A5": {
          "70": 500,
          "80": 500,
          "100": 500,
          "120": 500,
          "150": 500,
          "200": 500,
          "250": 500,
          "300": 500
        }
      },
      "multByColor": { "bw": 1, "color": 1 },
      "multBySides": { "double": 1, "single": 1 },
      "overridePerPage": {}
    }
  }$cfg$::jsonb
);
