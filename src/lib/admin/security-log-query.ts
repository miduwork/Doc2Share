import type { SupabaseClient } from "@supabase/supabase-js";
import { clampInt, pickSingle } from "../search-params.ts";

export type SearchParamsLike = Record<string, string | string[] | undefined>;
export type CursorDirection = "next" | "prev";

export type SecurityLogFilters = {
  from: string;
  to: string;
  severity: string;
  status: string;
  userId: string;
  documentId: string;
  ipAddress: string;
  correlationId: string;
  pageSize: number;
  accessCursor: string;
  accessDir: CursorDirection;
  securityCursor: string;
  securityDir: CursorDirection;
};

export type AccessLogRow = {
  id: string;
  user_id: string | null;
  document_id: string | null;
  action: string;
  status: string;
  ip_address: string | null;
  device_id: string | null;
  correlation_id: string | null;
  created_at: string;
};

export type SecurityLogRow = {
  id: string;
  user_id: string | null;
  event_type: string;
  severity: string;
  ip_address: string | null;
  user_agent: string | null;
  device_id: string | null;
  correlation_id: string | null;
  created_at: string;
};

function defaultFromIso(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

function defaultToIso(): string {
  return new Date().toISOString();
}

export function parseSecurityLogFilters(searchParams?: SearchParamsLike): SecurityLogFilters {
  const source = searchParams ?? {};
  const from = pickSingle(source.from, defaultFromIso());
  const to = pickSingle(source.to, defaultToIso());

  return {
    from,
    to,
    severity: pickSingle(source.severity, "all"),
    status: pickSingle(source.status, "all"),
    userId: pickSingle(source.user_id, "").trim(),
    documentId: pickSingle(source.document_id, "").trim(),
    ipAddress: pickSingle(source.ip, "").trim(),
    correlationId: pickSingle(source.correlation_id, "").trim(),
    pageSize: clampInt(pickSingle(source.page_size, "50"), 10, 200, 50),
    accessCursor: pickSingle(source.access_cursor, ""),
    accessDir: pickSingle(source.access_dir, "next") === "prev" ? "prev" : "next",
    securityCursor: pickSingle(source.security_cursor, ""),
    securityDir: pickSingle(source.security_dir, "next") === "prev" ? "prev" : "next",
  };
}

function parseCursor(cursor: string): { createdAt: string; id: string } | null {
  const [createdAt, id] = cursor.split("|");
  if (!createdAt || !id) return null;
  return { createdAt, id };
}

export function encodeCursor(row: { created_at: string; id: string }): string {
  return `${row.created_at}|${row.id}`;
}

function applyCommonFilters<T>(query: T, filters: SecurityLogFilters): T {
  let next = query as any;
  next = next.gte("created_at", filters.from).lte("created_at", filters.to);
  if (filters.userId) next = next.eq("user_id", filters.userId);
  if (filters.ipAddress) next = next.eq("ip_address", filters.ipAddress);
  if (filters.correlationId) next = next.eq("correlation_id", filters.correlationId);
  return next as T;
}

function applyCursor<T>(query: T, cursor: string, direction: CursorDirection): T {
  const parsed = parseCursor(cursor);
  if (!parsed) return query;
  const clause =
    direction === "next"
      ? `created_at.lt.${parsed.createdAt},and(created_at.eq.${parsed.createdAt},id.lt.${parsed.id})`
      : `created_at.gt.${parsed.createdAt},and(created_at.eq.${parsed.createdAt},id.gt.${parsed.id})`;
  return (query as any).or(clause) as T;
}

function normalizeRows<T>(rows: T[], direction: CursorDirection): T[] {
  return direction === "prev" ? [...rows].reverse() : rows;
}

function computeCursors<T extends { id: string; created_at: string }>(
  rows: T[],
  hasExtra: boolean,
  cursor: string,
  direction: CursorDirection
): { nextCursor: string | null; prevCursor: string | null } {
  if (rows.length === 0) return { nextCursor: null, prevCursor: cursor ? cursor : null };
  const nextCursor = hasExtra ? encodeCursor(rows[rows.length - 1]) : null;
  const prevCursor = cursor ? encodeCursor(rows[0]) : null;
  if (direction === "prev") {
    return { nextCursor: prevCursor, prevCursor: hasExtra ? encodeCursor(rows[0]) : null };
  }
  return { nextCursor, prevCursor };
}

export async function fetchAccessLogsPage({
  supabase,
  filters,
}: {
  supabase: SupabaseClient;
  filters: SecurityLogFilters;
}): Promise<{ items: AccessLogRow[]; nextCursor: string | null; prevCursor: string | null }> {
  const ascending = filters.accessDir === "prev";
  let query = supabase
    .from("access_logs")
    .select("id, user_id, document_id, action, status, ip_address, device_id, correlation_id, created_at")
    .order("created_at", { ascending })
    .order("id", { ascending })
    .limit(filters.pageSize + 1);
  query = applyCommonFilters(query, filters);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.documentId) query = query.eq("document_id", filters.documentId);
  query = applyCursor(query, filters.accessCursor, filters.accessDir);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const raw = (data as AccessLogRow[] | null) ?? [];
  const rows = normalizeRows(raw.slice(0, filters.pageSize), filters.accessDir);
  const cursors = computeCursors(rows, raw.length > filters.pageSize, filters.accessCursor, filters.accessDir);
  return { items: rows, ...cursors };
}

