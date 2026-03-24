import AdminSecurityClient from "@/components/admin/AdminSecurityClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { redirect } from "next/navigation";
import { requireSuperAdminContext } from "@/lib/admin/guards";
import { getSecurityWorkspaceData } from "@/lib/admin/security-workspace.service";
import type { SearchParamsLike } from "@/lib/admin/security-log-query";
import { parseSecurityWorkspace, SECURITY_WORKSPACES } from "@/lib/admin/security-workspace";
import Link from "next/link";

function getWorkspaceParam(params: SearchParamsLike | undefined): string | undefined {
  const raw = params?.workspace;
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsLike>;
}) {
  const guard = await requireSuperAdminContext();
  if (!guard.ok) redirect("/admin");
  const params = await searchParams;
  const workspace = parseSecurityWorkspace(getWorkspaceParam(params));
  const dashboard = await getSecurityWorkspaceData({ searchParams: params, workspace });
  const tabLabel: Record<(typeof SECURITY_WORKSPACES)[number], string> = {
    overview: "Tổng quan",
    logs: "Nhật ký",
    geo: "Địa lý IP",
    benchmark: "Benchmark",
  };

  return (
    <div>
      <AdminPageHeader
        title="An ninh"
        description="Bảo vệ bản quyền — nhật ký truy cập, phiên đăng nhập, thiết bị"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        {SECURITY_WORKSPACES.map((tab) => (
          <Link
            key={tab}
            href={`/admin/security?workspace=${tab}`}
            className={`rounded px-3 py-1 text-xs ${
              workspace === tab
                ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                : "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            {tabLabel[tab]}
          </Link>
        ))}
      </div>
      <AdminSecurityClient
        workspace={workspace}
        filters={dashboard.filters}
        logs={dashboard.logs}
        highRiskUsers={dashboard.highRiskUsers}
        accessLogs={dashboard.accessLogs}
        activeSessions={dashboard.activeSessions}
        geoPoints={dashboard.geoPoints}
        weeklyStats={dashboard.weeklyStats}
        incidents={dashboard.incidents}
        accessPagination={dashboard.accessPagination}
        securityPagination={dashboard.securityPagination}
        exportUrls={dashboard.exportUrls}
        benchmark={dashboard.benchmark}
      />
    </div>
  );
}
