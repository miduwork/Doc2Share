import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { requireDocumentManagerContext } from "@/lib/admin/guards";

const PAGE_SIZE = 50;

export default async function AdminBulkHistoryPage() {
  const guard = await requireDocumentManagerContext();
  if (!guard.ok) redirect("/admin");

  const supabase = await createClient();
  const { data: logs, error } = await supabase
    .from("admin_bulk_operation_logs")
    .select(
      "id, actor_id, operation, target_table, document_ids, affected_count, metadata, created_at"
    )
    .order("created_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (error) {
    return (
      <div className="section-container py-6">
        <p className="text-red-600 dark:text-red-400" role="alert">
          Không tải được lịch sử: {error.message}
        </p>
      </div>
    );
  }

  const rows = (logs ?? []) as Array<{
    id: string;
    actor_id: string | null;
    operation: string;
    target_table: string;
    document_ids: string[];
    affected_count: number;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;

  const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[];
  const { data: profiles } =
    actorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] };
  const profileById = (profiles ?? []).reduce<Record<string, string>>((acc, p) => {
    acc[p.id] = p.full_name ?? p.id.slice(0, 8);
    return acc;
  }, {});

  return (
    <div>
      <AdminPageHeader
        title="Lịch sử bulk"
        description="Publish, archive, xóa mềm, retry hàng loạt — chỉ super_admin, content_manager xem được"
        actions={
          <Link
            href="/admin/documents"
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            ← Tài liệu
          </Link>
        }
      />
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted">
                  Chưa có bản ghi thao tác bulk.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 text-fg">
                    {new Date(row.created_at).toLocaleString("vi-VN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-2 text-fg">
                    {row.actor_id ? profileById[row.actor_id] ?? row.actor_id.slice(0, 8) + "…" : "—"}
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
                          ` → ${row.metadata.target_status}`}
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
      {rows.length >= PAGE_SIZE && (
        <p className="mt-3 text-xs text-muted">Hiển thị {PAGE_SIZE} bản ghi gần nhất.</p>
      )}
    </div>
  );
}