export async function fetchSecurityLogsPage({
  supabase,
  filters,
}: {
  supabase: SupabaseClient;
  filters: SecurityLogFilters;
}): Promise<{ items: SecurityLogRow[]; nextCursor: string | null; prevCursor: string | null }> {
  const ascending = filters.securityDir === "prev";
  let query = supabase
    .from("security_logs")
    .select("id, user_id, event_type, severity, ip_address, user_agent, device_id, correlation_id, created_at")
    .order("created_at", { ascending })
    .order("id", { ascending })
    .limit(filters.pageSize + 1);
  query = applyCommonFilters(query, filters);
  if (filters.severity !== "all") query = query.eq("severity", filters.severity);
  query = applyCursor(query, filters.securityCursor, filters.securityDir);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const raw = (data as SecurityLogRow[] | null) ?? [];
  const rows = normalizeRows(raw.slice(0, filters.pageSize), filters.securityDir);
  const cursors = computeCursors(rows, raw.length > filters.pageSize, filters.securityCursor, filters.securityDir);
  return { items: rows, ...cursors };
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: string[]): string {
  const header = columns.map(csvEscape).join(",");
  const body = rows.map((row) => columns.map((col) => csvEscape(row[col])).join(",")).join("\n");
  return "\uFEFF" + header + "\n" + body;
}

export async function fetchAccessLogsForExport({
  supabase,
  filters,
  limit,
}: {
  supabase: SupabaseClient;
  filters: SecurityLogFilters;
  limit: number;
}): Promise<AccessLogRow[]> {
  let query = supabase
    .from("access_logs")
    .select("id, user_id, document_id, action, status, ip_address, device_id, correlation_id, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  query = applyCommonFilters(query, filters);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.documentId) query = query.eq("document_id", filters.documentId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as AccessLogRow[] | null) ?? [];
}

export async function fetchSecurityLogsForExport({
  supabase,
  filters,
  limit,
}: {
  supabase: SupabaseClient;
  filters: SecurityLogFilters;
  limit: number;
}): Promise<SecurityLogRow[]> {
  let query = supabase
    .from("security_logs")
    .select("id, user_id, event_type, severity, ip_address, user_agent, device_id, correlation_id, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  query = applyCommonFilters(query, filters);
  if (filters.severity !== "all") query = query.eq("severity", filters.severity);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as SecurityLogRow[] | null) ?? [];
}
