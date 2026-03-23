import Link from "next/link";
import { Webhook, Tag, Megaphone, Activity } from "lucide-react";
import { redirect } from "next/navigation";
import { requireSuperAdminContext } from "@/lib/admin/guards";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

export default async function AdminToolsPage() {
  const guard = await requireSuperAdminContext();
  if (!guard.ok) redirect("/admin");

  return (
    <div>
      <AdminPageHeader
        title="Công cụ"
        description="Webhook, mã giảm giá, observability — truy cập nhanh"
      />
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/admin/webhooks"
            className="premium-card premium-card-hover flex items-center gap-3 rounded-xl p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Webhook className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-semantic-heading">Webhook logs</h2>
              <p className="text-xs text-slate-500">SePay/VietQR, thanh toán treo</p>
            </div>
          </Link>
          <Link
            href="/admin/observability"
            className="premium-card premium-card-hover flex items-center gap-3 rounded-xl p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
              <Activity className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-semantic-heading">Observability</h2>
              <p className="text-xs text-slate-500">Metrics, alerts, maintenance</p>
            </div>
          </Link>
          <Link
            href="/admin/coupons"
            className="premium-card premium-card-hover flex items-center gap-3 rounded-xl p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-edu-green/20 text-edu-green">
              <Tag className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-semantic-heading">Mã giảm giá</h2>
              <p className="text-xs text-slate-500">Chiến dịch, nhóm đối tượng</p>
            </div>
          </Link>
          <div className="premium-panel flex items-center gap-3 rounded-xl p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-500 dark:bg-slate-700">
              <Megaphone className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-semantic-heading">Gửi thông báo</h2>
              <p className="text-xs text-slate-500">Email/push — tích hợp sau</p>
            </div>
          </div>
        </div>
    </div>
  );
}
