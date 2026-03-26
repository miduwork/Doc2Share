import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getDocumentsListStats(supabase: SupabaseServerClient, docIds: string[]) {
  const reviewStats: Record<string, { avg: number; count: number }> = {};
  const soldStats: Record<string, number> = {};

  if (docIds.length > 0) {
    try {
      const { data: reviews } = await supabase
        .from("document_reviews")
        .select("document_id, user_id, rating, created_at")
        .in("document_id", docIds)
        .order("created_at", { ascending: false });

      const accum: Record<string, { sum: number; count: number }> = {};
      const latestReviewByUserPerDoc = new Set<string>();
      for (const r of reviews ?? []) {
        const { document_id: documentId, user_id: userId, rating } = r as {
          document_id: string;
          user_id: string;
          rating: number;
        };
        const key = `${documentId}:${userId}`;
        if (latestReviewByUserPerDoc.has(key)) continue; // keep most recent one only
        latestReviewByUserPerDoc.add(key);

        if (!accum[documentId]) accum[documentId] = { sum: 0, count: 0 };
        accum[documentId].sum += Number(rating);
        accum[documentId].count += 1;
      }

      for (const [id, v] of Object.entries(accum)) {
        reviewStats[id] = { avg: v.sum / v.count, count: v.count };
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
        soldStats[id] = (soldStats[id] ?? 0) + 1;
      }
    } catch {
      // keep empty stats when permissions query fails
    }
  }

  return { reviewStats, soldStats };
}

