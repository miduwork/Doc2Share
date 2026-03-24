"use client";

import Link from "next/link";
import { Share2, Shield } from "lucide-react";
import type { ProductPageDoc } from "../types";

interface ProductHeroProps {
    doc: ProductPageDoc;
}

export default function ProductHero({ doc }: ProductHeroProps) {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const shareToFacebook = () => {
        if (typeof window === "undefined") return;
        window.open(
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
            "_blank",
            "width=600,height=400"
        );
    };

    return (
        <>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                {doc.thumbnail_url && (
                    <div className="shrink-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-card sm:w-52 lg:w-56 sm:rounded-2xl">
                        {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail URL */}
                        <img
                            src={doc.thumbnail_url}
                            alt={doc.title ? `Bìa tài liệu: ${doc.title}` : "Bìa tài liệu"}
                            className="aspect-[4/3] w-full object-cover"
                            loading="eager"
                            decoding="async"
                            fetchPriority="high"
                            width={560}
                            height={420}
                        />
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <h1 className="font-display text-3xl font-bold tracking-tight text-semantic-heading sm:text-4xl">
                        {doc.title}
                    </h1>
                    {(doc.grade || doc.subject || doc.exam) && (
                        <div className="mt-1.5 text-sm text-muted" aria-hidden>
                            {[doc.grade?.name, doc.subject?.name, doc.exam?.name].filter(Boolean).join(" · ")}
                        </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                        {doc.grade && (
                            <span className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 dark:border-primary-700 dark:bg-primary-900 dark:text-primary-300">
                                {doc.grade.name}
                            </span>
                        )}
                        {doc.subject && (
                            <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-sm font-medium text-fg">
                                {doc.subject.name}
                            </span>
                        )}
                        {doc.exam && (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                {doc.exam.name}
                            </span>
                        )}
                    </div>
                </div>
            </header>

            <div className="flex flex-wrap items-center gap-3 border-b border-line pb-6 text-sm text-muted">
                <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4 shrink-0 text-primary" />
                    Xem online bảo mật, tối đa 2 thiết bị
                </span>
                <span aria-hidden className="text-border-subtle">·</span>
                <span>{doc.is_downloadable ? "Có thể tải về" : "Chỉ xem online"}</span>
                <span aria-hidden className="text-border-subtle">·</span>
                <button
                    type="button"
                    onClick={shareToFacebook}
                    className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-fg transition hover:bg-surface-muted"
                >
                    <Share2 className="h-4 w-4" />
                    Chia sẻ
                </button>
            </div>
        </>
    );
}
