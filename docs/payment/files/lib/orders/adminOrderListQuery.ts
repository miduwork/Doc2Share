import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_ORDER_BATCH_MAX_IDS,
  ADMIN_ORDER_EXPORT_MAX,
  ADMIN_ORDER_LIST_DEFAULT_LIMIT,
  ADMIN_ORDER_LIST_MAX_LIMIT,
  ADMIN_ORDER_PAGE_SIZE_OPTIONS,
  normalizeAdminOrderPageSize,
  parseAdminOrderExportContractParams,
  parseAdminOrderListContractParams,
  type AdminOrderListContractParsed,
} from "@/lib/admin/adminOrdersListContract";
import { ORDERS_ADMIN_LIST_SELECT_LIGHT } from "@/lib/orders/adminOrderData";
import { PAYMENT_STATUS_PAID } from "@/lib/orders/adminPaymentPatch";
import { normalizeUuidForPrefixMatch } from "@/lib/orders/adminOrderFilters";
import type { Order } from "@/lib/orders/types";
export {
  ADMIN_ORDER_BATCH_MAX_IDS,
  ADMIN_ORDER_EXPORT_MAX,
  ADMIN_ORDER_LIST_DEFAULT_LIMIT,
  ADMIN_ORDER_LIST_MAX_LIMIT,
  ADMIN_ORDER_PAGE_SIZE_OPTIONS,
  normalizeAdminOrderPageSize,
};
export type AdminOrderListParsed = AdminOrderListContractParsed;

type AdminOrderCursorTuple = {
  priority_sort: number;
  created_at: string;
  id: string;
};

/** Escape `%`, `_`, `\` cho pattern LIKE/ilike (PostgreSQL). */
export function escapeForIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function parseAdminOrderListParams(
  searchParams: URLSearchParams,
): AdminOrderListParsed {
  return parseAdminOrderListContractParams(searchParams);
}

/** Export: cùng filter; `limit` clamp tối đa export; không phân trang (offset 0). */
export function parseAdminOrderExportParams(
  searchParams: URLSearchParams,
): AdminOrderListParsed {
  return parseAdminOrderExportContractParams(searchParams);
}

export function deriveAdminListPageWindow<T>(
  rows: T[],
  limit: number,
): { rows: T[]; hasMore: boolean } {
  const hasMore = rows.length > limit;
  return {
    rows: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
  };
}

