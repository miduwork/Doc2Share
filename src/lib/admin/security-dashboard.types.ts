import type { AccessLogRow, SecurityLogFilters, SecurityLogRow } from "./security-log-query.ts";
import type { GeoPoint } from "./ip-geo-resolver.ts";
import type { HighRiskUser, RiskBenchmarkStats, WeeklyFalsePositiveStats } from "./security-risk.ts";

export type {
  AccessLogRow,
  SecurityLogFilters,
  SecurityLogRow,
  GeoPoint,
  HighRiskUser,
  WeeklyFalsePositiveStats,
  RiskBenchmarkStats,
};

export type ActiveSessionRow = {
  session_id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_id: string | null;
  created_at: string;
};

export type SecurityIncidentRow = {
  id: string;
  correlation_id: string | null;
  user_id: string | null;
  risk_score: number;
  risk_band: string;
  review_status: "pending" | "confirmed_risk" | "false_positive";
  detected_at: string;
  notes: string | null;
};

export type CursorPagination = {
  nextCursor: string | null;
  prevCursor: string | null;
};

export type SecurityExportUrls = {
  access: string;
  security: string;
};

export type AdminSecurityDashboardData = {
  logs: SecurityLogRow[];
  highRiskUsers: HighRiskUser[];
  accessLogs: AccessLogRow[];
  activeSessions: ActiveSessionRow[];
  geoPoints: GeoPoint[];
  weeklyStats: WeeklyFalsePositiveStats;
  incidents: SecurityIncidentRow[];
  accessPagination: CursorPagination;
  securityPagination: CursorPagination;
  exportUrls: SecurityExportUrls;
};

export type AdminSecurityDashboardResult = {
  filters: SecurityLogFilters;
  data: AdminSecurityDashboardData;
};
