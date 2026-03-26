"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProductPageClientProps, ReviewRow, CommentRow } from "@/features/documents/detail/types";

type ScrollTargetId = "panel-reviews" | "panel-discussion";

export function useProductPageState({
    doc,
    reviews = [],
    comments = [],
}: ProductPageClientProps) {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [user, setUser] = useState<{ id: string } | null>(null);
    const [reviewsList, setReviewsList] = useState<ReviewRow[]>(reviews);
    const [commentsList, setCommentsList] = useState<CommentRow[]>(comments);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState("");
    const [commentText, setCommentText] = useState("");
    const [submittingReview, setSubmittingReview] = useState(false);
    const [submittingComment, setSubmittingComment] = useState(false);
    const [mobileTab, setMobileTab] = useState<"preview" | "description" | "reviews">("preview");
    const [pendingScrollTo, setPendingScrollTo] = useState<ScrollTargetId | null>(null);
    const supabase = createClient();

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user: u } }) => {
            setUser(u ?? null);
            if (!u?.id) {
                setHasPermission(false);
                return;
            }

            supabase
                .from("permissions")
                .select("id, expires_at")
                .eq("user_id", u.id)
                .eq("document_id", doc.id)
                .maybeSingle()
                .then(({ data }) => {
                    if (!data) setHasPermission(false);
                    else {
                        const expired = data.expires_at != null && new Date(data.expires_at) <= new Date();
                        setHasPermission(!expired);
                    }
                });
        });
    }, [doc.id, supabase]);

    useEffect(() => {
        if (!pendingScrollTo) return;
        if (pendingScrollTo === "panel-reviews" && mobileTab !== "reviews") return;

        const el = document.getElementById(pendingScrollTo);
        if (!el) return;

        const prefersReducedMotion =
            typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

        el.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "start",
        });

        setPendingScrollTo(null);
    }, [pendingScrollTo, mobileTab]);

    const jumpToSection = (target: ScrollTargetId) => {
        if (typeof window === "undefined") return;
        if (target === "panel-reviews" && mobileTab !== "reviews") {
            setMobileTab("reviews");
        }
        setPendingScrollTo(target);
    };

    const canRead = hasPermission === true;
    const isBuyer = hasPermission === true;
    const avgRating = reviewsList.length ? reviewsList.reduce((a, r) => a + r.rating, 0) / reviewsList.length : null;

    async function submitReview() {
        if (!user?.id || !doc.id || submittingReview) return;
        setSubmittingReview(true);
        const nowIso = new Date().toISOString();
        const { error } = await supabase.from("document_reviews").upsert(
            { user_id: user.id, document_id: doc.id, rating: reviewRating, comment: reviewComment || null, created_at: nowIso },
            { onConflict: "user_id,document_id" }
        );
        setSubmittingReview(false);
        if (!error) {
            setReviewsList((prev) => [
                { id: "", user_id: user.id, rating: reviewRating, comment: reviewComment || null, created_at: nowIso },
                ...prev.filter((r) => r.user_id !== user.id),
            ]);
            setReviewComment("");
        }
    }

    async function submitComment() {
        if (!user?.id || !doc.id || !commentText.trim() || submittingComment) return;
        setSubmittingComment(true);
        const { data, error } = await supabase
            .from("document_comments")
            .insert({ document_id: doc.id, user_id: user.id, content: commentText.trim() })
            .select("id, user_id, content, created_at")
            .single();
        setSubmittingComment(false);
        if (!error && data) {
            setCommentsList((prev) => [...prev, data as CommentRow]);
            setCommentText("");
        }
    }

    return {
        user,
        canRead,
        isBuyer,
        avgRating,
        mobileTab,
        setMobileTab,
        jumpToSection,
        // Reviews
        reviewsList,
        reviewRating,
        setReviewRating,
        reviewComment,
        setReviewComment,
        submittingReview,
        submitReview,
        // Comments
        commentsList,
        commentText,
        setCommentText,
        submittingComment,
        submitComment,
    };
}
