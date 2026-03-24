import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseSecurityLogFilters, fetchAccessLogsPage, fetchSecurityLogsPage, type SearchParamsLike } from "./security-log-query";
import { computeHighRiskUsers, getWeeklyFalsePositiveStats } from "./security-risk";
import { resolveGeoPoints } from "./ip-geo-resolver";
import { syncSecurityIncidentsFromHighRiskUsers } from "./incident/security-incident-sync";
import { getSecurityBenchmarkMetrics } from "./benchmark/security-benchmark-metrics.service";
import type {
  ActiveSessionRow,
  CursorPagination,
  RiskBenchmarkStats,
  SecurityExportUrls,
  SecurityIncidentRow,
  SecurityLogFilters,
} from "./security-dashboard.types";
import type { SecurityWorkspace } from "./security-workspace";

function toQueryString(params: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) query.set(key, value);
  return query.toString();
}

function buildExportUrls(filters: SecurityLogFilters): SecurityExportUrls {
  const filterQuery = {
    from: filters.from,
    to: filters.to,
    severity: filters.severity,
    status: filters.status,
    user_id: filters.userId,
    document_id: filters.documentId,
    ip: filters.ipAddress,
    correlation_id: filters.correlationId,
    page_size: String(filters.pageSize),
  };
  const q = toQueryString(filterQuery);
  return {
    access: `/admin/security/export/access-logs?${q}`,
    security: `/admin/security/export/security-logs?${q}`,
  };
}

export type SecurityWorkspaceData = {
  workspace: SecurityWorkspace;
  filters: SecurityLogFilters;
  logs: any[];
  accessLogs: any[];
  accessPagination: CursorPagination;
  securityPagination: CursorPagination;
  exportUrls: SecurityExportUrls;
  highRiskUsers: any[];
  weeklyStats: { weekStartIso: string; totalIncidents: number; confirmedRisk: number; manualFalsePositive: number; proxyFalsePositive: number };
  incidents: SecurityIncidentRow[];
  activeSessions: ActiveSessionRow[];
  geoPoints: any[];
  benchmark: { stats: RiskBenchmarkStats; interpretation: { proxyPrecisionDelta: number; manualPrecisionDelta: number; candidateDelta: number } } | null;
};

async function loadOverviewData(supabase: SupabaseClient, service: SupabaseClient) {
  const { data: activeSessions } = await supabase
    .from("active_sessions")
    .select("session_id, user_id, ip_address, user_agent, device_id, created_at")
    .order("created_at", { ascending: false });
  const [highRiskUsers, weeklyStats] = await Promise.all([
    computeHighRiskUsers({ supabase: service, threshold: 70, limit: 20 }),
    getWeeklyFalsePositiveStats({ supabase: service }),
  ]);
  await syncSecurityIncidentsFromHighRiskUsers({ highRiskUsers, service });
  const { data: incidents } = await supabase
    .from("security_incidents")
    .select("id, correlation_id, user_id, risk_score, risk_band, review_status, detected_at, notes")
    .order("detected_at", { ascending: false })
    .limit(20);
  return {
    highRiskUsers,
    weeklyStats,
    incidents: (incidents ?? []) as SecurityIncidentRow[],
    activeSessions: (activeSessions ?? []) as ActiveSessionRow[],
  };
}

export async function getSecurityWorkspaceData({
  searchParams,
  workspace,
}: {
  searchParams?: SearchParamsLike;
  workspace: SecurityWorkspace;
}): Promise<SecurityWorkspaceData> {
  const filters = parseSecurityLogFilters(searchParams);
  const supabase = await createClient();
  const service = createServiceRoleClient();
  const emptyWeekly = {
    weekStartIso: new Date().toISOString(),
    totalIncidents: 0,
    confirmedRisk: 0,
    manualFalsePositive: 0,
    proxyFalsePositive: 0,
  };
  const base: SecurityWorkspaceData = {
    workspace,
    filters,
    logs: [],
    accessLogs: [],
    accessPagination: { nextCursor: null, prevCursor: null },
    securityPagination: { nextCursor: null, prevCursor: null },
    exportUrls: buildExportUrls(filters),
    highRiskUsers: [],
    weeklyStats: emptyWeekly,
    incidents: [],
    activeSessions: [],
    geoPoints: [],
    benchmark: null,
  };

  if (workspace === "logs") {
    const [securityLogsPage, accessLogsPage] = await Promise.all([
      fetchSecurityLogsPage({ supabase, filters }),
      fetchAccessLogsPage({ supabase, filters }),
    ]);
    return {
      ...base,
      logs: securityLogsPage.items,
      accessLogs: accessLogsPage.items,
      accessPagination: { nextCursor: accessLogsPage.nextCursor, prevCursor: accessLogsPage.prevCursor },
      securityPagination: { nextCursor: securityLogsPage.nextCursor, prevCursor: securityLogsPage.prevCursor },
    };
  }

  if (workspace === "geo") {
    const [securityLogsPage, accessLogsPage] = await Promise.all([
      fetchSecurityLogsPage({ supabase, filters }),
      fetchAccessLogsPage({ supabase, filters }),
    ]);
    const allIps = [...accessLogsPage.items.map((r) => r.ip_address ?? ""), ...securityLogsPage.items.map((r) => r.ip_address ?? "")].filter(Boolean);
    const geoPoints = await resolveGeoPoints({ supabase: service, ips: allIps });
    return { ...base, geoPoints };
  }

  if (workspace === "benchmark") {
    const now = new Date().toISOString();
    const fromIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const benchmark = await getSecurityBenchmarkMetrics({ supabase: service as any, fromIso, toIso: now, threshold: 70 });
    return { ...base, benchmark };
  }

  const overview = await loadOverviewData(supabase as any, service as any);
  return { ...base, ...overview };
}
