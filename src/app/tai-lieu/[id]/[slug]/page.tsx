import { notFound } from "next/navigation";
import PublicLayout from "@/components/layout/PublicLayout";
import { createClient } from "@/lib/supabase/server";
import ProductPageClient from "./ProductPageClient";
import DocumentCard from "@/components/DocumentCard";
import type { Metadata } from "next";
interface Props {
  params: Promise<{ id: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, slug } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("title, description, preview_text, price, preview_url, thumbnail_url")
    .eq("id", id)
    .single();
  if (!doc) return { title: "Tài liệu" };
  const description = doc.description || doc.preview_text || undefined;
  const desc160 = description?.slice(0, 160) ?? "";
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://doc2share.vn";
  return {
    title: `${doc.title} | Doc2Share`,
    description: desc160,
    alternates: { canonical: `${base}/tai-lieu/${id}/${slug}` },
    openGraph: {
      title: doc.title,
      description: desc160,
      type: "website",
      images: (doc as { thumbnail_url?: string | null }).thumbnail_url
      ? [{ url: (doc as { thumbnail_url: string }).thumbnail_url }]
      : (doc as { preview_url?: string | null }).preview_url
        ? [{ url: (doc as { preview_url: string }).preview_url }]
        : undefined,
    },
    other: {
      "product:price:amount": String(doc.price),
      "product:price:currency": "VND",
    },
  };
}

export default async function DocumentProductPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, title, description, price, preview_url, preview_text, thumbnail_url, subject_id, grade_id, exam_id, is_downloadable")
    .eq("id", id)
    .single();

  if (error || !doc) notFound();

  const { data: categories } = await supabase.from("categories").select("id, name, type");
  const subject = categories?.find((c) => c.id === doc.subject_id) ?? null;
  const grade = categories?.find((c) => c.id === doc.grade_id) ?? null;
  const exam = categories?.find((c) => c.id === doc.exam_id) ?? null;

  let reviewsList: { id: string; user_id: string; rating: number; comment: string | null; created_at: string }[] = [];
  try {
    const res = await supabase
      .from("document_reviews")
      .select("id, user_id, rating, comment, created_at")
      .eq("document_id", doc.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!res.error) reviewsList = (res.data ?? []) as typeof reviewsList;
  } catch {
    // table may not exist
  }
  const ratings = reviewsList.map((r) => r.rating);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: doc.title,
    description: doc.description || doc.preview_text || "",
    offers: {
      "@type": "Offer",
      price: Number(doc.price),
      priceCurrency: "VND",
    },
  };
  if (avgRating != null && ratings.length > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Math.round(avgRating * 10) / 10,
      bestRating: 5,
      worstRating: 1,
      ratingCount: ratings.length,
    };
  }

  let commentsList: { id: string; user_id: string; content: string; created_at: string }[] = [];
  try {
    const res = await supabase
      .from("document_comments")
      .select("id, user_id, content, created_at")
      .eq("document_id", doc.id)
      .order("created_at", { ascending: true })
      .limit(50);
    if (!res.error) commentsList = (res.data ?? []) as typeof commentsList;
  } catch {
    // table may not exist
  }

  let relatedDocs:
    { id: string; title: string; description: string | null; price: number; preview_url: string | null; thumbnail_url: string | null; is_downloadable: boolean; subject_id: number | null; grade_id: number | null; exam_id: number | null }[]
    = [];
  try {
    let relatedQuery = supabase
      .from("documents")
      .select("id, title, description, price, preview_url, thumbnail_url, is_downloadable, subject_id, grade_id, exam_id, created_at")
      .neq("id", doc.id)
      .order("created_at", { ascending: false })
      .limit(6);

    if (doc.subject_id) {
      relatedQuery = relatedQuery.eq("subject_id", doc.subject_id);
    } else if (doc.grade_id) {
      relatedQuery = relatedQuery.eq("grade_id", doc.grade_id);
    }

    const { data } = await relatedQuery;
    relatedDocs = (data ?? []) as typeof relatedDocs;

    if (relatedDocs.length < 3) {
      const { data: fallback } = await supabase
        .from("documents")
        .select("id, title, description, price, preview_url, thumbnail_url, is_downloadable, subject_id, grade_id, exam_id, created_at")
        .neq("id", doc.id)
        .order("created_at", { ascending: false })
        .limit(6);

      const byId = new Map<string, (typeof relatedDocs)[number]>();
      for (const item of relatedDocs) byId.set(item.id, item);
      for (const item of (fallback ?? []) as typeof relatedDocs) byId.set(item.id, item);
      relatedDocs = Array.from(byId.values()).slice(0, 6);
    }
  } catch {
    // ignore related docs when query fails
  }

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <ProductPageClient
          doc={{
            id: doc.id,
            title: doc.title,
            description: doc.description,
            price: Number(doc.price),
            preview_url: doc.preview_url,
            preview_text: doc.preview_text,
            thumbnail_url: (doc as { thumbnail_url?: string | null }).thumbnail_url ?? null,
            is_downloadable: doc.is_downloadable,
            subject: subject as { id: number; name: string } | null,
            grade: grade as { id: number; name: string } | null,
            exam: exam as { id: number; name: string } | null,
          }}
          reviews={reviewsList}
          comments={commentsList}
        />
        {relatedDocs.length > 0 && (
          <section className="reveal-section reveal-delay-1 section-container pb-12">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-semantic-heading">Tài liệu liên quan</h2>
                <p className="mt-1 text-sm text-muted">Gợi ý thêm để ôn tập đúng trọng tâm.</p>
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {relatedDocs.map((item) => (
                <DocumentCard key={item.id} doc={item} categories={categories ?? []} variant="compact" />
              ))}
            </div>
          </section>
        )}
    </PublicLayout>
  );
}
