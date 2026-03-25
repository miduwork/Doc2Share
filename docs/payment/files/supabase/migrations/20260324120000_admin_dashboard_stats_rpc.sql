CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats(
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
WITH bounds AS (
  SELECT
    (p_now AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS today_vn
),
date_window AS (
  SELECT
    (today_vn - 6) AS start_date_vn,
    today_vn AS end_date_vn,
    ((today_vn - 6)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AS start_utc,
    ((today_vn + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AS end_utc_exclusive
  FROM bounds
),
snapshot AS (
  SELECT
    count(*) FILTER (
      WHERE payment_status IS NULL OR payment_status <> 'Đã thanh toán'
    )::bigint AS unpaid_count,
    count(*) FILTER (
      WHERE status = 'Chưa hoàn thành'
    )::bigint AS pending_print_count,
    count(*) FILTER (
      WHERE priority = 'Ưu tiên cao' AND status = 'Chưa hoàn thành'
    )::bigint AS high_priority_pending_count,
    count(*) FILTER (
      WHERE status = 'Đã hoàn thành'
    )::bigint AS awaiting_delivery_count,
    max(created_at) AS max_created_at
  FROM public.orders
),
trend_raw AS (
  SELECT
    (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day_vn,
    count(*)::bigint AS cnt
  FROM public.orders o
  CROSS JOIN date_window w
  WHERE o.created_at >= w.start_utc
    AND o.created_at < w.end_utc_exclusive
  GROUP BY 1
),
trend AS (
  SELECT
    d.day_vn,
    COALESCE(r.cnt, 0)::bigint AS cnt
  FROM date_window w
  CROSS JOIN LATERAL generate_series(
    w.start_date_vn,
    w.end_date_vn,
    interval '1 day'
  ) AS d(day_vn)
  LEFT JOIN trend_raw r
    ON r.day_vn = d.day_vn
  ORDER BY d.day_vn
),
recent_orders AS (
  SELECT
    o.id,
    o.created_at,
    o.customer_name,
    o.status,
    o.priority
  FROM public.orders o
  ORDER BY o.created_at DESC
  LIMIT 8
),
paid_window AS (
  SELECT
    count(*)::bigint AS paid_orders_last_7_days
  FROM public.orders o
  CROSS JOIN date_window w
  WHERE o.payment_status = 'Đã thanh toán'
    AND o.created_at >= w.start_utc
    AND o.created_at < w.end_utc_exclusive
)
SELECT jsonb_build_object(
  'ordersToday', COALESCE((SELECT cnt FROM trend ORDER BY day_vn DESC LIMIT 1), 0),
  'unpaidCount', COALESCE((SELECT unpaid_count FROM snapshot), 0),
  'pendingPrintCount', COALESCE((SELECT pending_print_count FROM snapshot), 0),
  'highPriorityPendingCount', COALESCE((SELECT high_priority_pending_count FROM snapshot), 0),
  'awaitingDeliveryCount', COALESCE((SELECT awaiting_delivery_count FROM snapshot), 0),
  'recent_orders', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'created_at', created_at,
          'customer_name', customer_name,
          'status', status,
          'priority', priority
        )
        ORDER BY created_at DESC
      )
      FROM recent_orders
    ),
    '[]'::jsonb
  ),
  'orders_by_day', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', to_char(day_vn, 'YYYY-MM-DD'),
          'count', cnt
        )
        ORDER BY day_vn
      )
      FROM trend
    ),
    '[]'::jsonb
  ),
  'paid_orders_last_7_days', COALESCE((SELECT paid_orders_last_7_days FROM paid_window), 0),
  'max_created_at', (SELECT max_created_at FROM snapshot)
);
$$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats(timestamptz)
  TO authenticated;
