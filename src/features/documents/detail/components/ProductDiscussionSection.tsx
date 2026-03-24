"use client";

import { MessageCircle, Send } from "lucide-react";
import type { CommentRow } from "@/features/documents/detail/types";

interface ProductDiscussionSectionProps {
    comments: CommentRow[];
    isBuyer: boolean;
    commentText: string;
    submittingComment: boolean;
    onCommentTextChange: (text: string) => void;
    onSubmit: () => void;
}

export default function ProductDiscussionSection({
    comments,
    isBuyer,
    commentText,
    submittingComment,
    onCommentTextChange,
    onSubmit,
}: ProductDiscussionSectionProps) {
    return (
        <>
            <h2 id="discussion-heading" className="flex items-center gap-2 border-l-2 border-line pl-3 text-base font-semibold text-semantic-heading">
                <MessageCircle className="h-4 w-4 text-primary" />
                Thảo luận
                {comments.length > 0 && <span className="text-sm font-normal text-muted">({comments.length})</span>}
            </h2>
            {comments.length > 0 && (
                <ul className="mt-4 space-y-3">
                    {comments.map((c) => (
                        <li key={c.id} className="rounded-xl border border-line bg-surface-muted py-3 px-4 text-sm">
                            <div className="text-fg">{c.content}</div>
                            <div className="mt-1.5 text-xs text-muted">
                                {new Date(c.created_at).toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {isBuyer && (
                <div className="mt-4 flex gap-2">
                    <input
                        type="text"
                        placeholder="Đặt câu hỏi hoặc thảo luận..."
                        value={commentText}
                        onChange={(e) => onCommentTextChange(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
                        className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg"
                    />
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={submittingComment || !commentText.trim()}
                        className="rounded-lg bg-primary p-2 text-white hover:bg-primary-700 disabled:opacity-50"
                        aria-label="Gửi"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </div>
            )}
        </>
    );
}
