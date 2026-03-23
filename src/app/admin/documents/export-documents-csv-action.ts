"use server";

import { ok, fail, type ActionResult } from "@/lib/action-result";
import { getDocumentAdminContext } from "./document-manage-action-shared";

const EXPORT_CSV_MAX_ROWS = 5000;

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportDocumentsCsv(filters: {
  q: string;
  status: string;
  subject_id: string;
  grade_id: string;
  exam_id: string;
  sort: string;
  preset: string;
}): Promise<ActionResult<{ csv: string }>> {
  const guard = await getDocumentAdminContext();
  if (!guard.ok) return fail(guard.error);
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  let docsQuery = supabase
    .from("documents")
    .select(
      "id, title, description, price, subject_id, grade_id, exam_id, is_downloadable, status, quality_score, data_quality_status, approval_status, created_at"
    )
    .limit(EXPORT_CSV_MAX_ROWS);

  if (filters.status === "deleted") {
    docsQuery = docsQuery.eq("status", "deleted");
  } else {
    docsQuery = docsQuery.neq("status", "deleted");
    if (filters.status !== "all") docsQuery = docsQuery.eq("status", filters.status);
  }
  if (filters.q?.trim()) docsQuery = docsQuery.ilike("title", `%${filters.q.trim()}%`);
  if (filters.subject_id !== "all") docsQuery = docsQuery.eq("subject_id", Number(filters.subject_id));
  if (filters.grade_id !== "all") docsQuery = docsQuery.eq("grade_id", Number(filters.grade_id));
  if (filters.exam_id !== "all") docsQuery = docsQuery.eq("exam_id", Number(filters.exam_id));
  if (filters.preset === "missing-thumbnail") docsQuery = docsQuery.is("thumbnail_url", null);
  if (filters.preset === "missing-preview") docsQuery = docsQuery.is("preview_url", null);
  if (filters.preset === "pending-approval") docsQuery = docsQuery.eq("approval_status", "pending");
  if (filters.preset === "low-quality") docsQuery = docsQuery.in("data_quality_status", ["review", "needs_review"]);

  if (filters.sort === "price-asc") docsQuery = docsQuery.order("price", { ascending: true });
  else if (filters.sort === "price-desc") docsQuery = docsQuery.order("price", { ascending: false });
  else if (filters.sort === "oldest") docsQuery = docsQuery.order("created_at", { ascending: true });
  else if (filters.sort === "status") docsQuery = docsQuery.order("status", { ascending: true }).order("created_at", { ascending: false });
  else docsQuery = docsQuery.order("created_at", { ascending: false });

  const { data: rows } = await docsQuery;
  const cols = [
    "id",
    "title",
    "description",
    "price",
    "subject_id",
    "grade_id",
    "exam_id",
    "is_downloadable",
    "status",
    "approval_status",
    "data_quality_status",
    "quality_score",
    "created_at",
  ];
  const header = cols.map(escapeCsvCell).join(",");
  const body = (rows ?? [])
    .map((r) => cols.map((c) => escapeCsvCell((r as Record<string, unknown>)[c])).join(","))
    .join("\n");
  const csv = "\uFEFF" + header + "\n" + body;
  return ok({ csv });
}
