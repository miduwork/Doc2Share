import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminRecentOrderRow,
  AdminStatsLiteResponse,
  AdminStatsResponse,
  OrdersByDayRow,
} from "@/lib/orders/adminStatsTypes";

function emptyStatsResponse(): AdminStatsResponse {
  return {
    ordersToday: 0,
    unpaidCount: 0,
    pendingPrintCount: 0,
    highPriorityPendingCount: 0,
    awaitingDeliveryCount: 0,
    recent_orders: [],
    orders_by_day: [],
    paid_orders_last_7_days: 0,
    max_created_at: null,
  };
}

function emptyStatsLiteResponse(): AdminStatsLiteResponse {
  return {
    ordersToday: 0,
    unpaidCount: 0,
    pendingPrintCount: 0,
    highPriorityPendingCount: 0,
    awaitingDeliveryCount: 0,
    max_created_at: null,
  };
}

function asNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function parseRecentOrders(v: unknown): AdminRecentOrderRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => ({
      id: typeof row.id === "string" ? row.id : "",
      created_at: typeof row.created_at === "string" ? row.created_at : "",
      customer_name:
        typeof row.customer_name === "string" ? row.customer_name : "",
      status: typeof row.status === "string" ? row.status : "",
      priority: typeof row.priority === "string" ? row.priority : "",
    }))
    .filter((row) => row.id.length > 0 && row.created_at.length > 0);
}

function parseOrdersByDay(v: unknown): OrdersByDayRow[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => ({
      date: typeof row.date === "string" ? row.date : "",
      count: asNumber(row.count),
    }))
    .filter((row) => row.date.length > 0);
}

function parseStatsRpcPayload(v: unknown): AdminStatsResponse {
  if (!v || typeof v !== "object") return emptyStatsResponse();
  const payload = v as Record<string, unknown>;
  return {
    ordersToday: asNumber(payload.ordersToday),
    unpaidCount: asNumber(payload.unpaidCount),
    pendingPrintCount: asNumber(payload.pendingPrintCount),
    highPriorityPendingCount: asNumber(payload.highPriorityPendingCount),
    awaitingDeliveryCount: asNumber(payload.awaitingDeliveryCount),
    recent_orders: parseRecentOrders(payload.recent_orders),
    orders_by_day: parseOrdersByDay(payload.orders_by_day),
    paid_orders_last_7_days: asNumber(payload.paid_orders_last_7_days),
    max_created_at:
      typeof payload.max_created_at === "string" ? payload.max_created_at : null,
  };
}

/**
 * Số liệu dashboard: gom count/recent/trend qua RPC `admin_dashboard_stats`.
 */
export async function computeAdminStatsForApi(
  supabase: SupabaseClient,
): Promise<{ data: AdminStatsResponse; error: Error | null }> {
  const { data, error } = await supabase.rpc("admin_dashboard_stats");
  if (error) {
    return {
      data: emptyStatsResponse(),
      error: new Error(error.message || "Lỗi thống kê đơn."),
    };
  }
  return {
    data: parseStatsRpcPayload(data),
    error: null,
  };
}

function vietnamTodayUtcBounds(now = new Date()): { startIso: string; endIso: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "1970");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "01");
  const day = Number(parts.find((p) => p.type === "day")?.value ?? "01");

  // VN là UTC+7, nên mốc 00:00 VN tương ứng 17:00 UTC ngày trước.
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - 7 * 60 * 60 * 1000;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
  };
}

function ordersCountHeadQuery(supabase: SupabaseClient) {
  return supabase.from("orders").select("id", {
    count: "exact",
    head: true,
  });
}

async function countOrders(
  supabase: SupabaseClient,
  applyFilters?: (
    query: ReturnType<typeof ordersCountHeadQuery>,
  ) => ReturnType<typeof ordersCountHeadQuery>,
): Promise<{ count: number; error: Error | null }> {
  let query = ordersCountHeadQuery(supabase);
  if (applyFilters) {
    query = applyFilters(query);
  }
  const { count, error } = await query;
  if (error) return { count: 0, error: new Error(error.message || "Lỗi đếm đơn.") };
  return { count: count ?? 0, error: null };
}

/**
 * Bản nhẹ cho polling nhanh: card counts + max_created_at.
 */
export async function computeAdminStatsLiteForApi(
  supabase: SupabaseClient,
): Promise<{ data: AdminStatsLiteResponse; error: Error | null }> {
  const { startIso, endIso } = vietnamTodayUtcBounds();

  const todayCountPromise = countOrders(supabase, (q) =>
    q.gte("created_at", startIso).lt("created_at", endIso),
  );
  const unpaidCountPromise = countOrders(supabase, (q) =>
    q.or('payment_status.is.null,payment_status.neq."Đã thanh toán"'),
  );
  const pendingPrintCountPromise = countOrders(supabase, (q) =>
    q.eq("status", "Chưa hoàn thành"),
  );
  const highPriorityPendingCountPromise = countOrders(supabase, (q) =>
    q.eq("priority", "Ưu tiên cao").eq("status", "Chưa hoàn thành"),
  );
  const awaitingDeliveryCountPromise = countOrders(supabase, (q) =>
    q.eq("status", "Đã hoàn thành"),
  );
  const maxCreatedAtPromise = getAdminOrdersMaxCreatedAt(supabase);

  const [
    todayCount,
    unpaidCount,
    pendingPrintCount,
    highPriorityPendingCount,
    awaitingDeliveryCount,
    maxCreatedAt,
  ] = await Promise.all([
    todayCountPromise,
    unpaidCountPromise,
    pendingPrintCountPromise,
    highPriorityPendingCountPromise,
    awaitingDeliveryCountPromise,
    maxCreatedAtPromise,
  ]);

  const firstError =
    todayCount.error ??
    unpaidCount.error ??
    pendingPrintCount.error ??
    highPriorityPendingCount.error ??
    awaitingDeliveryCount.error ??
    maxCreatedAt.error;

  if (firstError) {
    return { data: emptyStatsLiteResponse(), error: firstError };
  }

  return {
    data: {
      ordersToday: todayCount.count,
      unpaidCount: unpaidCount.count,
      pendingPrintCount: pendingPrintCount.count,
      highPriorityPendingCount: highPriorityPendingCount.count,
      awaitingDeliveryCount: awaitingDeliveryCount.count,
      max_created_at: maxCreatedAt.data,
    },
    error: null,
  };
}

export async function getAdminOrdersMaxCreatedAt(
  supabase: SupabaseClient,
): Promise<{ data: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("orders")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return { data: null, error: new Error(error.message || "Lỗi đọc mốc đơn.") };
  }
  const row = data as { created_at?: string | null } | null;
  return { data: row?.created_at ?? null, error: null };
}
