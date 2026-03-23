import { createClient } from "@/lib/supabase/server";
import AdminWebhooksClient from "@/components/admin/AdminWebhooksClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { redirect } from "next/navigation";
import { requireSuperAdminContext } from "@/lib/admin/guards";

export default async function AdminWebhooksPage() {
  const guard = await requireSuperAdminContext();
  if (!guard.ok) redirect("/admin");

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("access_logs")
    .select("id, action, status, metadata, created_at")
    .eq("action", "payment_webhook")
    .order("created_at", { ascending: false })
    .limit(50);
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, raw_webhook_log, updated_at")
    .not("raw_webhook_log", "is", null)
    .order("updated_at", { ascending: false })
    .limit(30);

  return (
    <div>
      <AdminPageHeader
        title="Webhooks"
        description="Nhật ký payment webhook (SePay/VietQR) và đơn hàng liên quan"
      />
      <AdminWebhooksClient
        paymentLogs={logs ?? []}
        ordersWithWebhook={orders ?? []}
      />
    </div>
  );
}
