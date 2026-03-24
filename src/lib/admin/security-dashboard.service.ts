import { computeHighRiskUsers, getWeeklyFalsePositiveStats } from "./security-risk.ts";
import { resolveGeoPoints } from "./ip-geo-resolver.ts";
import { syncSecurityIncidentsFromHighRiskUsers } from "./incident/security-incident-sync.ts";
import {
  fetchAccessLogsPage,
  fetchSecurityLogsPage,
  parseSecurityLogFilters,
  type SearchParamsLike,
} from "./security-log-query.ts";
import type {
  ActiveSessionRow,
  AdminSecurityDashboardResult,
  SecurityIncidentRow,
  SecurityLogFilters,
} from "./security-dashboard.types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

function toQueryString(params: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    query.set(key, value);
  }
  return query.toString();
}

function buildExportUrls(filters: SecurityLogFilters) {
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

type DashboardDependencies = {
  createUserClient: () => Promise<SupabaseClient>;
  createAdminClient: () => Promise<SupabaseClient> | SupabaseClient;
  computeHighRiskUsers: typeof computeHighRiskUsers;
  getWeeklyFalsePositiveStats: typeof getWeeklyFalsePositiveStats;
  resolveGeoPoints: typeof resolveGeoPoints;
  fetchSecurityLogsPage: typeof fetchSecurityLogsPage;
  fetchAccessLogsPage: typeof fetchAccessLogsPage;
};

const defaultDependencies: DashboardDependencies = {
  createUserClient: async () => {
    const mod = await import("../supabase/server.ts");
    return mod.createClient();
  },
  createAdminClient: async () => {
    const mod = await import("../supabase/service-role.ts");
    return mod.createServiceRoleClient();
  },
  computeHighRiskUsers,
  getWeeklyFalsePositiveStats,
  resolveGeoPoints,
  fetchSecurityLogsPage,
  fetchAccessLogsPage,
};

export async function getAdminSecurityDashboardData({
  searchParams,
  dependencies = defaultDependencies,
}: {
  searchParams?: SearchParamsLike;
  dependencies?: DashboardDependencies;
}): Promise<AdminSecurityDashboardResult> {
  const filters = parseSecurityLogFilters(searchParams);
  const supabase = await dependencies.createUserClient();
  const service = await dependencies.createAdminClient();

  const [securityLogsPage, accessLogsPage] = await Promise.all([
    dependencies.fetchSecurityLogsPage({ supabase, filters }),
    dependencies.fetchAccessLogsPage({ supabase, filters }),
  ]);

  const { data: activeSessions } = await supabase
    .from("active_sessions")
    .select("session_id, user_id, ip_address, user_agent, device_id, created_at")
    .order("created_at", { ascending: false });

  const [highRiskUsers, weeklyStats] = await Promise.all([
    dependencies.computeHighRiskUsers({ supabase: service, threshold: 70, limit: 20 }),
    dependencies.getWeeklyFalsePositiveStats({ supabase: service }),
  ]);

  const allIps = [
    ...accessLogsPage.items.map((row) => row.ip_address ?? ""),
    ...securityLogsPage.items.map((row) => row.ip_address ?? ""),
  ].filter(Boolean);
  const geoPoints = await dependencies.resolveGeoPoints({ supabase: service, ips: allIps });

  await syncSecurityIncidentsFromHighRiskUsers({ highRiskUsers, service });

  const { data: incidents } = await supabase
    .from("security_incidents")
    .select("id, correlation_id, user_id, risk_score, risk_band, review_status, detected_at, notes")
    .order("detected_at", { ascending: false })
    .limit(20);

  return {
    filters,
    data: {
      logs: securityLogsPage.items,
      highRiskUsers,
      accessLogs: accessLogsPage.items,
      activeSessions: (activeSessions ?? []) as ActiveSessionRow[],
      geoPoints,
      weeklyStats,
      incidents: (incidents ?? []) as SecurityIncidentRow[],
      accessPagination: {
        nextCursor: accessLogsPage.nextCursor,
        prevCursor: accessLogsPage.prevCursor,
      },
      securityPagination: {
        nextCursor: securityLogsPage.nextCursor,
        prevCursor: securityLogsPage.prevCursor,
      },
      exportUrls: buildExportUrls(filters),
    },
  };
}
