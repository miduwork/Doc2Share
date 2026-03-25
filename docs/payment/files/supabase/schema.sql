-- =============================================================================
-- QR2Print – Supabase Schema (tham khảo / tạo mới project)
-- Để XÓA HẾT CSDL + Storage và tạo lại từ đầu: dùng file reset_all.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PHẦN 1: XÓA TOÀN BỘ (chạy trước khi tạo lại)
-- Lưu ý: Dữ liệu trong bảng sẽ mất. Backup nếu cần.
-- -----------------------------------------------------------------------------

-- 1.1 Xóa policy trên storage.objects (nếu có)
drop policy if exists "Allow upload to documents" on storage.objects;
drop policy if exists "Allow public read documents" on storage.objects;

-- 1.2 Xóa policy đọc đơn thanh toán (nếu còn)
drop policy if exists "Khách xem đơn thanh toán" on public.orders;
drop policy if exists "anon_select_orders_for_realtime" on public.orders;
drop policy if exists "anon_insert_orders_public_form" on public.orders;

-- 1.3 Xóa bảng transactions trước (có khóa ngoại tới orders)
drop table if exists public.transactions;

-- 1.4 Xóa bảng orders
drop table if exists public.orders;

-- 1.4 (Tùy chọn) Xóa bucket documents và mọi file trong đó
-- Chỉ bỏ comment 2 dòng dưới nếu bạn muốn xóa cả file đã upload.
-- delete from storage.objects where bucket_id = 'documents';
-- delete from storage.buckets where id = 'documents';

-- -----------------------------------------------------------------------------
-- PHẦN 2: TẠO LẠI CSDL MỚI
-- -----------------------------------------------------------------------------

-- 2.1 Bảng orders (đơn in)
create table public.orders (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  customer_name text not null,
  phone_number text not null,
  file_url text not null,
  file_name text,
  note text,
  priority text default 'Ưu tiên',
  status text default 'Chưa hoàn thành',
  completed_at timestamptz,
  delivered_at timestamptz,
  page_count integer,
  copies int4 default 1,
  delivery_method text default 'pickup',
  delivery_address text,
  shipping_fee int4 default 0,
  total_pages int4,
  total_price int4,
  payment_status text default 'Chưa thanh toán',
  print_color text default 'bw',
  print_sides text default 'double',
  order_spec jsonb default '{}'::jsonb
);

-- Indexes hỗ trợ truy vấn nhanh theo trạng thái
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_created_at on public.orders(created_at desc);

comment on table public.orders is 'Đơn in – form khách gửi, admin quản lý, webhook cập nhật thanh toán';

alter table public.orders enable row level security;

-- INSERT từ form khách: policy "anon_insert_orders_public_form" (anon).
-- Webhook/API server: service role bỏ qua RLS.

create policy "authenticated_admin_orders_full_access"
  on public.orders for all to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin')
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');

-- Realtime /payment/[id]: Postgres Changes cần quyền SELECT cho anon (trade-off: anon key có thể đọc đơn qua API).
create policy "anon_select_orders_for_realtime"
  on public.orders for select to anon using (true);

-- Form khách (trang chủ): insert qua POST /api/orders (service role server)
create policy "anon_insert_orders_public_form"
  on public.orders for insert to anon
  with check (true);

-- 2.2 Bảng transactions (log webhook SePay – đối soát)
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  sepay_id bigint,
  gateway text,
  transaction_date text,
  account_number text,
  content text,
  description text,
  transfer_type text,
  transfer_amount bigint,
  reference_code text,
  order_id uuid references public.orders(id),
  order_id_prefix text,
  amount_matched boolean not null default false,
  order_updated boolean not null default false,
  raw_payload jsonb
);

comment on table public.transactions is 'Lịch sử giao dịch từ webhook SePay – dùng để đối soát';

alter table public.transactions enable row level security;

create policy "Admin đọc transactions"
  on public.transactions for select to authenticated using (true);

-- 2.3 Storage: bucket documents (file tài liệu khách gửi)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update set public = true;

create policy "Allow upload to documents"
  on storage.objects for insert to anon
  with check (bucket_id = 'documents');

create policy "Allow public read documents"
  on storage.objects for select to anon
  using (bucket_id = 'documents');