export async function listOrdersForAdminFiltered(
  supabase: SupabaseClient,
  params: AdminOrderListParsed,
): Promise<{
  data: Order[] | null;
  error: PostgrestError | null;
  hasMore: boolean;
  total: number | null;
  nextCursor: string | null;
}> {
  let query = params.includeTotalExact
    ? supabase
        .from("orders")
        .select(ORDERS_ADMIN_LIST_SELECT_LIGHT, { count: "exact" })
    : supabase.from("orders").select(ORDERS_ADMIN_LIST_SELECT_LIGHT);

  if (params.payment === "paid") {
    query = query.eq("payment_status", PAYMENT_STATUS_PAID);
  } else if (params.payment === "unpaid") {
    query = query.or(
      `payment_status.is.null,payment_status.neq."${PAYMENT_STATUS_PAID}"`,
    );
  }

  if (params.status) {
    query = query.eq("status", params.status);
  }

  if (params.priority) {
    query = query.eq("priority", params.priority);
  }

  if (params.createdAtGte) {
    query = query.gte("created_at", params.createdAtGte);
  }
  if (params.createdAtLte) {
    query = query.lte("created_at", params.createdAtLte);
  }

  const qTrim = params.q.trim();
  if (qTrim) {
    const escaped = escapeForIlikePattern(qTrim);
    const qNorm = normalizeUuidForPrefixMatch(qTrim);
    const parts: string[] = [
      `customer_name.ilike.%${escaped}%`,
      `phone_number.ilike.%${escaped}%`,
    ];
    if (qNorm.length >= 8) {
      const p8 = escapeForIlikePattern(qNorm.slice(0, 8));
      parts.push(`id_hex.ilike.${p8}%`);
    } else if (qNorm.length > 0) {
      const p = escapeForIlikePattern(qNorm);
      parts.push(`id_hex.ilike.${p}%`);
    }
    query = query.or(parts.join(","));
  }

  query = query
    .order("priority_sort", { ascending: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const decodedCursor = decodeAdminOrderCursor(params.cursor);
  if (decodedCursor) {
    query = query.or(buildAdminOrderSeekPredicate(decodedCursor, params.direction));
  }

  // Trong giai đoạn chuyển tiếp vẫn cho phép offset khi không có cursor.
  if (!params.cursor && params.offset > 0) {
    query = query.range(params.offset, params.offset + params.limit);
  } else {
    // Lấy dư 1 bản ghi để suy ra hasMore, giảm phụ thuộc count exact.
    query = query.range(0, params.limit);
  }

  const { data, error, count } = await query;
  const rows = (data as Array<Order & { priority_sort?: number | null }> | null) ?? [];
  const page = deriveAdminListPageWindow(rows, params.limit);
  const nextCursor =
    page.hasMore && page.rows.length > 0
      ? encodeAdminOrderCursorFromRow(
          page.rows[page.rows.length - 1] as Order & {
            priority_sort?: number | null;
          },
        )
      : null;
  return {
    data: page.rows,
    error,
    hasMore: page.hasMore,
    total: params.includeTotalExact ? (count ?? 0) : null,
    nextCursor,
  };
}

function toBase64Url(input: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  const bytes = new TextEncoder().encode(input);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const encoded = globalThis.btoa(binary);
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): string | null {
  try {
    const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    if (typeof Buffer !== "undefined") {
      return Buffer.from(padded, "base64").toString("utf8");
    }
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function encodeAdminOrderCursor(c: AdminOrderCursorTuple): string {
  return toBase64Url(JSON.stringify(c));
}

function decodeAdminOrderCursor(raw: string | null): AdminOrderCursorTuple | null {
  if (!raw) return null;
  const json = fromBase64Url(raw);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Partial<AdminOrderCursorTuple>;
    if (
      typeof parsed?.priority_sort === "number" &&
      typeof parsed?.created_at === "string" &&
      typeof parsed?.id === "string"
    ) {
      return {
        priority_sort: parsed.priority_sort,
        created_at: parsed.created_at,
        id: parsed.id,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function quoteForPostgrest(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildAdminOrderSeekPredicate(
  c: AdminOrderCursorTuple,
  direction: "next" | "prev",
): string {
  const p = c.priority_sort;
  const t = quoteForPostgrest(c.created_at);
  const id = quoteForPostgrest(c.id);

  if (direction === "prev") {
    return [
      `priority_sort.gt.${p}`,
      `and(priority_sort.eq.${p},created_at.lt.${t})`,
      `and(priority_sort.eq.${p},created_at.eq.${t},id.lt.${id})`,
    ].join(",");
  }

  return [
    `priority_sort.lt.${p}`,
    `and(priority_sort.eq.${p},created_at.gt.${t})`,
    `and(priority_sort.eq.${p},created_at.eq.${t},id.gt.${id})`,
  ].join(",");
}

function encodeAdminOrderCursorFromRow(
  row: Order & { priority_sort?: number | null },
): string | null {
  const prioritySort =
    typeof row.priority_sort === "number"
      ? row.priority_sort
      : row.priority === "Ưu tiên cao"
        ? 3
        : row.priority === "Ưu tiên"
          ? 2
          : row.priority === "Ưu tiên thấp"
            ? 1
            : 0;
  if (!row.created_at || !row.id) return null;
  return encodeAdminOrderCursor({
    priority_sort: prioritySort,
    created_at: row.created_at,
    id: row.id,
  });
}

/** Đọc đơn theo danh sách id (admin list select), tối đa `ADMIN_ORDER_BATCH_MAX_IDS`. */
export async function listOrdersByIdsForAdmin(
  supabase: SupabaseClient,
  ids: string[],
): Promise<{ data: Order[] | null; error: PostgrestError | null }> {
  if (ids.length === 0) {
    return { data: [], error: null };
  }
  const capped = ids.slice(0, ADMIN_ORDER_BATCH_MAX_IDS);
  const { data, error } = await supabase
    .from("orders")
    .select(ORDERS_ADMIN_LIST_SELECT_LIGHT)
    .in("id", capped);
  return {
    data: data as Order[] | null,
    error,
  };
}
