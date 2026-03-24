import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import type { ProductPageData, ReviewRow, CommentRow, RelatedDoc } from "@/features/documents/detail/types";

export async function getProductPageData({ id }: { id: string }): Promise<ProductPageData> {
  const supabase = await createClient();

  const { data: doc, error } = await supabase
    .from("documents")
    .select(
      "id, title, description, price, preview_url, preview_text, thumbnail_url, subject_id, grade_id, exam_id, is_downloadable"
    )
    .eq("id", id)
    .single();

  if (error || !doc) notFound();

  const { data: categories } = await supabase.from("categories").select("id, name, type");
  const subject = categories?.find((c) => c.id === doc.subject_id) ?? null;
  const grade = categories?.find((c) => c.id === doc.grade_id) ?? null;
  const exam = categories?.find((c) => c.id === doc.exam_id) ?? null;

  let reviewsList: ReviewRow[] = [];
  try {
    const res = await supabase
      .from("document_reviews")
      .select("id, user_id, rating, comment, created_at")
      .eq("document_id", doc.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!res.error) reviewsList = (res.data ?? []) as ReviewRow[];
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

  let commentsList: CommentRow[] = [];
  try {
    const res = await supabase
      .from("document_comments")
      .select("id, user_id, content, created_at")
      .eq("document_id", doc.id)
      .order("created_at", { ascending: true })
      .limit(50);
    if (!res.error) commentsList = (res.data ?? []) as CommentRow[];
  } catch {
    // table may not exist
  }

  let relatedDocs: RelatedDoc[] = [];

  try {
    let relatedQuery = supabase
      .from("documents")
      .select(
        "id, title, description, price, preview_url, thumbnail_url, is_downloadable, subject_id, grade_id, exam_id, created_at"
      )
      .neq("id", doc.id)
      .order("created_at", { ascending: false })
      .limit(6);

    if (doc.subject_id) {
      relatedQuery = relatedQuery.eq("subject_id", doc.subject_id);
    } else if (doc.grade_id) {
      relatedQuery = relatedQuery.eq("grade_id", doc.grade_id);
    }

    const { data } = await relatedQuery;
    relatedDocs = (data ?? []) as RelatedDoc[];

    if (relatedDocs.length < 3) {
      const { data: fallback } = await supabase
        .from("documents")
        .select(
          "id, title, description, price, preview_url, thumbnail_url, is_downloadable, subject_id, grade_id, exam_id, created_at"
        )
        .neq("id", doc.id)
        .order("created_at", { ascending: false })
        .limit(6);

      const byId = new Map<string, RelatedDoc>();
      for (const item of relatedDocs) byId.set(item.id, item);
      for (const item of ((fallback ?? []) as RelatedDoc[])) byId.set(item.id, item);
      relatedDocs = Array.from(byId.values()).slice(0, 6);
    }
  } catch {
    // ignore related docs when query fails
  }

  return {
    docForClient: {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      price: Number(doc.price),
      preview_url: doc.preview_url,
      preview_text: doc.preview_text,
      thumbnail_url: (doc as { thumbnail_url?: string | null }).thumbnail_url ?? null,
      is_downloadable: doc.is_downloadable,
      subject,
      grade,
      exam,
    },
    categories: categories ?? null,
    reviewsList,
    commentsList,
    schema,
    relatedDocs,
  };
}

