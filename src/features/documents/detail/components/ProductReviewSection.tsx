"use client";

import { Star } from "lucide-react";
import type { ReviewRow } from "@/features/documents/detail/types";

interface ProductReviewSectionProps {
    reviews: ReviewRow[];
    avgRating: number | null;
    isBuyer: boolean;
    reviewRating: number;
    reviewComment: string;
    submittingReview: boolean;
    onRatingChange: (n: number) => void;
    onCommentChange: (text: string) => void;
    onSubmit: () => void;
}

export default function ProductReviewSection({
    reviews,
    avgRating,
    isBuyer,
    reviewRating,
    reviewComment,
    submittingReview,
    onRatingChange,
    onCommentChange,
    onSubmit,
}: ProductReviewSectionProps) {
    return (
        <>
            <h2 id="reviews-heading" className="flex flex-wrap items-center gap-3 border-l-2 border-line pl-3 text-base font-semibold text-semantic-heading">
                <Star className="h-4 w-4 text-primary" />
                Đánh giá
                {reviews.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                        ★ {avgRating != null ? avgRating.toFixed(1) : ""} · {reviews.length} lượt
                    </span>
                )}
            </h2>
            {reviews.length > 0 && (
                <ul className="mt-4 space-y-3">
                    {reviews.slice(0, 5).map((r) => (
                        <li key={r.id || r.user_id + r.created_at} className="flex items-start gap-3 text-sm">
                            <span className="flex shrink-0 gap-0.5 text-amber-500" aria-hidden>
                                {Array.from({ length: 5 }, (_, i) => (i < r.rating ? "★" : "☆")).join("")}
                            </span>
                            {r.comment && <span className="text-muted">{r.comment}</span>}
                        </li>
                    ))}
                </ul>
            )}
            {isBuyer && (
                <div className="mt-5 flex flex-col gap-3">
                    <div className="text-sm font-medium text-fg">Viết đánh giá của bạn</div>
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => onRatingChange(n)}
                                className={`rounded-lg p-1.5 transition ${reviewRating >= n
                                    ? "text-amber-500"
                                    : "text-border-subtle hover:text-amber-400 dark:hover:text-amber-500"
                                    }`}
                                aria-label={`${n} sao`}
                            >
                                <Star className="h-6 w-6 fill-current" />
                            </button>
                        ))}
                    </div>
                    <textarea
                        placeholder="Nhận xét (tùy chọn)"
                        value={reviewComment}
                        onChange={(e) => onCommentChange(e.target.value)}
                        className="min-h-[60px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg"
                    />
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={submittingReview}
                        className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                    >
                        Gửi đánh giá
                    </button>
                </div>
            )}
        </>
    );
}
