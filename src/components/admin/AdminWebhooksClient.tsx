"use client";

import { useState } from "react";
import { formatDate } from "@/lib/date";

interface LogRow {
  id: string;
  action: string;
  status: string;
  metadata: unknown;
  created_at: string;
}

interface OrderRow {
  id: string;
  status: string;
  raw_webhook_log: unknown;
  updated_at: string;
}

export default function AdminWebhooksClient({
  paymentLogs,
  ordersWithWebhook,
}: {
  paymentLogs: LogRow[];
  ordersWithWebhook: OrderRow[];
}) {
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  return (
    <div className="mt-4 space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-semantic-heading">Đơn hàng có webhook log</h2>
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Đơn hàng</th>
                <th className="px-3 py-1.5 text-left font-medium">Trạng thái</th>
                <th className="px-3 py-1.5 text-left font-medium">Cập nhật</th>
                <th className="w-16 px-2 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {ordersWithWebhook.map((o) => (
                <>
                  <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-1.5 font-mono">{o.id.slice(0, 8)}...</td>
                    <td className="px-3 py-1.5">{o.status}</td>
                    <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{formatDate(o.updated_at)}</td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => setOpenOrderId(openOrderId === o.id ? null : o.id)}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        {openOrderId === o.id ? "Thu gọn" : "Xem log"}
                      </button>
                    </td>
                  </tr>
                  {openOrderId === o.id && (
                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                      <td colSpan={4} className="px-3 py-2">
                        <pre className="max-h-40 overflow-auto rounded bg-slate-100 p-2 text-[11px] dark:bg-slate-900">
                          {JSON.stringify(o.raw_webhook_log, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {ordersWithWebhook.length === 0 && (
            <p className="py-5 text-center text-xs text-slate-500">Chưa có đơn nào có webhook log.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-semantic-heading">Access logs (payment_webhook)</h2>
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Thời gian</th>
                <th className="px-3 py-1.5 text-left font-medium">Trạng thái</th>
                <th className="px-3 py-1.5 text-left font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {paymentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{formatDate(log.created_at)}</td>
                  <td className="px-3 py-1.5">{log.status}</td>
                  <td className="max-w-[200px] truncate px-3 py-1.5 font-mono" title={JSON.stringify(log.metadata)}>{JSON.stringify(log.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {paymentLogs.length === 0 && <p className="py-5 text-center text-xs text-slate-500">Chưa có log.</p>}
        </div>
      </section>
    </div>
  );
}
