"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Hook dùng chung cho các bảng Admin để xử lý URL Search Params (filter, phân trang, sort).
 */
export function useAdminFilters() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    /**
     * Tạo URL mới bằng cách thêm/sửa/xóa các tham số.
     * Nếu giá trị là null, undefined hoặc chuỗi rỗng sẽ xóa tham số đó.
     */
    const withQuery = useCallback(
        (patch: Record<string, string | null | undefined>) => {
            const next = new URLSearchParams(searchParams.toString());
            Object.entries(patch).forEach(([key, value]) => {
                if (value === null || value === undefined || value === "") {
                    next.delete(key);
                } else {
                    next.set(key, value);
                }
            });
            const qs = next.toString();
            return qs ? `${pathname}?${qs}` : pathname;
        },
        [pathname, searchParams]
    );

    /**
     * Thực hiện push router ngay lập tức với các tham số mới.
     */
    const patchQuery = useCallback(
        (patch: Record<string, string | null | undefined>) => {
            router.push(withQuery(patch));
        },
        [router, withQuery]
    );

    /**
     * Xóa một danh sách các tham số (ví dụ: reset phân trang khi đổi bộ lọc).
     */
    const resetParams = useCallback(
        (keys: string[]) => {
            const next = new URLSearchParams(searchParams.toString());
            keys.forEach((k) => next.delete(k));
            const qs = next.toString();
            router.push(qs ? `${pathname}?${qs}` : pathname);
        },
        [pathname, router, searchParams]
    );

    return {
        router,
        pathname,
        searchParams,
        withQuery,
        patchQuery,
        resetParams,
    };
}
