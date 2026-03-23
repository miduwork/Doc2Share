"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/seo";
import { Shield, FileText, ShoppingCart, Star, Share2, MessageCircle, Send, ShieldCheck, Clock3, BadgeCheck } from "lucide-react";
import PreviewGallery, { type PreviewSlide } from "./PreviewGallery";
import RevealOnScroll from "@/components/RevealOnScroll";

interface Doc {
  id: string;
  title: string;
  description: string | null;
  price: number;
  preview_url: string | null;
  preview_text: string | null;
  thumbnail_url?: string | null;
  is_downloadable: boolean;
  subject: { id: number; name: string } | null;
  grade: { id: number; name: string } | null;
  exam: { id: number; name: string } | null;
}

interface ReviewRow {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface CommentRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

const COMMUNITY_ZALO = process.env.NEXT_PUBLIC_COMMUNITY_ZALO || "";
const COMMUNITY_TELEGRAM = process.env.NEXT_PUBLIC_COMMUNITY_TELEGRAM || "";

export default function ProductPageClient({
  doc,
  reviews = [],
  comments = [],
}: {
  doc: Doc;
  reviews?: ReviewRow[];
  comments?: CommentRow[];
}) {
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

  const canRead = hasPermission === true;
  const isBuyer = hasPermission === true;
  const avgRating = reviewsList.length ? reviewsList.reduce((a, r) => a + r.rating, 0) / reviewsList.length : null;

  const previewSlides: PreviewSlide[] = useMemo(() => {
    if (!doc.preview_url) return [];
    const isPdf =
      doc.preview_url.toLowerCase().endsWith(".pdf") || doc.preview_url.toLowerCase().includes(".pdf?");
    if (isPdf) return [{ type: "pdf", url: doc.preview_url }];
    const imageSlides: PreviewSlide[] = [];
    if (doc.thumbnail_url && doc.thumbnail_url !== doc.preview_url) {
      imageSlides.push({ type: "image", url: doc.thumbnail_url });
    }
    imageSlides.push({ type: "image", url: doc.preview_url });
    return imageSlides;
  }, [doc.preview_url, doc.thumbnail_url]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareToFacebook = () => {
    if (typeof window === "undefined") return;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400"
    );
  };

  async function submitReview() {
    if (!user?.id || !doc.id || submittingReview) return;
    setSubmittingReview(true);
    const { error } = await supabase.from("document_reviews").upsert(
      { user_id: user.id, document_id: doc.id, rating: reviewRating, comment: reviewComment || null },
      { onConflict: "user_id,document_id" }
    );
    setSubmittingReview(false);
    if (!error) {
      setReviewsList((prev) => [
        { id: "", user_id: user.id, rating: reviewRating, comment: reviewComment || null, created_at: new Date().toISOString() },
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

  const ctaButton = !user ? (
    <Link href={`/login?redirect=${encodeURIComponent(`/tai-lieu/${doc.id}/${slugify(doc.title)}`)}`} className="btn-primary w-full py-3.5 text-base">
      Đăng nhập để mua
    </Link>
  ) : canRead ? (
    <Link href={`/doc/${doc.id}/read`} className="flex w-full items-center justify-center rounded-xl bg-edu-green py-3.5 text-base font-semibold text-white shadow-card transition hover:opacity-90">
      Đọc tài liệu
    </Link>
  ) : (
    <Link href={`/checkout?document_id=${doc.id}`} className="btn-primary w-full py-3.5 text-base">
      Mua ngay
    </Link>
  );

  return (
    <div className="section-container pb-24 py-8 sm:py-10 md:pb-8">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
          <li>
            <Link href="/" className="transition hover:text-primary">Trang chủ</Link>
          </li>
          <li aria-hidden="true" className="text-border-subtle">/</li>
          <li>
            <Link href="/tai-lieu" className="transition hover:text-primary">Tài liệu</Link>
          </li>
          <li aria-hidden="true" className="text-border-subtle">/</li>
          <li className="max-w-[min(100%,20rem)] truncate text-semantic-heading font-medium sm:max-w-md" aria-current="page" title={doc.title}>{doc.title}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-4">
        <div className="reveal-section lg:col-span-3 space-y-8">
          {/* Hero: tiêu đề + ảnh bìa nhỏ + tags – dễ nhận diện, rõ hierarchy */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            {doc.thumbnail_url && (
              <div className="shrink-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-card sm:w-52 lg:w-56 sm:rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail URL */}
                <img src={doc.thumbnail_url} alt={doc.title ? `Bìa tài liệu: ${doc.title}` : "Bìa tài liệu"} className="aspect-[4/3] w-full object-cover" loading="eager" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl font-bold tracking-tight text-semantic-heading sm:text-4xl">
                {doc.title}
              </h1>
              {(doc.grade || doc.subject || doc.exam) && (
                <p className="mt-1.5 text-sm text-muted" aria-hidden>
                  {[doc.grade?.name, doc.subject?.name, doc.exam?.name].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {doc.grade && (
                  <span className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 dark:border-primary-700 dark:bg-primary-900 dark:text-primary-300">{doc.grade.name}</span>
                )}
                {doc.subject && (
                  <span className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-sm font-medium text-fg">{doc.subject.name}</span>
                )}
                {doc.exam && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">{doc.exam.name}</span>
                )}
              </div>
            </div>
          </header>

          {/* Cam kết bảo mật & chia sẻ – 1 hàng gọn dưới hero */}
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

          {/* Tab bar – chỉ mobile */}
          <div className="md:hidden" role="tablist" aria-label="Nội dung tài liệu">
            <div className="flex rounded-xl border border-line bg-surface p-1">
              {[
                { id: "preview" as const, label: "Xem thử" },
                ...(doc.description ? [{ id: "description" as const, label: "Mô tả" }] : []),
                { id: "reviews" as const, label: "Đánh giá" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={mobileTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => setMobileTab(tab.id)}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    mobileTab === tab.id
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted hover:bg-surface-muted"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Safe preview – section chính, nổi bật hơn */}
          <RevealOnScroll>
            <section
              id="panel-preview"
              aria-labelledby="preview-heading"
              aria-hidden={mobileTab !== "preview"}
              className={`premium-panel p-6 sm:p-8 ring-1 ring-primary/10 shadow-cardHover ${mobileTab !== "preview" ? "hidden" : ""} md:!block`}
            >
            <h2 id="preview-heading" className="flex items-center gap-2 border-l-4 border-primary pl-4 text-lg font-semibold text-semantic-heading">
              <FileText className="h-5 w-5 text-primary" />
              Xem thử
            </h2>
            {previewSlides.length > 0 ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
                <PreviewGallery
                  slides={previewSlides}
                  title="Bản xem thử"
                  containerClass="h-[56vh] min-h-[320px] sm:h-[68vh] sm:min-h-[540px] lg:h-[78vh] lg:min-h-[680px] lg:max-h-[960px]"
                />
              </div>
            ) : null}
            {doc.preview_text && (
              <div
                className="mt-4 max-h-44 overflow-y-auto rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-muted whitespace-pre-line"
              >
                {doc.preview_text.slice(0, 2000)}
              </div>
            )}
            </section>
          </RevealOnScroll>

          {doc.description && (
            <RevealOnScroll>
              <section
                id="panel-description"
                aria-labelledby="description-heading"
                aria-hidden={mobileTab !== "description"}
                className={`premium-panel p-5 ${mobileTab !== "description" ? "hidden md:!block" : "md:!block"}`}
              >
                <h2 id="description-heading" className="border-l-2 border-line pl-3 text-base font-semibold text-semantic-heading">
                  Mô tả
                </h2>
                <p className="mt-3 whitespace-pre-wrap leading-relaxed text-muted">{doc.description}</p>
              </section>
            </RevealOnScroll>
          )}

          {/* Đánh giá – ẩn trên mobile khi tab khác; luôn hiện từ md */}
          <RevealOnScroll>
          <section
            id="panel-reviews"
            className={`reveal-section reveal-delay-1 premium-panel p-5 ${mobileTab !== "reviews" ? "hidden" : ""} md:!block`}
            aria-labelledby="reviews-heading"
            aria-hidden={mobileTab !== "reviews"}
          >
            <h2 id="reviews-heading" className="flex flex-wrap items-center gap-3 border-l-2 border-line pl-3 text-base font-semibold text-semantic-heading">
              <Star className="h-4 w-4 text-primary" />
              Đánh giá
              {reviewsList.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  ★ {avgRating != null ? avgRating.toFixed(1) : ""} · {reviewsList.length} lượt
                </span>
              )}
            </h2>
            {reviewsList.length > 0 && (
              <ul className="mt-4 space-y-3">
                {reviewsList.slice(0, 5).map((r) => (
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
                <p className="text-sm font-medium text-fg">Viết đánh giá của bạn</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewRating(n)}
                      className={`rounded-lg p-1.5 transition ${reviewRating >= n ? "text-amber-500" : "text-border-subtle hover:text-amber-400 dark:hover:text-amber-500"}`}
                      aria-label={`${n} sao`}
                    >
                      <Star className="h-6 w-6 fill-current" />
                    </button>
                  ))}
                </div>
                <textarea
                  placeholder="Nhận xét (tùy chọn)"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="min-h-[60px] w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg"
                />
                <button
                  type="button"
                  onClick={submitReview}
                  disabled={submittingReview}
                  className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  Gửi đánh giá
                </button>
              </div>
            )}
          </section>
          </RevealOnScroll>

          {/* Thảo luận */}
          <RevealOnScroll>
          <section className="premium-panel p-5" aria-labelledby="discussion-heading">
            <h2 id="discussion-heading" className="flex items-center gap-2 border-l-2 border-line pl-3 text-base font-semibold text-semantic-heading">
              <MessageCircle className="h-4 w-4 text-primary" />
              Thảo luận
              {commentsList.length > 0 && (
                <span className="text-sm font-normal text-muted">({commentsList.length})</span>
              )}
            </h2>
            {commentsList.length > 0 && (
              <ul className="mt-4 space-y-3">
                {commentsList.map((c) => (
                  <li key={c.id} className="rounded-xl border border-line bg-surface-muted py-3 px-4 text-sm">
                    <p className="text-fg">{c.content}</p>
                    <p className="mt-1.5 text-xs text-muted">{new Date(c.created_at).toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" })}</p>
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
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitComment()}
                  className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg"
                />
                <button
                  type="button"
                  onClick={submitComment}
                  disabled={submittingComment || !commentText.trim()}
                  className="rounded-lg bg-primary p-2 text-white hover:bg-primary-700 disabled:opacity-50"
                  aria-label="Gửi"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>
          </RevealOnScroll>

          {/* Cộng đồng Zalo/Telegram */}
          {(COMMUNITY_ZALO || COMMUNITY_TELEGRAM) && (
            <RevealOnScroll>
            <section className="premium-panel p-5" aria-labelledby="community-heading">
              <h2 id="community-heading" className="border-l-2 border-line pl-3 text-base font-semibold text-semantic-heading">
                Tham gia cộng đồng
              </h2>
              <p className="mt-1 text-sm text-muted">Hỏi đáp, nhận đề mới và mã giảm giá qua nhóm.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {COMMUNITY_ZALO && (
                  <a
                    href={COMMUNITY_ZALO}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Nhóm Zalo
                  </a>
                )}
                {COMMUNITY_TELEGRAM && (
                  <a
                    href={COMMUNITY_TELEGRAM}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
                  >
                    Telegram
                  </a>
                )}
              </div>
            </section>
            </RevealOnScroll>
          )}
        </div>

        {/* Sidebar CTA – từ md (mobile dùng sticky bar cố định chân) */}
        <div className="reveal-section reveal-delay-2 hidden md:block lg:col-span-1">
          <div className="premium-panel sticky top-[5rem] rounded-3xl border border-line p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.12)] dark:shadow-none sm:shadow-cardHover">
            <p className="text-sm font-medium text-muted">Giá</p>
            <p className="mt-0.5 text-3xl font-bold tracking-tight text-primary dark:text-primary-400">
              {doc.price.toLocaleString("vi-VN")} ₫
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <ShoppingCart className="h-4 w-4 shrink-0" />
              {doc.is_downloadable ? "Xem online & tải về" : "Chỉ xem online"}
            </p>
            <div className="mt-6 space-y-3">
              {ctaButton}
            </div>
            <div className="mt-8 space-y-3 rounded-2xl border border-line bg-surface-muted p-4 text-sm text-muted">
              <p className="text-xs font-semibold uppercase tracking-wider text-fg">An tâm mua</p>
              <p className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Bản quyền được bảo vệ và theo dõi truy cập
              </p>
              <p className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Kích hoạt quyền xem gần như ngay lập tức
              </p>
              <p className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Hỗ trợ khi gặp lỗi truy cập hoặc thanh toán
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky "Mua ngay" – chỉ mobile, cố định chân trang */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur md:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
        aria-label="Mua tài liệu"
      >
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold tracking-tight text-primary dark:text-primary-400">
            {doc.price.toLocaleString("vi-VN")} ₫
          </p>
          <p className="text-xs text-muted">
            {doc.is_downloadable ? "Xem & tải về" : "Chỉ xem online"}
          </p>
        </div>
        <div className="w-full max-w-[200px] shrink-0">
          {ctaButton}
        </div>
      </div>
    </div>
  );
}
