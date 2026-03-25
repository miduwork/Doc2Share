import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import PublicLayout from "@/features/layout/components/PublicLayout";
import { createClient } from "@/lib/supabase/server";
import DocumentCard from "@/features/documents/list/components/DocumentCard";
import DocumentListCard from "@/features/documents/list/components/DocumentListCard";
import StickyDocumentsToolbar from "@/features/documents/list/components/StickyDocumentsToolbar";
import { resolveQuickPreviewVariant } from "@/features/documents/list/experiments/quick-preview-experiment";
import {
  getCachedDocumentsListData,
  getCachedDocumentsListStats
} from "@/features/documents/list/server/getCachedDocumentsList";
import { DOCUMENTS_LIST_PAGE_SIZE } from "@/features/documents/list/server/getDocumentsListData";
import { buildDocumentsListHref } from "@/features/documents/list/documents-list-url";
import { clampInt, pickSingle } from "@/lib/search-params";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

const DiscoveryFilters = dynamic(() => import("@/features/documents/list/components/DiscoveryFilters"), {
  ssr: true,
  loading: () => <div className="h-12 w-full animate-pulse rounded-xl bg-surface-muted/50" />,
});

const taiLieuListDescription =
  "Lọc tài liệu ôn thi theo khối lớp, môn học và kỳ thi. Xem trước, mua và đọc bảo mật trên Doc2Share.";

const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://doc2share.vn";

export const metadata: Metadata = {
  title: "Kho tài liệu | Doc2Share",
  description: taiLieuListDescription,
  alternates: { canonical: `${appBaseUrl}/cua-hang` },
  openGraph: {
    title: "Kho tài liệu | Doc2Share",
    description: taiLieuListDescription,
    type: "website",
  },
};

interface SearchParams {
  grade?: string;
  subject?: string;
  exam?: string;
  q?: string;
  qp_variant?: string;
  sort?: string;
  page?: string;
}

type ActiveFilterChip = {
  key: "grade" | "subject" | "exam" | "q";
  label: string;
  href: string;
};

function getPaginationItems(currentPage: number, totalPages: number): Array<number | "..."> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const normalized = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const items: Array<number | "..."> = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const p = normalized[i];
    if (i > 0 && p - normalized[i - 1] > 1) {
      items.push("...");
    }
    items.push(p);
  }

  return items;
}

function getFeaturedCriteriaText(sort: string): string {
  switch (sort) {
    case "price_asc":
      return "Dựa trên sắp xếp hiện tại: giá thấp đến cao.";
    case "price_desc":
      return "Dựa trên sắp xếp hiện tại: giá cao đến thấp.";
    case "newest":
    default:
      return "Dựa trên sắp xếp hiện tại: mới nhất.";
  }
}

function buildActiveFilterChips(
  params: SearchParams,
  categories: Array<{ id: string | number; name: string; type: string }>
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  const byId = new Map(categories.map((c) => [String(c.id), c]));
  const sort = params.sort ?? "newest";

  if (params.grade) {
    const grade = byId.get(String(params.grade));
    chips.push({
      key: "grade",
      label: `Khối: ${grade?.name ?? params.grade}`,
      href: buildDocumentsListHref("/cua-hang", { ...params, grade: undefined, sort }, { page: 1 }),
    });
  }
  if (params.subject) {
    const subject = byId.get(String(params.subject));
    chips.push({
      key: "subject",
      label: `Môn: ${subject?.name ?? params.subject}`,
      href: buildDocumentsListHref("/cua-hang", { ...params, subject: undefined, sort }, { page: 1 }),
    });
  }
  if (params.exam) {
    const exam = byId.get(String(params.exam));
    chips.push({
      key: "exam",
      label: `Kỳ thi: ${exam?.name ?? params.exam}`,
      href: buildDocumentsListHref("/cua-hang", { ...params, exam: undefined, sort }, { page: 1 }),
    });
  }
  if (params.q?.trim()) {
    chips.push({
      key: "q",
      label: `Từ khóa: ${params.q.trim()}`,
      href: buildDocumentsListHref("/cua-hang", { ...params, q: undefined, sort }, { page: 1 }),
    });
  }

  return chips;
}

