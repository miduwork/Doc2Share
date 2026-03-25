import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireDocumentManagerContext } from "@/lib/admin/guards";
import RollbackVersionButton from "@/components/admin/documents/RollbackVersionButton";
import { slugify } from "@/lib/seo";

type SearchParams = {
  version_id?: string;
  audit_action?: string;
  audit_actor?: string;
  audit_from?: string;
  audit_to?: string;
  audit_page?: string;
  audit_page_size?: string;
};

export default async function AdminDocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const guard = await requireDocumentManagerContext();
  if (!guard.ok) redirect("/admin");

  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select(
      "id, title, description, price, file_path, preview_url, thumbnail_url, subject_id, grade_id, exam_id, is_downloadable, status, approval_status, quality_score, data_quality_status, quality_flags, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (docErr || !doc) return notFound();

  const categoryIds = [doc.subject_id, doc.grade_id, doc.exam_id].filter(Boolean) as number[];
  const { data: categories } = categoryIds.length
    ? await supabase.from("categories").select("id, name, type, position").in("id", categoryIds)
    : { data: [] as Array<{ id: number; name: string; type: string }> };

  const { data: versionsRaw } = await supabase
    .from("document_versions")
    .select("id, version_no, reason, created_by, created_at, snapshot")
    .eq("document_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const versions = (versionsRaw ?? []).map((v) => {
    const s = (v as { snapshot?: Record<string, unknown> }).snapshot ?? {};
    return {
      id: (v as { id: string }).id,
      version_no: (v as { version_no: number }).version_no,
      reason: (v as { reason: string | null }).reason,
      created_by: (v as { created_by: string | null }).created_by,
      created_at: (v as { created_at: string }).created_at,
      title: (s.title as string) ?? null,
      description: (s.description as string) ?? null,
      price: s.price != null ? Number(s.price) : null,
      file_path: (s.file_path as string) ?? null,
      preview_url: (s.preview_url as string) ?? null,
      thumbnail_url: (s.thumbnail_url as string) ?? null,
      subject_id: s.subject_id != null && s.subject_id !== "" ? Number(s.subject_id) : null,
      grade_id: s.grade_id != null && s.grade_id !== "" ? Number(s.grade_id) : null,
      exam_id: s.exam_id != null && s.exam_id !== "" ? Number(s.exam_id) : null,
      is_downloadable: Boolean(s.is_downloadable),
      status: (s.status as string) ?? null,
    };
  });

  const parsedPage = Number.parseInt(sp.audit_page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const parsedPageSize = Number.parseInt(sp.audit_page_size ?? "20", 10);
  const pageSize = Number.isFinite(parsedPageSize) ? Math.min(Math.max(parsedPageSize, 10), 100) : 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let auditsQuery = supabase
    .from("document_audit_logs")
    .select("id, action, actor_id, metadata, created_at", { count: "planned" })
    .eq("document_id", id);
  if (sp.audit_action && sp.audit_action !== "all") {
    auditsQuery = auditsQuery.eq("action", sp.audit_action);
  }
  if (sp.audit_actor && sp.audit_actor !== "all") {
    auditsQuery = auditsQuery.eq("actor_id", sp.audit_actor);
  }
  if (sp.audit_from) {
    auditsQuery = auditsQuery.gte("created_at", `${sp.audit_from}T00:00:00.000Z`);
  }
  if (sp.audit_to) {
    auditsQuery = auditsQuery.lte("created_at", `${sp.audit_to}T23:59:59.999Z`);
  }

  let auditFacetsQuery = supabase
    .from("document_audit_logs")
    .select("action, actor_id")
    .eq("document_id", id);
  if (sp.audit_from) {
    auditFacetsQuery = auditFacetsQuery.gte("created_at", `${sp.audit_from}T00:00:00.000Z`);
  }
  if (sp.audit_to) {
    auditFacetsQuery = auditFacetsQuery.lte("created_at", `${sp.audit_to}T23:59:59.999Z`);
  }

  const [{ data: audits, count: auditTotal }, { data: auditFacets }] = await Promise.all([
    auditsQuery.order("created_at", { ascending: false }).range(from, to),
    auditFacetsQuery.limit(200),
  ]);

  const actorIds = Array.from(
    new Set([
      ...(versions ?? []).map((v) => v.created_by).filter(Boolean),
      ...(audits ?? []).map((a) => a.actor_id).filter(Boolean),
    ] as string[])
  );
  const { data: actorProfiles } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };
  const actorNameById = new Map((actorProfiles ?? []).map((p) => [p.id, (p.full_name?.trim() || p.id) as string]));

  const totalAuditRows = auditTotal ?? 0;
  const auditTotalPages = Math.max(1, Math.ceil(totalAuditRows / pageSize));
  const versionParam = sp.version_id ?? versions?.[0]?.id;
  const selectedVersion = (versions ?? []).find((v) => v.id === versionParam) ?? versions?.[0] ?? null;
  const isSuperAdmin = guard.context.adminRole === "super_admin";

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));
  const actionOptions = Array.from(new Set((auditFacets ?? []).map((x) => x.action).filter(Boolean)));
  const actorOptions = Array.from(new Set((auditFacets ?? []).map((x) => x.actor_id).filter(Boolean)));
  const compareRows = selectedVersion ? buildDocumentDiffRows(doc, selectedVersion, categoryById) : [];

  const baseParams = new URLSearchParams();
  if (sp.audit_action) baseParams.set("audit_action", sp.audit_action);
  if (sp.audit_actor) baseParams.set("audit_actor", sp.audit_actor);
  if (sp.audit_from) baseParams.set("audit_from", sp.audit_from);
  if (sp.audit_to) baseParams.set("audit_to", sp.audit_to);
  if (sp.audit_page_size) baseParams.set("audit_page_size", sp.audit_page_size);
  if (versionParam) baseParams.set("version_id", versionParam);

  const prevAuditHref = (() => {
    const p = new URLSearchParams(baseParams);
    p.set("audit_page", String(Math.max(1, page - 1)));
    return `/admin/documents/${id}?${p.toString()}`;
  })();
  const nextAuditHref = (() => {
    const p = new URLSearchParams(baseParams);
    p.set("audit_page", String(Math.min(auditTotalPages, page + 1)));
    return `/admin/documents/${id}?${p.toString()}`;
  })();

  return (
    <div className="section-container py-6 sm:py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-semantic-heading">Chi tiết tài liệu</h1>
          <p className="text-muted">ID: {doc.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/cua-hang/${doc.id}/${slugify(doc.title ?? doc.id)}`} className="btn-secondary" target="_blank" rel="noopener noreferrer">
            Xem trang bán
          </Link>
          <Link href="/admin/documents" className="btn-secondary">
            Quay lại danh sách
          </Link>
        </div>
      </div>

      <section className="premium-panel p-5">
        <h2 className="text-lg font-semibold text-semantic-heading">Metadata</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
          <Info label="Tiêu đề" value={doc.title} />
          <Info label="Giá" value={String(doc.price)} />
          <Info label="Trạng thái" value={doc.status ?? "ready"} />
          <Info label="Approval" value={doc.approval_status ?? "draft"} />
          <Info label="Quality" value={`${doc.data_quality_status ?? "needs_review"} (${doc.quality_score ?? 0})`} />
          <Info label="Cho tải/in" value={doc.is_downloadable ? "Có" : "Không"} />
          <Info label="Môn học" value={doc.subject_id ? categoryById.get(doc.subject_id)?.name ?? String(doc.subject_id) : "—"} />
          <Info label="Khối lớp" value={doc.grade_id ? categoryById.get(doc.grade_id)?.name ?? String(doc.grade_id) : "—"} />
          <Info label="Kỳ thi" value={doc.exam_id ? categoryById.get(doc.exam_id)?.name ?? String(doc.exam_id) : "—"} />
          <Info label="Tạo lúc" value={new Date(doc.created_at).toLocaleString("vi-VN")} />
          <Info label="Cập nhật" value={new Date(doc.updated_at).toLocaleString("vi-VN")} />
          <Info label="Quality flags" value={Array.isArray(doc.quality_flags) ? doc.quality_flags.join(", ") || "—" : "—"} />
        </div>
        <div className="mt-4 text-sm">
          <p className="font-medium text-slate-700 dark:text-slate-300">Mô tả</p>
          <p className="mt-1 text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{doc.description ?? "—"}</p>
        </div>
      </section>

      <section className="premium-panel p-5">
        <h2 className="text-lg font-semibold text-semantic-heading">Versions</h2>
        <form method="get" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="audit_action" value={sp.audit_action ?? "all"} />
          <input type="hidden" name="audit_actor" value={sp.audit_actor ?? "all"} />
          <input type="hidden" name="audit_from" value={sp.audit_from ?? ""} />
          <input type="hidden" name="audit_to" value={sp.audit_to ?? ""} />
          <input type="hidden" name="audit_page" value={String(page)} />
          <input type="hidden" name="audit_page_size" value={String(pageSize)} />
          <label className="text-sm text-slate-600 dark:text-slate-300">
            Chọn version để so sánh
            <select name="version_id" defaultValue={versionParam ?? ""} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 dark:bg-slate-900">
              {(versions ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_no} - {new Date(v.created_at).toLocaleString("vi-VN")}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button className="btn-secondary" type="submit">
              So sánh với hiện tại
            </button>
          </div>
        </form>
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left">Version</th>
                <th className="px-3 py-2 text-left">Reason</th>
                <th className="px-3 py-2 text-left">Actor</th>
                <th className="px-3 py-2 text-left">Created</th>
                {isSuperAdmin && <th className="px-3 py-2 text-left">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {(versions ?? []).map((v) => (
                <tr key={v.id}>
                  <td className="px-3 py-2">v{v.version_no}</td>
                  <td className="px-3 py-2">{v.reason ?? "—"}</td>
                  <td className="px-3 py-2">{v.created_by ? (actorNameById.get(v.created_by) ?? `${v.created_by.slice(0, 8)}...`) : "system"}</td>
                  <td className="px-3 py-2">{new Date(v.created_at).toLocaleString("vi-VN")}</td>
                  {isSuperAdmin && (
                    <td className="px-3 py-2">
                      <RollbackVersionButton documentId={id} versionId={v.id} versionNo={v.version_no} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {(versions ?? []).length === 0 && <p className="p-4 text-sm text-slate-500">Chưa có version.</p>}
        </div>
        <div className="mt-4">
          <h3 className="text-base font-semibold text-semantic-heading">Diff chi tiết (hiện tại vs version chọn)</h3>
          {selectedVersion ? (
            <div className="mt-2 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Field</th>
                    <th className="px-3 py-2 text-left">Hiện tại</th>
                    <th className="px-3 py-2 text-left">Version v{selectedVersion.version_no}</th>
                    <th className="px-3 py-2 text-left">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {compareRows.map((row) => (
                    <tr key={row.field}>
                      <td className="px-3 py-2">{row.label}</td>
                      <td className="px-3 py-2 font-mono text-xs break-all">{row.current}</td>
                      <td className="px-3 py-2 font-mono text-xs break-all">{row.selected}</td>
                      <td className={`px-3 py-2 ${row.changed ? "text-amber-600 dark:text-amber-400 font-medium" : "text-slate-500"}`}>
                        {row.changed ? "Changed" : "Same"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Chưa có version để so sánh.</p>
          )}
        </div>
      </section>

      <section className="premium-panel p-5">
        <h2 className="text-lg font-semibold text-semantic-heading">Audit log</h2>
        <form method="get" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input type="hidden" name="version_id" value={versionParam ?? ""} />
          <label className="text-sm text-slate-600 dark:text-slate-300">
            Action
            <select name="audit_action" defaultValue={sp.audit_action ?? "all"} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 dark:bg-slate-900">
              <option value="all">All</option>
              {actionOptions.map((action) => (
                <option key={action} value={action ?? ""}>
                  {action}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600 dark:text-slate-300">
            Actor
            <select name="audit_actor" defaultValue={sp.audit_actor ?? "all"} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 dark:bg-slate-900">
              <option value="all">All</option>
              {actorOptions.map((actor) => (
                <option key={actor} value={actor ?? ""}>
                  {actor ? (actorNameById.get(actor) ?? actor) : "—"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600 dark:text-slate-300">
            From
            <input type="date" name="audit_from" defaultValue={sp.audit_from ?? ""} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 dark:bg-slate-900" />
          </label>
          <label className="text-sm text-slate-600 dark:text-slate-300">
            To
            <input type="date" name="audit_to" defaultValue={sp.audit_to ?? ""} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 dark:bg-slate-900" />
          </label>
          <label className="text-sm text-slate-600 dark:text-slate-300">
            Page size
            <select name="audit_page_size" defaultValue={String(pageSize)} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 dark:bg-slate-900">
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <input type="hidden" name="audit_page" value="1" />
            <button className="btn-secondary" type="submit">
              Lọc
            </button>
          </div>
        </form>
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Actor</th>
                <th className="px-3 py-2 text-left">Metadata</th>
                <th className="px-3 py-2 text-left">At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {(audits ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2">{a.action}</td>
                  <td className="px-3 py-2">{a.actor_id ? (actorNameById.get(a.actor_id) ?? `${a.actor_id.slice(0, 8)}...`) : "system"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{JSON.stringify(a.metadata ?? {})}</td>
                  <td className="px-3 py-2">{new Date(a.created_at).toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(audits ?? []).length === 0 && <p className="p-4 text-sm text-slate-500">Chưa có audit log.</p>}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <p className="text-slate-500 dark:text-slate-400">
            Trang {page}/{auditTotalPages} - {totalAuditRows} bản ghi
          </p>
          <div className="flex items-center gap-2">
            <Link href={prevAuditHref} className={`btn-secondary ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}>
              Trang trước
            </Link>
            <Link href={nextAuditHref} className={`btn-secondary ${page >= auditTotalPages ? "pointer-events-none opacity-50" : ""}`}>
              Trang sau
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-medium text-semantic-heading">{value}</p>
    </div>
  );
}

