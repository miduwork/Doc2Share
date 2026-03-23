import { createClient } from "@/lib/supabase/server";
import AdminUsersClient from "@/components/admin/users/AdminUsersClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { redirect } from "next/navigation";
import { requireUserManagerContext } from "@/lib/admin/guards";

export default async function AdminUsersPage() {
  const guard = await requireUserManagerContext();
  if (!guard.ok) redirect("/admin");

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const userIds = (profiles ?? []).map((p) => p.id);
  const { data: orders } = await supabase.from("orders").select("user_id, total_amount, status").in("user_id", userIds);
  const { data: devices } = await supabase.from("device_logs").select("user_id");

  const revenueByUser: Record<string, number> = {};
  for (const o of orders ?? []) {
    if ((o as { status: string }).status !== "completed") continue;
    const uid = (o as { user_id: string }).user_id;
    revenueByUser[uid] = (revenueByUser[uid] ?? 0) + Number((o as { total_amount: number }).total_amount);
  }
  const deviceCountByUser: Record<string, number> = {};
  for (const d of devices ?? []) {
    const uid = (d as { user_id: string }).user_id;
    deviceCountByUser[uid] = (deviceCountByUser[uid] ?? 0) + 1;
  }

  return (
    <div>
      <AdminPageHeader title="Khách hàng" description="Quản lý tài khoản và hỗ trợ người dùng" />
      <AdminUsersClient
          profiles={profiles ?? []}
          revenueByUser={revenueByUser}
          deviceCountByUser={deviceCountByUser}
        />
    </div>
  );
}
