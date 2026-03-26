import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAnonClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { Category } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const DOCUMENTS_LIST_PAGE_SIZE = 48;

export type DocumentsListSort = "newest" | "price_asc" | "price_desc";

export type DocumentsListFilters = {
  grade?: string;
  subject?: string;
  exam?: string;
  q?: string;
  sort?: DocumentsListSort | string;
};

/**
 * Caches the categories list for 24 hours.
 */
export async function getCachedCategories() {
  return unstable_cache(
    async () => {
      // Không dùng createClient() SSR (cookies) trong unstable_cache — Next 14 cấm.
      const supabase = createSupabaseAnonClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data } = await supabase
        .from("categories")
        .select("id, name, type, position")
        .order("type")
        .order("position", { ascending: true });
      return (data as Category[]) ?? [];
    },
    ["categories-list"],
    {
      revalidate: 86400, // 24 hours
      tags: ["categories"],
    }
  )();
}

export async function getDocumentsListData(
  supabase: SupabaseServerClient,
  args: { page?: number; pageSize?: number } & DocumentsListFilters
) {
  const page = args.page ?? 1;
  const pageSize = args.pageSize ?? DOCUMENTS_LIST_PAGE_SIZE;
  const { grade, subject, exam, q, sort } = args;

  let query = supabase
    .from("documents")
    .select(
      "id, title, description, price, preview_url, thumbnail_url, is_downloadable, subject_id, grade_id, exam_id, created_at",
      { count: "exact" }
    );

  if (grade) query = query.eq("grade_id", grade);
  if (subject) query = query.eq("subject_id", subject);
  if (exam) query = query.eq("exam_id", exam);
  if (q?.trim()) {
    const keyword = q.trim().replace(/,/g, "\\,");
    query = query.or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`);
  }

  if (sort === "price_asc") query = query.order("price", { ascending: true });
  else if (sort === "price_desc") query = query.order("price", { ascending: false });
  else if (sort) query = query.order("created_at", { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: docs, count } = await query;

  // Use cached categories to avoid redundant DB queries per document list request
  const categories = await getCachedCategories();

  return { docs, categories, totalCount: count ?? 0 };
}
