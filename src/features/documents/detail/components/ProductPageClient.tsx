"use client";

import { useMemo } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { slugify } from "@/lib/seo";

import type { ProductPageClientProps } from "@/features/documents/detail/types";
import { useProductPageState } from "@/features/documents/detail/hooks/useProductPageState";
import type { PreviewSlide } from "./PreviewGallery";
import PreviewGallery from "./PreviewGallery";
import RevealOnScroll from "@/features/documents/shared/components/RevealOnScroll";

import ProductHero from "./ProductHero";
import ProductReviewSection from "./ProductReviewSection";
import ProductDiscussionSection from "./ProductDiscussionSection";
import ProductSidebarCTA from "./ProductSidebarCTA";

const COMMUNITY_ZALO = process.env.NEXT_PUBLIC_COMMUNITY_ZALO || "";
const COMMUNITY_TELEGRAM = process.env.NEXT_PUBLIC_COMMUNITY_TELEGRAM || "";

export default function ProductPageClient(props: ProductPageClientProps) {
  const { doc } = props;
  const state = useProductPageState(props);

  const previewSlides: PreviewSlide[] = useMemo(() => {
    if (!doc.preview_url) return [];
    const isPdf = doc.preview_url.toLowerCase().endsWith(".pdf") || doc.preview_url.toLowerCase().includes(".pdf?");
    if (isPdf) return [{ type: "pdf", url: doc.preview_url }];
    const imageSlides: PreviewSlide[] = [];
    if (doc.thumbnail_url && doc.thumbnail_url !== doc.preview_url) {
      imageSlides.push({ type: "image", url: doc.thumbnail_url });
    }
    imageSlides.push({ type: "image", url: doc.preview_url });
    return imageSlides;
  }, [doc.preview_url, doc.thumbnail_url]);

  const ctaButton = !state.user ? (
    <Link href={`/login?redirect=${encodeURIComponent(`/cua-hang/${doc.id}/${slugify(doc.title)}`)}`} className="btn-primary w-full py-3.5 text-base">
      Đăng nhập để mua
    </Link>
  ) : state.canRead ? (
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
            <Link href="/cua-hang" className="transition hover:text-primary">Cửa hàng</Link>
          </li>
          <li aria-hidden="true" className="text-border-subtle">/</li>
          <li className="max-w-[min(100%,20rem)] truncate text-semantic-heading font-medium sm:max-w-md" aria-current="page" title={doc.title}>
            {doc.title}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-4">
        <div className="reveal-section lg:col-span-3 space-y-8">
          <ProductHero doc={doc} />

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
                  aria-selected={state.mobileTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => state.setMobileTab(tab.id)}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition ${state.mobileTab === tab.id
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted hover:bg-surface-muted"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="md:hidden mt-3">
            <div className="flex gap-2">
              <a
                href="#panel-reviews"
                onClick={(e) => {
                  e.preventDefault();
                  state.jumpToSection("panel-reviews");
                }}
                className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-center text-sm font-semibold text-fg transition hover:bg-surface-muted"
              >
                Nhảy tới Đánh giá
              </a>
              <a
                href="#panel-discussion"
                onClick={(e) => {
                  e.preventDefault();
                  state.jumpToSection("panel-discussion");
                }}
                className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-center text-sm font-semibold text-fg transition hover:bg-surface-muted"
              >
                Nhảy tới Thảo luận
              </a>
            </div>
          </div>

          <RevealOnScroll>
            <section
              id="panel-preview"
              aria-labelledby="preview-heading"
              aria-hidden={state.mobileTab !== "preview"}
              className={`premium-panel p-6 sm:p-8 ring-1 ring-primary/10 shadow-cardHover ${state.mobileTab !== "preview" ? "hidden" : ""} md:!block`}
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
                <div className="mt-4 max-h-44 overflow-y-auto rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-muted whitespace-pre-line">
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
                aria-hidden={state.mobileTab !== "description"}
                className={`premium-panel p-5 ${state.mobileTab !== "description" ? "hidden md:!block" : "md:!block"}`}
              >
                <h2 id="description-heading" className="border-l-2 border-line pl-3 text-base font-semibold text-semantic-heading">
                  Mô tả
                </h2>
                <div className="mt-3 whitespace-pre-wrap leading-relaxed text-muted">{doc.description}</div>
              </section>
            </RevealOnScroll>
          )}

          <RevealOnScroll>
            <section
              id="panel-reviews"
              className={`reveal-section reveal-delay-1 premium-panel p-5 scroll-mt-[5rem] ${state.mobileTab !== "reviews" ? "hidden" : ""} md:!block`}
              aria-labelledby="reviews-heading"
              aria-hidden={state.mobileTab !== "reviews"}
            >
              <ProductReviewSection
                reviews={state.reviewsList}
                avgRating={state.avgRating}
                isBuyer={state.isBuyer}
                reviewRating={state.reviewRating}
                reviewComment={state.reviewComment}
                submittingReview={state.submittingReview}
                onRatingChange={state.setReviewRating}
                onCommentChange={state.setReviewComment}
                onSubmit={state.submitReview}
              />
            </section>
          </RevealOnScroll>

          <RevealOnScroll>
            <section id="panel-discussion" className="premium-panel p-5 scroll-mt-[5rem]" aria-labelledby="discussion-heading">
              <ProductDiscussionSection
                comments={state.commentsList}
                isBuyer={state.isBuyer}
                commentText={state.commentText}
                submittingComment={state.submittingComment}
                onCommentTextChange={state.setCommentText}
                onSubmit={state.submitComment}
              />
            </section>
          </RevealOnScroll>

          {(COMMUNITY_ZALO || COMMUNITY_TELEGRAM) && (
            <RevealOnScroll>
              <section className="premium-panel p-5" aria-labelledby="community-heading">
                <h2 id="community-heading" className="border-l-2 border-line pl-3 text-base font-semibold text-semantic-heading">
                  Tham gia cộng đồng
                </h2>
                <div className="mt-1 text-sm text-muted">Hỏi đáp, nhận đề mới và mã giảm giá qua nhóm.</div>
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

        <div className="reveal-section reveal-delay-2 hidden md:block lg:col-span-1">
          <ProductSidebarCTA
            price={doc.price}
            isDownloadable={doc.is_downloadable ?? false}
            ctaButton={ctaButton}
            onJumpToReviews={() => state.jumpToSection("panel-reviews")}
            onJumpToDiscussion={() => state.jumpToSection("panel-discussion")}
          />
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur md:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
        aria-label="Mua tài liệu"
      >
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold tracking-tight text-primary dark:text-primary-400">
            {doc.price.toLocaleString("vi-VN")} ₫
          </div>
          <div className="text-xs text-muted">{doc.is_downloadable ? "Xem & tải về" : "Chỉ xem online"}</div>
        </div>
        <div className="w-full max-w-[200px] shrink-0">{ctaButton}</div>
      </div>
    </div>
  );
}
