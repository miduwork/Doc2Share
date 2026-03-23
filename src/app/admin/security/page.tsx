import { createClient } from "@/lib/supabase/server";
import AdminSecurityClient from "@/components/admin/AdminSecurityClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { redirect } from "next/navigation";
import { requireSuperAdminContext } from "@/lib/admin/guards";

export default async function AdminSecurityPage() {
  const guard = await requireSuperAdminContext();
  if (!guard.ok) redirect("/admin");

  const supabase = await createClient();
  const { data: securityLogs } = await supabase
    .from("security_logs")
    .select("id, user_id, event_type, severity, ip_address, user_agent, device_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const { data: accessLogs } = await supabase
    .from("access_logs")
    .select("id, user_id, document_id, action, status, ip_address, device_id, created_at")
    .eq("action", "get_secure_link")
    .order("created_at", { ascending: false })
    .limit(100);
  const { data: activeSessions } = await supabase
    .from("active_sessions")
    .select("session_id, user_id, ip_address, user_agent, device_id, created_at")
    .order("created_at", { ascending: false });
  const { data: deviceCounts } = await supabase.from("device_logs").select("user_id");
  const countByUser: Record<string, number> = {};
  for (const d of deviceCounts ?? []) {
    const uid = (d as { user_id: string }).user_id;
    countByUser[uid] = (countByUser[uid] ?? 0) + 1;
  }
  const highRiskUserIds = Object.entries(countByUser).filter(([, c]) => c > 2).map(([u]) => u);

  return (
    <div>
      <AdminPageHeader
        title="An ninh"
        description="Bảo vệ bản quyền — nhật ký truy cập, phiên đăng nhập, thiết bị"
      />
      <AdminSecurityClient
          logs={securityLogs ?? []}
          highRiskUserIds={highRiskUserIds}
          accessLogs={accessLogs ?? []}
          activeSessions={activeSessions ?? []}
        />
    </div>
  );
}
