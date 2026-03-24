type DocumentsListParams = {
  grade?: string;
  subject?: string;
  exam?: string;
  q?: string;
  qp_variant?: string;
  sort?: string;
  page?: string | number;
};

type DocumentsListOverrides = {
  sort?: string;
  page?: string | number;
};

/**
 * Build list href with consistent query rules for filters/sort/page.
 */
export function buildDocumentsListHref(
  basePath: string,
  params: DocumentsListParams,
  overrides?: DocumentsListOverrides
): string {
  const next = new URLSearchParams();
  const resolvedSort = overrides?.sort ?? params.sort ?? "newest";
  const resolvedPage = Number(overrides?.page ?? params.page ?? 1);

  if (params.grade) next.set("grade", params.grade);
  if (params.subject) next.set("subject", params.subject);
  if (params.exam) next.set("exam", params.exam);
  if (params.q) next.set("q", params.q);
  if (params.qp_variant) next.set("qp_variant", params.qp_variant);
  if (resolvedSort !== "newest") next.set("sort", resolvedSort);
  if (resolvedPage > 1) next.set("page", String(resolvedPage));

  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}
