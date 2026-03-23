"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { Category } from "@/lib/types";
import { Filter, RotateCcw } from "lucide-react";

interface Props {
  grades: Category[];
  subjects: Category[];
  exams: Category[];
  basePath: string;
  variant?: "pills" | "sidebar";
}

export default function DiscoveryFilters({ grades, subjects, exams, basePath, variant = "pills" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`${basePath}?${next.toString()}`);
    },
    [router, searchParams, basePath]
  );

  const gradeId = searchParams.get("grade") || "";
  const subjectId = searchParams.get("subject") || "";
  const examId = searchParams.get("exam") || "";
  const hasFilter = Boolean(gradeId || subjectId || examId);
  const clearAll = useCallback(() => {
    router.push(basePath);
  }, [router, basePath]);

  const pill = (key: string, value: string, label: string) => {
    const isActive = (key === "grade" && gradeId === value) || (key === "subject" && subjectId === value) || (key === "exam" && examId === value);
    return (
      <button
        type="button"
        key={`${key}-${value}`}
        onClick={() => update(key, value || null)}
        className={isActive ? "filter-pill filter-pill-active" : "filter-pill"}
      >
        {label}
      </button>
    );
  };

  if (variant === "sidebar") {
    return (
      <aside className="premium-panel space-y-6 p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
            <Filter className="h-4 w-4 text-primary" />
            Bộ lọc
          </h3>
          {hasFilter ? (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface-muted"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          ) : null}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Khối lớp
          </h3>
          <div className="flex flex-wrap gap-2">
            {grades.map((g) => pill("grade", String(g.id), g.name))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Môn học
          </h3>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => pill("subject", String(s.id), s.name))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Mục tiêu / Kỳ thi
          </h3>
          <div className="flex flex-wrap gap-2">
            {exams.map((e) => pill("exam", String(e.id), e.name))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <div className="premium-panel flex flex-wrap items-center gap-2 p-3">
      <span className="mr-1 flex items-center gap-1 text-sm font-medium text-muted">
        <Filter className="h-4 w-4 text-primary" />
        Khối lớp:
      </span>
      <select
        value={gradeId}
        onChange={(e) => update("grade", e.target.value || null)}
        className="filter-pill cursor-pointer appearance-none bg-right pr-8"
        aria-label="Chọn khối lớp"
      >
        <option value="">Tất cả</option>
        {grades.map((g) => (
          <option key={g.id} value={String(g.id)}>{g.name}</option>
        ))}
      </select>
      <span className="mx-2 text-border-subtle">|</span>
      <span className="mr-1 text-sm font-medium text-muted">Môn:</span>
      <select
        value={subjectId}
        onChange={(e) => update("subject", e.target.value || null)}
        className="filter-pill cursor-pointer appearance-none bg-right pr-8"
        aria-label="Chọn môn học"
      >
        <option value="">Tất cả</option>
        {subjects.map((s) => (
          <option key={s.id} value={String(s.id)}>{s.name}</option>
        ))}
      </select>
      <span className="mx-2 text-border-subtle">|</span>
      <span className="mr-1 text-sm font-medium text-muted">Kỳ thi:</span>
      <select
        value={examId}
        onChange={(e) => update("exam", e.target.value || null)}
        className="filter-pill cursor-pointer appearance-none bg-right pr-8"
        aria-label="Chọn kỳ thi"
      >
        <option value="">Tất cả</option>
        {exams.map((e) => (
          <option key={e.id} value={String(e.id)}>{e.name}</option>
        ))}
      </select>
      {hasFilter ? (
        <button
          type="button"
          onClick={clearAll}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Xóa lọc
        </button>
      ) : null}
    </div>
  );
}
