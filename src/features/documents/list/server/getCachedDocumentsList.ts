import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getDocumentsListData, type DocumentsListFilters } from "./getDocumentsListData";
import { getDocumentsListStats } from "./getDocumentsListStats";
import { DocumentCardDoc } from "../components/document-card-types";
import { Category } from "@/lib/types";

/**
 * Phiên bản có cache của getDocumentsListData.
 * Revalidate mỗi 1 giờ hoặc khi có tag 'documents' bị xóa.
 */
export async function getCachedDocumentsListData(
    args: { page?: number; pageSize?: number } & DocumentsListFilters
): Promise<{ docs: DocumentCardDoc[] | null; categories: Category[] | null; totalCount: number }> {
    const cacheKey = JSON.stringify(args);

    return unstable_cache(
        async () => {
            const supabase = createSupabaseClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            return getDocumentsListData(supabase as any, args);
        },
        ["documents-list", cacheKey],
        {
            revalidate: 3600, // 1 hour
            tags: ["documents"],
        }
    )();
}

/**
 * Phiên bản có cache của getDocumentsListStats.
 * Revalidate mỗi 1 giờ hoặc khi có tag 'documents', 'reviews' bị xóa.
 */
export async function getCachedDocumentsListStats(docIds: string[]): Promise<{
    reviewStats: Record<string, { avg: number; count: number }>;
    soldStats: Record<string, number>;
}> {
    // Sort docIds để đảm bảo cache key nhất quán bất kể thứ tự truyền vào
    const sortedIds = [...docIds].sort();
    const cacheKey = sortedIds.join(",");

    return unstable_cache(
        async () => {
            const supabase = createSupabaseClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            return getDocumentsListStats(supabase as any, docIds);
        },
        ["documents-stats", cacheKey],
        {
            revalidate: 3600, // 1 hour
            tags: ["documents", "reviews", "permissions"],
        }
    )();
}