function buildDocumentDiffRows(
  current: {
    title: string;
    description: string | null;
    price: number;
    file_path: string | null;
    preview_url: string | null;
    thumbnail_url: string | null;
    subject_id: number | null;
    grade_id: number | null;
    exam_id: number | null;
    is_downloadable: boolean;
    status: string | null;
  },
  selected: {
    title: string | null;
    description: string | null;
    price: number | null;
    file_path: string | null;
    preview_url: string | null;
    thumbnail_url: string | null;
    subject_id: number | null;
    grade_id: number | null;
    exam_id: number | null;
    is_downloadable: boolean | null;
    status: string | null;
  },
  categoryById: Map<number, { id: number; name: string; type: string }>
) {
  const rows = [
    { field: "title", label: "Title", current: current.title, selected: selected.title },
    { field: "description", label: "Description", current: current.description, selected: selected.description },
    { field: "price", label: "Price", current: current.price, selected: selected.price },
    { field: "status", label: "Status", current: current.status, selected: selected.status },
    { field: "is_downloadable", label: "Downloadable", current: current.is_downloadable, selected: selected.is_downloadable },
    {
      field: "subject_id",
      label: "Subject",
      current: current.subject_id ? (categoryById.get(current.subject_id)?.name ?? String(current.subject_id)) : null,
      selected: selected.subject_id ? (categoryById.get(selected.subject_id)?.name ?? String(selected.subject_id)) : null,
    },
    {
      field: "grade_id",
      label: "Grade",
      current: current.grade_id ? (categoryById.get(current.grade_id)?.name ?? String(current.grade_id)) : null,
      selected: selected.grade_id ? (categoryById.get(selected.grade_id)?.name ?? String(selected.grade_id)) : null,
    },
    {
      field: "exam_id",
      label: "Exam",
      current: current.exam_id ? (categoryById.get(current.exam_id)?.name ?? String(current.exam_id)) : null,
      selected: selected.exam_id ? (categoryById.get(selected.exam_id)?.name ?? String(selected.exam_id)) : null,
    },
    { field: "file_path", label: "File path", current: current.file_path, selected: selected.file_path },
    { field: "preview_url", label: "Preview URL", current: current.preview_url, selected: selected.preview_url },
    { field: "thumbnail_url", label: "Thumbnail URL", current: current.thumbnail_url, selected: selected.thumbnail_url },
  ];

  return rows.map((row) => {
    const currentValue = renderDiffValue(row.current);
    const selectedValue = renderDiffValue(row.selected);
    return {
      field: row.field,
      label: row.label,
      current: currentValue,
      selected: selectedValue,
      changed: currentValue !== selectedValue,
    };
  });
}

function renderDiffValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}
