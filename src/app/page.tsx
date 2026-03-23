import Link from "next/link";
import PublicLayout from "@/components/layout/PublicLayout";
import { createClient } from "@/lib/supabase/server";
import DocumentCard from "@/components/DocumentCard";
import DiscoveryFilters from "@/components/DiscoveryFilters";
import { ArrowRight, BookOpen, Shield, Sparkles, Users, Library } from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, description, price, preview_url, thumbnail_url, is_downloadable, subject_id, grade_id, exam_id")
    .limit(12);
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
      {/* Hero – gradient đa lớp, blob lớn, CTA Khám phá tài liệu */}
        <section className="reveal-section relative overflow-hidden border-b border-line py-16 sm:py-20">
          {/* Gradient đa lớp: primary → trắng → emerald → accent nhạt */}
          <div
            className="absolute inset-0 -z-10 dark:hidden"
            style={{
              background: [
                "radial-gradient(ellipse 100% 80% at 20% 20%, rgba(219, 234, 254, 0.9) 0%, transparent 50%)",
                "radial-gradient(ellipse 80% 60% at 80% 80%, rgba(209, 250, 229, 0.7) 0%, transparent 50%)",
                "radial-gradient(ellipse 70% 70% at 60% 10%, rgba(255, 237, 213, 0.35) 0%, transparent 45%)",
                "linear-gradient(165deg, rgb(248 250 252) 0%, rgb(255 255 255) 35%, rgb(236 253 245 / 0.6) 70%, rgb(255 247 237 / 0.4) 100%)",
              ].join(", "),
            }}
          />
          <div
            className="absolute inset-0 -z-10 hidden dark:block"
            style={{
              background: [
                "radial-gradient(ellipse 100% 80% at 20% 20%, rgba(30, 58, 138, 0.25) 0%, transparent 50%)",
                "radial-gradient(ellipse 80% 60% at 80% 80%, rgba(6, 78, 59, 0.2) 0%, transparent 50%)",
                "linear-gradient(165deg, rgb(2 6 23) 0%, rgb(15 23 42) 40%, rgb(15 23 42 / 0.98) 100%)",
              ].join(", "),
            }}
          />
          <div className="section-container relative z-10 text-center">
            <span className="inline-flex rounded-full border border-primary-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary shadow-sm dark:border-primary-700 dark:bg-slate-900/80">
              Neo Edu Premium
            </span>
            <h1 className="font-display mt-4 text-4xl font-bold tracking-tight text-semantic-heading sm:text-5xl lg:text-6xl">
              Tài liệu ôn thi
              <span className="block bg-gradient-to-r from-primary-600 to-emerald-500 bg-clip-text text-transparent">chuyên sâu, trình bày đẹp</span>
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-lg text-slate-600 dark:text-slate-400">
              Tìm đúng tài liệu trong vài giây, xem thử trực quan trước khi mua, và học tập an toàn trên nền tảng tối ưu cho học sinh Việt Nam.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/tai-lieu"
                className="btn-primary inline-flex items-center gap-2 px-6 py-3.5 text-base shadow-cardHover"
              >
                Khám phá tài liệu
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
            <div className="mx-auto mt-8 max-w-5xl">
              <DiscoveryFilters
                grades={grades}
                subjects={subjects}
                exams={exams}
                basePath="/tai-lieu"
              />
            </div>
          </div>
          {/* Blob lớn, rõ hơn – primary, emerald, accent nhạt */}
          <div className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-primary-300/40 blur-3xl dark:bg-primary-500/20" />
          <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-emerald-300/45 blur-3xl dark:bg-emerald-500/25" />
          <div className="pointer-events-none absolute bottom-1/4 left-1/3 h-48 w-48 rounded-full bg-amber-200/30 blur-3xl dark:bg-amber-500/15" />
        </section>

        {/* Document grid */}
        <section className="reveal-section reveal-delay-1 section-container section-spacing-lg">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display flex items-center gap-2 text-xl font-semibold text-semantic-heading">
              <Sparkles className="h-5 w-5 text-accent-500" />
              Gợi ý tài liệu
            </h2>
            <Link
              href="/tai-lieu"
              className="btn-secondary gap-1.5 text-primary hover:text-primary"
            >
              Xem tất cả
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {(docs ?? []).map((doc) => (
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
          {(!docs || docs.length === 0) && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-600">
              <BookOpen className="h-12 w-12 text-slate-400" />
              <p className="mt-4 text-slate-500">Chưa có tài liệu nào. Quay lại sau nhé!</p>
            </div>
          )}
        </section>

        {/* Trust strip */}
        <section className="reveal-section reveal-delay-2 border-t border-line bg-slate-50/70 py-8 dark:bg-slate-900/40">
          <div className="section-container">
            <div className="premium-panel flex flex-wrap items-center justify-center gap-6 gap-y-4 p-5 text-slate-600 dark:text-slate-400 sm:gap-8">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-5 w-5 shrink-0 text-primary" />
                Xem online bảo mật
              </span>
              <span className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="h-5 w-5 shrink-0 text-edu-green" />
                Mua một lần, dùng lâu dài
              </span>
              <span className="flex items-center gap-2 text-sm font-medium">
                <Library className="h-5 w-5 shrink-0 text-primary-500" />
                {(docs ?? []).length > 0 ? `${(docs ?? []).length}+ tài liệu` : "Nhiều tài liệu"}
              </span>
              <span className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                Học sinh tin dùng
              </span>
            </div>
          </div>
        </section>
    </PublicLayout>
  );
}
