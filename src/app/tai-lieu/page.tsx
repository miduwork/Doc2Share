import Link from "next/link";
import PublicLayout from "@/components/layout/PublicLayout";
import { createClient } from "@/lib/supabase/server";
import DocumentCard from "@/components/DocumentCard";
import DiscoveryFilters from "@/components/DiscoveryFilters";

interface SearchParams { grade?: string; subject?: string; exam?: string; sort?: string }

export default async function TaiLieuPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const sort = params.sort ?? "newest";

  let query = supabase
    .from("documents")
    .select("id, title, description, price, preview_url, thumbnail_url, is_downloadable, subject_id, grade_id, exam_id, created_at");

  if (params.grade) query = query.eq("grade_id", params.grade);
  if (params.subject) query = query.eq("subject_id", params.subject);
  if (params.exam) query = query.eq("exam_id", params.exam);
  if (sort === "price_asc") query = query.order("price", { ascending: true });
  else if (sort === "price_desc") query = query.order("price", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data: docs } = await query.limit(48);
  const { data: categories } = await supabase.from("categories").select("id, name, type").order("type").order("name");
  const docIds = (docs ?? []).map((d) => d.id);
  const reviewStats = new Map<string, { avg: number; count: number }>();
  const soldStats = new Map<string, number>();

  if (docIds.length > 0) {
    try {
      const { data: reviews } = await supabase
        .from("document_reviews")
        .select("document_id, rating")
        .in("document_id", docIds);

      const accum: Record<string, { sum: number; count: number }> = {};
      for (const r of reviews ?? []) {
        const id = (r as { document_id: string }).document_id;
        if (!accum[id]) accum[id] = { sum: 0, count: 0 };
        accum[id].sum += Number((r as { rating: number }).rating);
        accum[id].count += 1;
      }
      for (const [id, v] of Object.entries(accum)) {
        reviewStats.set(id, { avg: v.sum / v.count, count: v.count });
      }
    } catch {
      // keep empty stats when review table is unavailable
    }

    try {
      const { data: permissions } = await supabase
        .from("permissions")
        .select("document_id")
        .in("document_id", docIds);
      for (const p of permissions ?? []) {
        const id = (p as { document_id: string }).document_id;
        soldStats.set(id, (soldStats.get(id) ?? 0) + 1);
      }
    } catch {
      // keep empty stats when permissions query fails
    }
  }

  const subjects = categories?.filter((c) => c.type === "subject") ?? [];
  const grades = categories?.filter((c) => c.type === "grade") ?? [];
  const exams = categories?.filter((c) => c.type === "exam") ?? [];

  return (
    <PublicLayout>
      <section className="reveal-section section-spacing border-b border-line bg-gradient-to-b from-surface to-surface-muted/50">
          <div className="section-container">
            <h1 className="font-display text-3xl font-bold tracking-tight text-semantic-heading">Kho tài liệu</h1>
            <p className="mt-1 text-muted">
              Lọc theo khối lớp, môn học và kỳ thi — tìm đúng thứ bạn cần.
            </p>
            <div className="mt-4 md:hidden">
              <DiscoveryFilters grades={grades} subjects={subjects} exams={exams} basePath="/tai-lieu" />
            </div>
          </div>
        </section>
        <div className="reveal-section reveal-delay-1 section-container section-spacing flex gap-8">
          <aside className="hidden w-64 shrink-0 md:block">
            <DiscoveryFilters grades={grades} subjects={subjects} exams={exams} basePath="/tai-lieu" variant="sidebar" />
          </aside>
          <section className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {(docs ?? []).length} tài liệu
              </p>
              <div className="premium-panel flex items-center gap-2 px-3 py-2 text-sm">
                <span className="text-muted">Sắp xếp:</span>
                {[
                  { id: "newest", label: "Mới nhất" },
                  { id: "price_asc", label: "Giá thấp" },
                  { id: "price_desc", label: "Giá cao" },
                ].map((opt) => {
                  const next = new URLSearchParams();
                  if (params.grade) next.set("grade", params.grade);
                  if (params.subject) next.set("subject", params.subject);
                  if (params.exam) next.set("exam", params.exam);
                  if (opt.id !== "newest") next.set("sort", opt.id);
                  const href = next.toString() ? `/tai-lieu?${next.toString()}` : "/tai-lieu";
                  return (
                    <Link
                      key={opt.id}
                      href={href}
                      className={`rounded-lg px-2.5 py-1.5 transition ${
                        sort === opt.id
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-muted hover:bg-surface-muted"
                      }`}
                    >
                      {opt.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            {/* Nổi bật: 3 tài liệu đầu dạng card ngang, tạo cảm giác "kho" khác trang chủ */}
            {(docs ?? []).length > 0 && (
              <div className="mb-8">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Nổi bật trong bộ lọc</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(docs ?? []).slice(0, 3).map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      categories={categories ?? []}
                      ratingCount={reviewStats.get(doc.id)?.count ?? 0}
                      avgRating={reviewStats.get(doc.id)?.avg ?? null}
                      soldCount={soldStats.get(doc.id) ?? 0}
                    />
                  ))}
                </div>
              </div>
            )}
            {/* Tất cả: layout list từ thứ 4 trở đi (khi có >3 tài liệu) */}
            {(docs ?? []).length > 3 && (
              <>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Tất cả tài liệu</h2>
                <div className="flex flex-col gap-3">
                  {(docs ?? []).slice(3).map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      categories={categories ?? []}
                      ratingCount={reviewStats.get(doc.id)?.count ?? 0}
                      avgRating={reviewStats.get(doc.id)?.avg ?? null}
                      soldCount={soldStats.get(doc.id) ?? 0}
                      variant="list"
                    />
                  ))}
                </div>
              </>
            )}
            {(!docs || docs.length === 0) && (
              <div className="premium-panel border-dashed py-16 text-center">
                <p className="text-muted">Không có tài liệu nào phù hợp bộ lọc hiện tại.</p>
              </div>
            )}
          </section>
        </div>
    </PublicLayout>
  );
}