-- -----------------------------------------------------------------------------
-- Realtime (trang /payment/[id] tự cập nhật khi webhook cập nhật orders)
-- Thêm bảng orders vào publication supabase_realtime; REPLICA IDENTITY FULL để nhận full row khi UPDATE
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.orders;
alter table public.orders replica identity full;

-- -----------------------------------------------------------------------------
-- Dashboard admin stats RPC (gom nhiều count thành một round-trip)
-- -----------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats(
  p_now timestamptz default now()
)
returns jsonb
language sql
security invoker
set search_path = public
as $$
with bounds as (
  select
    (p_now at time zone 'Asia/Ho_Chi_Minh')::date as today_vn
),
date_window as (
  select
    (today_vn - 6) as start_date_vn,
    today_vn as end_date_vn,
    ((today_vn - 6)::timestamp at time zone 'Asia/Ho_Chi_Minh') as start_utc,
    ((today_vn + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh') as end_utc_exclusive
  from bounds
),
snapshot as (
  select
    count(*) filter (
      where payment_status is null or payment_status <> 'Đã thanh toán'
    )::bigint as unpaid_count,
    count(*) filter (
      where status = 'Chưa hoàn thành'
    )::bigint as pending_print_count,
    count(*) filter (
      where priority = 'Ưu tiên cao' and status = 'Chưa hoàn thành'
    )::bigint as high_priority_pending_count,
    count(*) filter (
      where status = 'Đã hoàn thành'
    )::bigint as awaiting_delivery_count,
    max(created_at) as max_created_at
  from public.orders
),
trend_raw as (
  select
    (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date as day_vn,
    count(*)::bigint as cnt
  from public.orders o
  cross join date_window w
  where o.created_at >= w.start_utc
    and o.created_at < w.end_utc_exclusive
  group by 1
),
trend as (
  select
    d.day_vn,
    coalesce(r.cnt, 0)::bigint as cnt
  from date_window w
  cross join lateral generate_series(
    w.start_date_vn,
    w.end_date_vn,
    interval '1 day'
  ) as d(day_vn)
  left join trend_raw r
    on r.day_vn = d.day_vn
  order by d.day_vn
),
recent_orders as (
  select
    o.id,
    o.created_at,
    o.customer_name,
    o.status,
    o.priority
  from public.orders o
  order by o.created_at desc
  limit 8
),
paid_window as (
  select
    count(*)::bigint as paid_orders_last_7_days
  from public.orders o
  cross join date_window w
  where o.payment_status = 'Đã thanh toán'
    and o.created_at >= w.start_utc
    and o.created_at < w.end_utc_exclusive
)
select jsonb_build_object(
  'ordersToday', coalesce((select cnt from trend order by day_vn desc limit 1), 0),
  'unpaidCount', coalesce((select unpaid_count from snapshot), 0),
  'pendingPrintCount', coalesce((select pending_print_count from snapshot), 0),
  'highPriorityPendingCount', coalesce((select high_priority_pending_count from snapshot), 0),
  'awaitingDeliveryCount', coalesce((select awaiting_delivery_count from snapshot), 0),
  'recent_orders', coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'created_at', created_at,
          'customer_name', customer_name,
          'status', status,
          'priority', priority
        )
        order by created_at desc
      )
      from recent_orders
    ),
    '[]'::jsonb
  ),
  'orders_by_day', coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'date', to_char(day_vn, 'YYYY-MM-DD'),
          'count', cnt
        )
        order by day_vn
      )
      from trend
    ),
    '[]'::jsonb
  ),
  'paid_orders_last_7_days', coalesce((select paid_orders_last_7_days from paid_window), 0),
  'max_created_at', (select max_created_at from snapshot)
);
$$;

grant execute on function public.admin_dashboard_stats(timestamptz)
  to authenticated;

-- -----------------------------------------------------------------------------
-- PHẦN 3: DB cũ (đã có orders trước khi có cột in / order_spec)
-- Không chạy khi đã chạy PHẦN 1–2 ở trên. Các ALTER idempotent nằm trong
-- supabase/migrations/20250322100000_add_print_options.sql và
-- supabase/migrations/20260322180000_orders_order_spec.sql — xem supabase-setup.md.
-- -----------------------------------------------------------------------------
