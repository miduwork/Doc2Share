import { createClient } from "@/lib/supabase/server";
import { clampInt, pickSingle } from "@/lib/search-params";
import AdminDocumentsClient from "@/components/admin/documents/AdminDocumentsClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Activity, AlertTriangle } from "lucide-react";
import { requireDocumentManagerContext } from "@/lib/admin/guards";
import { getPresetStatusDefault } from "@/components/admin/documents/admin-documents.config";
import type { BulkHistoryRow } from "@/components/admin/documents/admin-documents.types";

type SearchParams = {
  q?: string | string[];
  status?: string | string[];
  subject_id?: string | string[];
  grade_id?: string | string[];
  exam_id?: string | string[];
  sort?: string | string[];
  page?: string | string[];
  page_size?: string | string[];
  preset?: string | string[];
  workspace?: string | string[];
};

export default async function AdminDocumentsPage({ searchParams }: { searchParams?: SearchParams }) {
  const guard = await requireDocumentManagerContext();
  if (!guard.ok) redirect("/admin");

  const supabase = await createClient();
  const preset = pickSingle(searchParams?.preset, "all");
  const workspaceRaw = pickSingle(searchParams?.workspace, "upload");
  const workspace = workspaceRaw === "manage" || workspaceRaw === "bulk-history" ? workspaceRaw : "upload";
  const q = pickSingle(searchParams?.q, "");
  const status = pickSingle(searchParams?.status, getPresetStatusDefault(preset));
  const subjectId = pickSingle(searchParams?.subject_id, "all");
  const gradeId = pickSingle(searchParams?.grade_id, "all");
  const examId = pickSingle(searchParams?.exam_id, "all");
  const sort = pickSingle(searchParams?.sort, "newest");
  const page = clampInt(pickSingle(searchParams?.page, "1"), 1, 100000, 1);
  const pageSize = clampInt(pickSingle(searchParams?.page_size, "20"), 10, 100, 20);

  let docsQuery = supabase
    .from("documents")
    .select(
      "id, title, description, price, preview_url, thumbnail_url, subject_id, grade_id, exam_id, is_downloadable, status, quality_score, data_quality_status, quality_flags, approval_status, created_at",
      { count: "planned" }
    );

  if (status === "deleted") {
    docsQuery = docsQuery.eq("status", "deleted");
  } else {
    docsQuery = docsQuery.neq("status", "deleted");
    if (status !== "all") docsQuery = docsQuery.eq("status", status);
  }

  if (q) docsQuery = docsQuery.ilike("title", `%${q}%`);
  if (subjectId !== "all") docsQuery = docsQuery.eq("subject_id", Number(subjectId));
  if (gradeId !== "all") docsQuery = docsQuery.eq("grade_id", Number(gradeId));
  if (examId !== "all") docsQuery = docsQuery.eq("exam_id", Number(examId));
  if (preset === "missing-thumbnail") docsQuery = docsQuery.is("thumbnail_url", null);
  if (preset === "missing-preview") docsQuery = docsQuery.is("preview_url", null);
  if (preset === "pending-approval") docsQuery = docsQuery.eq("approval_status", "pending");
  if (preset === "low-quality") docsQuery = docsQuery.in("data_quality_status", ["review", "needs_review"]);

  if (sort === "price-asc") docsQuery = docsQuery.order("price", { ascending: true });
  else if (sort === "price-desc") docsQuery = docsQuery.order("price", { ascending: false });
  else if (sort === "oldest") docsQuery = docsQuery.order("created_at", { ascending: true });
  else if (sort === "status") docsQuery = docsQuery.order("status", { ascending: true }).order("created_at", { ascending: false });
  else docsQuery = docsQuery.order("created_at", { ascending: false });

  docsQuery = docsQuery.range((page - 1) * pageSize, page * pageSize - 1);
  const { data: docs, count: docsCount } = await docsQuery;
  const docIds = (docs ?? []).map((d) => d.id);
  const { data: categories } = await supabase.from("categories").select("id, name, type");
  const { data: jobs } = docIds.length
    ? await supabase
        .from("document_processing_jobs")
        .select("document_id, status, attempts, last_error, updated_at")
        .in("document_id", docIds)
    : { data: [] as Array<{ document_id: string; status: string; attempts: number; last_error: string | null; updated_at: string }> };
  const total = docsCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [
    { count: pipelineQueued },
    { count: pipelineProcessing },
    { count: pipelineFailed },
  ] = await Promise.all([
    supabase.from("document_processing_jobs").select("id", { count: "exact", head: true }).eq("status", "queued"),
    supabase.from("document_processing_jobs").select("id", { count: "exact", head: true }).eq("status", "processing"),
    supabase.from("document_processing_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  const pipelineQueuedN = pipelineQueued ?? 0;
  const pipelineProcessingN = pipelineProcessing ?? 0;
  const pipelineFailedN = pipelineFailed ?? 0;
  const pipelineAlert = pipelineFailedN >= 10 || pipelineQueuedN + pipelineProcessingN >= 200;
  const BULK_PAGE_SIZE = 50;
  const { data: rawLogs } = await supabase
    .from("admin_bulk_operation_logs")
    .select("id, actor_id, operation, target_table, document_ids, affected_count, metadata, created_at")
    .order("created_at", { ascending: false })
    .range(0, BULK_PAGE_SIZE - 1);
  const actorIds = Array.from(
    new Set((rawLogs ?? []).map((row) => row.actor_id).filter((id): id is string => Boolean(id)))
  );
  const { data: profiles } =
    actorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as Array<{ id: string; full_name: string | null }> };
  const profileById = (profiles ?? []).reduce<Record<string, string>>((acc, profile) => {
    acc[profile.id] = profile.full_name ?? profile.id.slice(0, 8);
    return acc;
  }, {});
  const bulkLogs: BulkHistoryRow[] = (rawLogs ?? []).map((row) => ({
    id: row.id,
    actor_id: row.actor_id,
    actor_name: row.actor_id ? profileById[row.actor_id] ?? null : null,
    operation: row.operation,
    target_table: row.target_table,
    document_ids: Array.isArray(row.document_ids) ? row.document_ids : [],
    affected_count: row.affected_count ?? 0,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    created_at: row.created_at,
  }));

  return (
    <div>
      <AdminPageHeader
        title="Tài liệu"
        description="Tách biệt khu tải tài liệu mới và khu quản lý tài liệu để thao tác rõ ràng hơn"
      />
      {workspace !== "bulk-history" && (
        <div
          className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface-muted/50 px-2.5 py-1.5 text-xs"
          role="region"
          aria-label="Trạng thái pipeline tài liệu"
        >
          <span className="flex items-center gap-1.5 font-medium text-semantic-heading">
            <Activity className="h-3.5 w-3.5 text-muted" aria-hidden />
            Pipeline
          </span>
          <span className="text-muted">Chờ: <strong className="text-fg">{pipelineQueuedN}</strong></span>
          <span className="text-muted">Đang xử lý: <strong className="text-fg">{pipelineProcessingN}</strong></span>
          <span className={pipelineFailedN > 0 ? "flex items-center gap-1 text-amber-600 dark:text-amber-400" : "text-muted"}>
            {pipelineFailedN > 0 && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
            Lỗi: <strong>{pipelineFailedN}</strong>
          </span>
          {pipelineAlert && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Cần kiểm tra
            </span>
          )}
          <Link
            href="/admin/observability?preset=document-pipeline&source=db.document_lifecycle&event_type=all"
            className="ml-auto text-sm text-primary hover:underline"
          >
            Observability →
          </Link>
        </div>
      )}
      <div className="reveal-section">
        <AdminDocumentsClient
          initialDocs={docs ?? []}
          categories={categories ?? []}
          jobs={jobs ?? []}
          bulkLogs={bulkLogs}
          initialWorkspace={workspace}
          adminRole={guard.context.adminRole}
          filters={{
            q,
            status,
            subject_id: subjectId,
            grade_id: gradeId,
            exam_id: examId,
            sort,
            page,
            pageSize,
            total,
            totalPages,
            preset,
          }}
        />
      </div>
    </div>
  );
}
