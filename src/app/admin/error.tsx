"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
          <AlertCircle className="h-7 w-7" />
        </span>
        <h1 className="text-xl font-bold text-semantic-heading">Lỗi khu vực quản trị</h1>
        <p className="max-w-sm text-sm text-slate-600 dark:text-slate-400">
          Không tải được nội dung. Thử lại hoặc quay lại bảng điều khiển.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Thử lại
          </button>
          <Link
            href="/admin"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-700"
          >
            Về Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
