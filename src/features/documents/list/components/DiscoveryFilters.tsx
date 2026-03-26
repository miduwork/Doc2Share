"use client";

import { useCallback } from "react";
import type { Category } from "@/lib/types";
import { applyDiscoveryFilterUpdate } from "@/features/documents/list/discovery-filters-url";
import { Filter, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  grades: Category[];
  subjects: Category[];
  exams: Category[];
  basePath: string;
  variant?: "pills" | "sidebar";
}

/** Mobile: selects + “Tất cả” per dimension; desktop sidebar: pills + Xóa lọc. Same URL updates via `applyDiscoveryFilterUpdate`. */
export default function DiscoveryFilters({ grades, subjects, exams, basePath, variant = "pills" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /** Lớp 1–12 theo thứ tự position (lưới 3×4: 1–3, 4–6, 7–9, 10–12) */
  const sortedGrades = [...grades].sort((a, b) => a.position - b.position);

  /** Sidebar: nút thấp, một dòng chữ (override min-h filter-pill mặc định) */
  const pillCompactRow =
    "!min-h-0 h-8 px-2 py-0 text-xs font-medium leading-none whitespace-nowrap";
  const pillGrade = `${pillCompactRow} w-full justify-center`;
  const pillWrapRow = `${pillCompactRow} min-w-0 max-w-[11rem] shrink truncate`;

  const update = useCallback(
    (key: string, value: string | null) => {
      const { search } = applyDiscoveryFilterUpdate(searchParams, key, value);
      router.push(search ? `${basePath}?${search}` : basePath);
    },
    [router, searchParams, basePath]
  );

  const gradeId = searchParams.get("grade") || "";
  const subjectId = searchParams.get("subject") || "";
  const examId = searchParams.get("exam") || "";
  const hasFilter = Boolean(gradeId || subjectId || examId);

  const pill = (key: string, value: string, label: string, extraClassName = "") => {
    const isActive =
      (key === "grade" && gradeId === value) ||
      (key === "subject" && subjectId === value) ||
      (key === "exam" && examId === value);
    return (
      <button
        type="button"
        key={`${key}-${value}`}
        onClick={() => update(key, value || null)}
        className={`${isActive ? "filter-pill filter-pill-active" : "filter-pill"} ${extraClassName}`.trim()}
      >
        {label}
      </button>
    );
  };

  if (variant === "sidebar") {
    return (
      <div className="premium-panel space-y-6 p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
            <Filter className="h-4 w-4 text-primary" />
            Bộ lọc
          </h3>
          {hasFilter ? (
            <Link
              href={basePath}
              scroll={false}
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-fg transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Xóa lọc
            </Link>
          ) : null}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Khối lớp
          </h3>
          <div className="grid grid-cols-3 gap-1.5">
            {sortedGrades.map((g) => pill("grade", String(g.id), g.name, pillGrade))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Môn học
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((s) => pill("subject", String(s.id), s.name, pillWrapRow))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Mục tiêu / Kỳ thi
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {exams.map((e) => pill("exam", String(e.id), e.name, pillWrapRow))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-panel p-3">
      <div className="mb-2 flex items-center gap-1 text-sm font-medium text-muted">
        <Filter className="h-4 w-4 text-primary" />
        Bộ lọc nhanh
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-muted">
          <span>Khối lớp</span>
          <select
            value={gradeId}
            onChange={(e) => update("grade", e.target.value || null)}
            className="filter-pill min-h-11 w-full cursor-pointer appearance-none bg-right pr-8"
            aria-label="Chọn khối lớp"
          >
            <option value="">Tất cả</option>
            {sortedGrades.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-muted">
          <span>Môn học</span>
          <select
            value={subjectId}
            onChange={(e) => update("subject", e.target.value || null)}
            className="filter-pill min-h-11 w-full cursor-pointer appearance-none bg-right pr-8"
            aria-label="Chọn môn học"
          >
            <option value="">Tất cả</option>
            {subjects.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-muted sm:col-span-2">
          <span>Kỳ thi</span>
          <select
            value={examId}
            onChange={(e) => update("exam", e.target.value || null)}
            className="filter-pill min-h-11 w-full cursor-pointer appearance-none bg-right pr-8"
            aria-label="Chọn kỳ thi"
          >
            <option value="">Tất cả</option>
            {exams.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {hasFilter ? (
        <Link
          href={basePath}
          scroll={false}
          prefetch={false}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border border-line px-3 py-2 text-sm font-medium text-fg transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Xóa lọc
        </Link>
      ) : null}
    </div>
  );
}

