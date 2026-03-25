import AdminUsersClient from "@/components/admin/users/AdminUsersClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { redirect } from "next/navigation";
import { requireUserManagerContext } from "@/lib/admin/guards";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  is_locked: boolean;
  lock_reason: string | null;
  risk_score: number | null;
  created_at: string;
};

function mapProfileRow(p: Record<string, unknown>): ProfileRow {
  return {
    id: String(p.id),
    full_name: (p.full_name as string | null) ?? null,
    role: String(p.role ?? "student"),
    is_active: Boolean(p.is_active ?? true),
    is_locked: Boolean(p.is_locked),
    lock_reason: (p.lock_reason as string | null) ?? null,
    risk_score: typeof p.risk_score === "number" ? p.risk_score : null,
    created_at: String(p.created_at ?? ""),
  };
}

export default async function AdminUsersPage() {
  const guard = await requireUserManagerContext();
  if (!guard.ok) redirect("/admin");

  const service = createServiceRoleClient();
  const { data: rawProfiles, error: profilesError } = await service
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const profiles: ProfileRow[] = (rawProfiles ?? []).map((row) => mapProfileRow(row as Record<string, unknown>));
  const userIds = profiles.map((p) => p.id);
  const { data: orders } =
    userIds.length > 0
      ? await service.from("orders").select("user_id, total_amount, status").in("user_id", userIds)
      : { data: [] as { user_id: string; total_amount: number; status: string }[] };
  const { data: devices } = await service.from("device_logs").select("user_id");

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
      <AdminPageHeader
        title="Khách hàng"
        description="Theo dữ liệu bảng profiles (đồng bộ từ Auth khi đăng ký). Nếu thiếu dòng profiles, chạy SQL backfill trong Supabase."
      />
      <AdminUsersClient
        profiles={profiles}
        revenueByUser={revenueByUser}
        deviceCountByUser={deviceCountByUser}
        profilesLoadError={profilesError?.message ?? null}
      />
    </div>
  );
}
