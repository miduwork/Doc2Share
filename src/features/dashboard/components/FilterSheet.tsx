"use client";

import { X, Filter } from "lucide-react";
import type { Category } from "@/lib/types";
import DiscoveryFilters from "@/features/documents/list/components/DiscoveryFilters";

interface FilterSheetProps {
    open: boolean;
    onClose: () => void;
    grades: Category[];
    subjects: Category[];
    exams: Category[];
}

export default function FilterSheet({ open, onClose, grades, subjects, exams }: FilterSheetProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-labelledby="tu-sach-filters-title">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div
                className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-line bg-surface p-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3">
                    <h3 id="tu-sach-filters-title" className="flex items-center gap-2 text-base font-semibold text-semantic-heading">
                        <Filter className="h-4 w-4 text-primary" />
                        Bộ lọc
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-muted transition hover:bg-surface-muted hover:text-primary"
                        aria-label="Đóng bộ lọc"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-3 max-h-[70vh] overflow-auto rounded-2xl">
                    <DiscoveryFilters basePath="/tu-sach" grades={grades} subjects={subjects} exams={exams} />
                </div>
            </div>
        </div>
    );
}
