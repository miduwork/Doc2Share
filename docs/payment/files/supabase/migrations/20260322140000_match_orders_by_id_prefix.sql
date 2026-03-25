-- Tìm đơn theo prefix 8 ký tự đầu UUID (webhook SePay).
-- PostgREST .ilike('id::text', ...) qua client không ổn định; dùng RPC cho service_role.

create or replace function public.match_orders_by_id_prefix(p_prefix text)
returns table (
  id uuid,
  total_price int4,
  payment_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.total_price, o.payment_status
  from public.orders o
  where o.id::text ilike p_prefix || '%'
  limit 2;
$$;

revoke all on function public.match_orders_by_id_prefix(text) from public;
grant execute on function public.match_orders_by_id_prefix(text) to service_role;