export default async function TaiLieuPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const cookieStore = cookies();
  const sort = params.sort ?? "newest";
  const keyword = pickSingle(params.q, "").trim();
  const page = clampInt(pickSingle(params.page, "1"), 1, 10_000, 1);
  const pageSize = DOCUMENTS_LIST_PAGE_SIZE;

  const { docs, categories, totalCount } = await getCachedDocumentsListData({
    page,
    pageSize,
    grade: params.grade,
    subject: params.subject,
    exam: params.exam,
    q: keyword,
    sort,
  });

  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;
  if (totalCount > 0 && page > totalPages) {
    redirect(buildDocumentsListHref("/cua-hang", params, { page: totalPages }));
  }

  const docIds = (docs ?? []).map((d) => d.id);
  const { reviewStats, soldStats } = await getCachedDocumentsListStats(docIds);

  const subjects = categories?.filter((c) => c.type === "subject") ?? [];
  const grades = categories?.filter((c) => c.type === "grade") ?? [];
  const exams = categories?.filter((c) => c.type === "exam") ?? [];

  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
  const paginationItems = getPaginationItems(page, totalPages);
  const metaLine =
    totalCount === 0
      ? "0 tài liệu"
      : totalPages <= 1
        ? `${totalCount} tài liệu`
        : `Hiển thị ${startItem.toLocaleString("vi-VN")}–${endItem.toLocaleString("vi-VN")} trong ${totalCount.toLocaleString("vi-VN")} tài liệu`;
  const keywordMeta = keyword ? ` cho "${keyword}"` : "";

  const docList = docs ?? [];
  const featuredDocs = docList.slice(0, 3);
  const allDocs = docList;
  const activeFilterChips = buildActiveFilterChips(params, categories ?? []);
  const clearAllHref = buildDocumentsListHref("/cua-hang", { sort }, { page: 1 });
  const activeFilterCount = activeFilterChips.length;
  const quickPreviewVariant = resolveQuickPreviewVariant({
    qpVariantParam: pickSingle(params.qp_variant, ""),
    cookieVariant: cookieStore.get("qp_variant")?.value ?? null,
  });
  const sortOptions = [
    {
      id: "newest",
      label: "Mới nhất",
      href: buildDocumentsListHref("/cua-hang", params, { sort: "newest", page: 1 }),
    },
    {
      id: "price_asc",
      label: "Giá thấp",
      href: buildDocumentsListHref("/cua-hang", params, { sort: "price_asc", page: 1 }),
    },
    {
      id: "price_desc",
      label: "Giá cao",
      href: buildDocumentsListHref("/cua-hang", params, { sort: "price_desc", page: 1 }),
    },
  ];

  return (
    <PublicLayout>
      <section className="reveal-section section-spacing border-b border-line bg-gradient-to-b from-surface to-surface-muted/50">
        <div className="section-container">
          <h1 className="font-display text-3xl font-bold tracking-tight text-semantic-heading sm:text-4xl">Kho tài liệu</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Lọc theo khối lớp, môn học và kỳ thi — tìm đúng thứ bạn cần.
          </p>
          <div className="mt-4 lg:hidden">
            <DiscoveryFilters grades={grades} subjects={subjects} exams={exams} basePath="/cua-hang" />
          </div>
        </div>
      </section>
      <div className="reveal-section reveal-delay-1 section-container section-spacing flex gap-6 lg:gap-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <DiscoveryFilters grades={grades} subjects={subjects} exams={exams} basePath="/cua-hang" variant="sidebar" />
        </aside>
        <section className="min-w-0 flex-1">
          <StickyDocumentsToolbar
            activeFilterCount={activeFilterCount}
            sort={sort}
            sortOptions={sortOptions}
            clearAllHref={clearAllHref}
          />
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {metaLine}
              {keywordMeta}
            </p>
            <div className="premium-panel flex flex-1 flex-wrap items-center justify-end gap-2.5 px-3 py-2.5 text-sm">
              <form action="/cua-hang" method="get" className="flex min-w-[280px] flex-1 items-center gap-2">
                {params.grade ? <input type="hidden" name="grade" value={params.grade} /> : null}
                {params.subject ? <input type="hidden" name="subject" value={params.subject} /> : null}
                {params.exam ? <input type="hidden" name="exam" value={params.exam} /> : null}
                {sort !== "newest" ? <input type="hidden" name="sort" value={sort} /> : null}
                <label htmlFor="documents-search" className="sr-only">Tìm kiếm tài liệu</label>
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    id="documents-search"
                    name="q"
                    defaultValue={keyword}
                    placeholder="Tìm theo tên hoặc mô tả"
                    className="min-h-11 w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-fg outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 focus-visible:ring-2 focus-visible:ring-primary/30"
                  />
                </div>
                <button type="submit" className="min-h-11 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-primary/30">
                  Tìm
                </button>
              </form>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Sắp xếp</span>
                {sortOptions.map((opt) => {
                  const href = opt.href;
                  return (
                    <Link
                      key={opt.id}
                      href={href}
                      className={`inline-flex min-h-9 items-center rounded-full px-2.5 py-1.5 text-xs font-medium tracking-wide transition sm:text-sm sm:tracking-normal ${sort === opt.id
                        ? "bg-surface-muted font-semibold text-fg"
                        : "text-muted hover:bg-surface-muted hover:text-fg"
                        }`}
                    >
                      {opt.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
          {activeFilterChips.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2 lg:hidden">
              {activeFilterChips.map((chip) => (
                <Link
                  key={chip.key}
                  href={chip.href}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium tracking-wide text-fg transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-h-11 sm:py-2 sm:text-sm sm:tracking-normal"
                  aria-label={`Bỏ lọc ${chip.label}`}
                >
                  <span className="max-w-[14rem] truncate">{chip.label}</span>
                  <span aria-hidden="true">x</span>
                </Link>
              ))}
              <Link
                href={clearAllHref}
                className="inline-flex min-h-9 items-center rounded-full border border-line px-3 py-1.5 text-xs font-semibold tracking-wide text-fg transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-h-11 sm:py-2 sm:text-sm sm:tracking-normal"
              >
                Xóa lọc
              </Link>
            </div>
          )}
          {docList.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Nổi bật</h2>
              <p className="mb-4 text-xs leading-relaxed text-muted">{getFeaturedCriteriaText(sort)}</p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {featuredDocs.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    categories={categories ?? []}
                    ratingCount={reviewStats[doc.id]?.count ?? 0}
                    avgRating={reviewStats[doc.id]?.avg ?? null}
                    soldCount={soldStats[doc.id] ?? 0}
                    enableMicroInteraction={false}
                    enableQuickPreview={false}
                    quickPreviewVariant={quickPreviewVariant}
                  />
                ))}
              </div>
            </div>
          )}
          {allDocs.length > 0 && (
            <>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Tất cả tài liệu</h2>
              <div className="flex flex-col gap-3">
                {allDocs.map((doc) => (
                  <DocumentListCard
                    key={doc.id}
                    doc={doc}
                    categories={categories ?? []}
                    soldCount={soldStats[doc.id] ?? 0}
                    ratingCount={reviewStats[doc.id]?.count ?? 0}
                    avgRating={reviewStats[doc.id]?.avg ?? null}
                  />
                ))}
              </div>
            </>
          )}
          {docList.length === 0 && (
            <div className="premium-panel border-dashed px-6 py-12 text-center">
              <p className="text-muted">Không có tài liệu nào phù hợp bộ lọc hiện tại.</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Link
                  href="/cua-hang"
                  className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm font-medium text-fg transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  Xóa bộ lọc
                </Link>
                <Link
                  href={buildDocumentsListHref("/cua-hang", {}, { sort: "newest", page: 1 })}
                  className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm font-medium text-fg transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  Mới nhất
                </Link>
                <Link
                  href={buildDocumentsListHref("/cua-hang", {}, { sort: "price_desc", page: 1 })}
                  className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm font-medium text-fg transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  Giá cao nổi bật
                </Link>
              </div>
            </div>
          )}
          {totalCount > 0 && totalPages > 1 ? (
            <nav
              className="premium-panel mt-8 flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              aria-label="Phân trang danh sách tài liệu"
            >
              {page <= 1 ? (
                <span className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted">
                  <ChevronLeft className="h-4 w-4" />
                  Trước
                </span>
              ) : (
                <Link
                  href={buildDocumentsListHref("/cua-hang", params, { page: page - 1 })}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-fg hover:bg-surface-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Trước
                </Link>
              )}
              <div className="flex flex-1 flex-wrap items-center justify-center gap-1">
                {paginationItems.map((item, index) => {
                  if (item === "...") {
                    return (
                      <span
                        key={`ellipsis-${index}`}
                        className="inline-flex min-w-9 items-center justify-center px-1 text-sm text-muted"
                        aria-hidden="true"
                      >
                        ...
                      </span>
                    );
                  }

                  const isCurrent = item === page;
                  return isCurrent ? (
                    <span
                      key={item}
                      aria-current="page"
                      className="inline-flex min-w-9 items-center justify-center rounded-lg bg-surface-muted px-3 py-2 text-sm font-semibold text-fg"
                    >
                      {item.toLocaleString("vi-VN")}
                    </span>
                  ) : (
                    <Link
                      key={item}
                      href={buildDocumentsListHref("/cua-hang", params, { page: item })}
                      className="inline-flex min-w-9 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-muted hover:text-fg"
                    >
                      {item.toLocaleString("vi-VN")}
                    </Link>
                  );
                })}
              </div>
              <span className="w-full text-center text-xs text-muted sm:w-auto sm:text-sm">
                Trang {page.toLocaleString("vi-VN")} / {totalPages.toLocaleString("vi-VN")}
              </span>
              {page >= totalPages ? (
                <span className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted">
                  Sau
                  <ChevronRight className="h-4 w-4" />
                </span>
              ) : (
                <Link
                  href={buildDocumentsListHref("/cua-hang", params, { page: page + 1 })}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-fg hover:bg-surface-muted"
                >
                  Sau
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </nav>
          ) : null}
        </section>
      </div>
    </PublicLayout>
  );
}
