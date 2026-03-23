import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireSuperAdminContext } from "@/lib/admin/guards";
import AdminOrdersClient from "@/components/admin/AdminOrdersClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

const ORDER_STATUSES = ["pending", "completed", "expired", "canceled"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

function parseStatus(value: string | string[] | undefined): OrderStatus | "all" {
  const s = typeof value === "string" ? value : value?.[0];
  if (s && ORDER_STATUSES.includes(s as OrderStatus)) return s as OrderStatus;
  return "all";
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: { status?: string | string[] };
}) {
  const guard = await requireSuperAdminContext();
  if (!guard.ok) redirect("/admin");

  const statusFilter = parseStatus(searchParams?.status);
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select("id, user_id, total_amount, status, external_id, created_at, updated_at", { count: "planned" })
    .order("created_at", { ascending: false })
    .limit(100);

  if (statusFilter !== "all") query = query.eq("status", statusFilter);

  const { data: orders, count } = await query;

  const userIds = Array.from(new Set((orders ?? []).map((o) => (o as { user_id: string }).user_id)));
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null }[] };

  const nameByUserId = new Map<string, string>(
    (profiles ?? []).map((p) => [p.id, p.full_name ?? p.id.slice(0, 8) + "…"])
  );

  const rows = (orders ?? []).map((o) => ({
    id: (o as { id: string }).id,
    user_id: (o as { user_id: string }).user_id,
    customerName: nameByUserId.get((o as { user_id: string }).user_id) ?? (o as { user_id: string }).user_id.slice(0, 8) + "…",
    total_amount: Number((o as { total_amount: number }).total_amount),
    status: (o as { status: string }).status,
    external_id: (o as { external_id: string | null }).external_id,
    created_at: (o as { created_at: string }).created_at,
    updated_at: (o as { updated_at: string }).updated_at,
  }));

  return (
    <div>
      <AdminPageHeader
        title="Đơn hàng"
        description="Danh sách đơn mua tài liệu — lọc theo trạng thái"
      />
      <div className="reveal-section premium-panel rounded-xl p-3 sm:p-4">
        <AdminOrdersClient
          orders={rows}
          totalCount={count ?? rows.length}
          currentStatus={statusFilter}
        />
      </div>
    </div>
  );
}
