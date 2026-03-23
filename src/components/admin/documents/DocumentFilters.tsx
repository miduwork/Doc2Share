"use client";

import { useState } from "react";
import type { Category } from "@/lib/types";
import type { FiltersState } from "./admin-documents.types";

type Props = {
  filters: FiltersState;
  buildQuery: (_next: Partial<Record<string, string | number>>) => string;
  subjects: Category[];
  grades: Category[];
  exams: Category[];
  onExportCsv?: () => void | Promise<void>;
  exporting?: boolean;
};

export default function DocumentFilters({ filters, buildQuery, subjects, grades, exams, onExportCsv, exporting }: Props) {
  const [goToPage, setGoToPage] = useState("");
  const fromItem = filters.total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const toItem = filters.total === 0 ? 0 : Math.min(filters.page * filters.pageSize, filters.total);

  function handleGoToPage() {
    const n = Number.parseInt(goToPage, 10);
    if (!Number.isFinite(n) || n < 1 || n > filters.totalPages) return;
    window.location.href = buildQuery({ page: n });
  }

  return (
    <div className="premium-panel rounded-xl p-3" role="region" aria-labelledby="doc-filters-heading">
      <h2 id="doc-filters-heading" className="sr-only">
        Bộ lọc và phân trang tài liệu
      </h2>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <a href={buildQuery({ preset: "all", page: 1 })} className="btn-secondary px-3 py-1.5 text-xs">Tất cả</a>
        <a href={buildQuery({ preset: "failed", status: "failed", page: 1 })} className="btn-secondary px-3 py-1.5 text-xs">Lỗi xử lý</a>
        <a href={buildQuery({ preset: "pending-approval", status: "all", page: 1 })} className="btn-secondary px-3 py-1.5 text-xs">Chờ duyệt</a>
        <a href={buildQuery({ preset: "low-quality", status: "all", page: 1 })} className="btn-secondary px-3 py-1.5 text-xs">Chất lượng thấp</a>
        <a href={buildQuery({ preset: "missing-thumbnail", status: "all", page: 1 })} className="btn-secondary px-3 py-1.5 text-xs">Thiếu thumbnail</a>
        <a href={buildQuery({ preset: "missing-preview", status: "all", page: 1 })} className="btn-secondary px-3 py-1.5 text-xs">Thiếu preview</a>
        <a href={buildQuery({ preset: "deleted", status: "deleted", page: 1 })} className="btn-secondary px-3 py-1.5 text-xs">Đã xóa</a>
      </div>
      <form method="get" className="grid gap-2 md:grid-cols-5" aria-label="Lọc tài liệu theo tiêu đề, trạng thái, môn, lớp, kỳ thi">
        <input type="hidden" name="preset" value="custom" />
        <label htmlFor="doc-filter-q" className="sr-only">Tìm theo tiêu đề</label>
        <input id="doc-filter-q" name="q" defaultValue={filters.q} placeholder="Tìm theo tiêu đề..." className="input-premium py-1.5 text-sm md:col-span-2" />
        <label htmlFor="doc-filter-status" className="sr-only">Trạng thái</label>
        <select id="doc-filter-status" name="status" defaultValue={filters.status} className="input-premium py-1.5 text-sm">
          <option value="all">Tất cả trạng thái</option>
          <option value="draft">draft</option>
          <option value="processing">processing</option>
          <option value="ready">ready</option>
          <option value="failed">failed</option>
          <option value="archived">archived</option>
          <option value="deleted">Đã xóa</option>
        </select>
        <label htmlFor="doc-filter-sort" className="sr-only">Sắp xếp</label>
        <select id="doc-filter-sort" name="sort" defaultValue={filters.sort} className="input-premium py-1.5 text-sm">
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
          <option value="price-asc">Giá tăng dần</option>
          <option value="price-desc">Giá giảm dần</option>
          <option value="status">Theo trạng thái</option>
        </select>
        <button className="btn-primary px-3 py-1.5 text-xs" type="submit">Áp dụng</button>
        {onExportCsv && (
          <button type="button" onClick={onExportCsv} disabled={exporting} className="btn-secondary px-3 py-1.5 text-xs">
            {exporting ? "Đang xuất…" : "Xuất CSV"}
          </button>
        )}
        <select name="subject_id" defaultValue={filters.subject_id} className="input-premium py-1.5 text-sm">
          <option value="all">Môn học</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select name="grade_id" defaultValue={filters.grade_id} className="input-premium py-1.5 text-sm">
          <option value="all">Khối lớp</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select name="exam_id" defaultValue={filters.exam_id} className="input-premium py-1.5 text-sm">
          <option value="all">Kỳ thi</option>
          {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select name="page_size" defaultValue={String(filters.pageSize)} className="input-premium py-1.5 text-sm">
          {[20, 50, 100].map((n) => <option key={n} value={n}>{n}/trang</option>)}
        </select>
        <input type="hidden" name="page" value="1" />
      </form>
      <nav className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-xs text-muted" aria-label="Phân trang">
        <p>Tổng: {filters.total.toLocaleString("vi-VN")} • {fromItem}–{toItem} • Trang {filters.page}/{filters.totalPages}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1">
            <label htmlFor="doc-goto-page" className="sr-only">Đến trang (1 đến {filters.totalPages})</label>
            <input
              id="doc-goto-page"
              type="number"
              min={1}
              max={filters.totalPages}
              value={goToPage}
              onChange={(e) => setGoToPage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGoToPage()}
              placeholder="Trang"
              className="w-14 rounded border border-line bg-surface px-1.5 py-1 text-center text-xs text-fg"
              aria-label={`Trang hiện tại: ${filters.page}. Nhập số trang rồi bấm Đến trang.`}
            />
            <button type="button" onClick={handleGoToPage} className="btn-secondary px-2 py-1 text-xs">
              Đến trang
            </button>
          </span>
          <a className={`btn-secondary px-2 py-1 text-xs ${filters.page <= 1 ? "pointer-events-none opacity-50" : ""}`} href={buildQuery({ page: Math.max(1, filters.page - 1) })}>Trước</a>
          <a className={`btn-secondary px-2 py-1 text-xs ${filters.page >= filters.totalPages ? "pointer-events-none opacity-50" : ""}`} href={buildQuery({ page: Math.min(filters.totalPages, filters.page + 1) })}>Sau</a>
        </div>
      </nav>
    </div>
  );
}
