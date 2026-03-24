"use client";

import type { BulkHistoryRow } from "./admin-documents.types";

type Props = {
  logs: BulkHistoryRow[];
  pageSize: number;
};

export default function BulkHistoryPanel({ logs, pageSize }: Props) {
  return (
    <section className="space-y-3" aria-label="Khu lịch sử thao tác bulk">
      <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-2.5 text-xs text-primary-800 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-200">
        <strong>Nhật ký bulk:</strong> theo dõi thao tác hàng loạt theo thời gian, người thực hiện, số lượng và trạng thái đích.
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-xs" role="grid">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-semantic-heading">Thời gian</th>
              <th className="px-3 py-2 text-left font-medium text-semantic-heading">Người thực hiện</th>
              <th className="px-3 py-2 text-left font-medium text-semantic-heading">Thao tác</th>
              <th className="px-3 py-2 text-right font-medium text-semantic-heading">Số lượng</th>
              <th className="px-3 py-2 text-left font-medium text-semantic-heading">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted">
                  Chưa có bản ghi thao tác bulk.
                </td>
              </tr>
            ) : (
              logs.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 text-fg">
                    {new Date(row.created_at).toLocaleString("vi-VN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-2 text-fg">
                    {row.actor_name ?? (row.actor_id ? `${row.actor_id.slice(0, 8)}...` : "—")}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-semantic-heading">{row.operation}</span>
                    {row.target_table !== "documents" && (
                      <span className="ml-1 text-muted">({row.target_table})</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.affected_count}</td>
                  <td className="px-3 py-2 text-muted">
                    {row.document_ids?.length > 0 ? (
                      <span title={row.document_ids.join(", ")}>
                        {row.document_ids.length} tài liệu
                        {typeof row.metadata?.target_status === "string" &&
                          ` -> ${row.metadata.target_status}`}
                      </span>
                    ) : (
                      typeof row.metadata?.target_status === "string" && row.metadata.target_status
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {logs.length >= pageSize && (
        <p className="text-xs text-muted">Hiển thị {pageSize} bản ghi gần nhất.</p>
      )}
    </section>
  );
}
