import { createClient } from "@/lib/supabase/server";
import { DollarSign, ShoppingCart, FileText, Clock } from "lucide-react";
import RevenueChart from "@/components/admin/RevenueChart";
import OverviewRangeSelect from "@/components/admin/OverviewRangeSelect";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { redirect } from "next/navigation";
import { requireSuperAdminContext } from "@/lib/admin/guards";
import Link from "next/link";

const FEE_RATE = 0.02;
const RANGE_OPTIONS = [7, 30, 90] as const;
export type OverviewRange = (typeof RANGE_OPTIONS)[number];

function parseRange(value: string | string[] | undefined): OverviewRange {
  const v = typeof value === "string" ? value : value?.[0];
  const n = v ? parseInt(v, 10) : NaN;
  return RANGE_OPTIONS.includes(n as OverviewRange) ? (n as OverviewRange) : 30;
}

function lastNAndPrevN(
  orders: { created_at: string; total_amount: number }[],
  days: number
) {
  const today = new Date().toISOString().slice(0, 10);
  const dayNAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const day2NAgo = new Date(Date.now() - 2 * days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let revenueLast = 0;
  let ordersLast = 0;
  let revenuePrev = 0;
  let ordersPrev = 0;
  for (const o of orders) {
    const date = o.created_at.slice(0, 10);
    const amt = Number(o.total_amount);
    if (date >= dayNAgo && date <= today) {
      revenueLast += amt;
      ordersLast += 1;
    } else if (date >= day2NAgo && date < dayNAgo) {
      revenuePrev += amt;
      ordersPrev += 1;
    }
  }
  const aovLast = ordersLast > 0 ? revenueLast / ordersLast : 0;
  const netLast = revenueLast * (1 - FEE_RATE);
  const netPrev = revenuePrev * (1 - FEE_RATE);
  const pctRevenue = revenuePrev > 0 ? ((revenueLast - revenuePrev) / revenuePrev) * 100 : null;
  const pctOrders = ordersPrev > 0 ? ((ordersLast - ordersPrev) / ordersPrev) * 100 : null;
  return {
    revenueLast,
    ordersLast,
    aovLast,
    netLast,
    netPrev,
    pctRevenue,
    pctOrders,
  };
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams?: { range?: string | string[] };
}) {
  const guard = await requireSuperAdminContext();
  if (!guard.ok) redirect("/admin");

  const range = parseRange(searchParams?.range);

  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, total_amount, status, created_at")
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  const { count: pendingCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const stats = lastNAndPrevN((orders ?? []) as { created_at: string; total_amount: number }[], range);
  const netRevenue = stats.netLast;
  const newOrdersCount = stats.ordersLast;
  const aov = stats.aovLast;

  const byDay: Record<string, { revenue: number; orders: number }> = {};
  for (const o of orders ?? []) {
    const date = (o as { created_at: string }).created_at.slice(0, 10);
    if (!byDay[date]) byDay[date] = { revenue: 0, orders: 0 };
    byDay[date].revenue += Number((o as { total_amount: number }).total_amount);
    byDay[date].orders += 1;
  }
  const chartData: { date: string; revenue: number; orders: number }[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    chartData.push({
      date,
      revenue: byDay[date]?.revenue ?? 0,
      orders: byDay[date]?.orders ?? 0,
    });
  }

  const { data: topRows } = await supabase.rpc("get_top_documents_by_sales", {
    p_days: range,
    p_limit: 10,
  });
  type TopDocRow = { title: string; count: number; revenue: number };
  const topList: TopDocRow[] = (topRows ?? []).map((row: { document_id: string; title: string | null; quantity_sold: number; revenue: number }) => ({
    title: row.title ?? row.document_id,
    count: Number(row.quantity_sold ?? 0),
    revenue: Number(row.revenue ?? 0),
  }));

  const rangeLabel = `${range} ngày`;

  return (
    <div>
      <AdminPageHeader
        title="Tổng quan"
        description="Sức khỏe kinh doanh trong 30 giây"
        actions={<OverviewRangeSelect currentRange={range} />}
      />
      <div className="reveal-section premium-panel rounded-xl p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/orders?status=completed" className="premium-card block p-4 transition hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-800">
            <div className="flex items-center gap-1.5 text-muted">
              <DollarSign className="h-4 w-4" aria-hidden />
              <span>Doanh thu thực ({rangeLabel})</span>
            </div>
            <p className="mt-1.5 text-xl font-bold text-semantic-heading">
              {Math.round(netRevenue).toLocaleString("vi-VN")} ₫
            </p>
            <p className="text-xs text-muted">
              {stats.pctRevenue != null ? (
                <span className={stats.pctRevenue >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {stats.pctRevenue >= 0 ? "↑" : "↓"} {Math.abs(stats.pctRevenue).toFixed(1)}% so với {rangeLabel} trước
                </span>
              ) : (
                `Phí ~2% · So với ${rangeLabel} trước`
              )}
            </p>
          </Link>
          <Link href="/admin/orders?status=completed" className="premium-card block p-4 transition hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-800">
            <div className="flex items-center gap-1.5 text-muted">
              <ShoppingCart className="h-4 w-4" aria-hidden />
              <span>Đơn hoàn thành ({rangeLabel})</span>
            </div>
            <p className="mt-1.5 text-xl font-bold text-semantic-heading">{newOrdersCount}</p>
            <p className="text-xs text-muted">
              {stats.pctOrders != null ? (
                <span className={stats.pctOrders >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {stats.pctOrders >= 0 ? "↑" : "↓"} {Math.abs(stats.pctOrders).toFixed(1)}% so với {rangeLabel} trước
                </span>
              ) : (
                `So với ${rangeLabel} trước`
              )}
            </p>
          </Link>
          <div className="premium-card p-4">
            <div className="flex items-center gap-1.5 text-muted">
              <FileText className="h-4 w-4" aria-hidden />
              <span>AOV ({rangeLabel})</span>
            </div>
            <p className="mt-1.5 text-xl font-bold text-semantic-heading">
              {Math.round(aov).toLocaleString("vi-VN")} ₫
            </p>
            <p className="text-xs text-muted">Giá trị đơn trung bình</p>
          </div>
          {(pendingCount ?? 0) > 0 ? (
            <Link href="/admin/orders?status=pending" className="premium-card block p-4 transition hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-800">
              <div className="flex items-center gap-1.5 text-muted">
                <Clock className="h-4 w-4" aria-hidden />
                <span>Đơn đang chờ</span>
              </div>
              <p className="mt-1.5 text-xl font-bold text-semantic-heading">{pendingCount ?? 0}</p>
              <p className="text-xs text-muted underline decoration-primary-500">Cần xử lý thanh toán</p>
            </Link>
          ) : (
            <div className="premium-card p-4">
              <div className="flex items-center gap-1.5 text-muted">
                <Clock className="h-4 w-4" aria-hidden />
                <span>Đơn đang chờ</span>
              </div>
              <p className="mt-1.5 text-xl font-bold text-semantic-heading">0</p>
              <p className="text-xs text-muted">Không có đơn chờ</p>
            </div>
          )}
        </div>

        <section className="reveal-section reveal-delay-1 mt-4" aria-labelledby="chart-heading">
          <h2 id="chart-heading" className="text-sm font-semibold text-semantic-heading">
            Biểu đồ doanh thu {rangeLabel} gần nhất
          </h2>
          <p className="mt-0.5 text-xs text-muted">Doanh thu theo ngày</p>
          <div className="premium-card mt-2 rounded-xl p-3">
            <RevenueChart data={chartData} />
          </div>
        </section>

        <section className="reveal-section reveal-delay-2 mt-4" aria-labelledby="top-docs-heading">
          <h2 id="top-docs-heading" className="text-sm font-semibold text-semantic-heading">
            Top tài liệu bán chạy ({rangeLabel})
          </h2>
          <p className="mt-0.5 text-xs text-muted">Đơn đã thanh toán</p>
          <div className="mt-2 overflow-hidden rounded-xl border border-line bg-surface">
            <table className="w-full text-xs" role="grid">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-semantic-heading">Tài liệu</th>
                  <th className="px-3 py-2 text-right font-medium text-semantic-heading">SL bán</th>
                  <th className="px-3 py-2 text-right font-medium text-semantic-heading">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {topList.map((row, i) => (
                  <tr key={row.title ?? i} className="hover:bg-muted/30">
                    <td className="max-w-[240px] truncate px-3 py-2 font-medium text-semantic-heading" title={row.title}>{row.title}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.revenue.toLocaleString("vi-VN")} ₫</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topList.length === 0 && (
              <p className="py-6 text-center text-xs text-muted" role="status">Chưa có dữ liệu đơn hoàn thành.</p>
            )}
          </div>
        </section>

        <p className="mt-4 text-right text-[11px] text-muted" role="status">
          Dữ liệu cập nhật lúc {new Date().toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}
