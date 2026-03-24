import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getDocumentsListStats(supabase: SupabaseServerClient, docIds: string[]) {
  const reviewStats: Record<string, { avg: number; count: number }> = {};
  const soldStats: Record<string, number> = {};

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

