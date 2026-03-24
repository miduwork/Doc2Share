"use client";

import Link from "next/link";
import { BadgeCheck, Clock3, ShieldCheck, ShoppingCart } from "lucide-react";

interface ProductSidebarCTAProps {
    price: number;
    isDownloadable: boolean;
    ctaButton: React.ReactNode;
    onJumpToReviews: () => void;
    onJumpToDiscussion: () => void;
}

export default function ProductSidebarCTA({
    price,
    isDownloadable,
    ctaButton,
    onJumpToReviews,
    onJumpToDiscussion,
}: ProductSidebarCTAProps) {
    return (
        <div className="premium-panel sticky top-[5rem] rounded-3xl border border-line p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.12)] dark:shadow-none sm:shadow-cardHover">
            <div className="text-sm font-medium text-muted">Giá</div>
            <div className="mt-0.5 text-3xl font-bold tracking-tight text-primary dark:text-primary-400">
                {price.toLocaleString("vi-VN")} ₫
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted">
                <ShoppingCart className="h-4 w-4 shrink-0" />
                {isDownloadable ? "Xem online & tải về" : "Chỉ xem online"}
            </div>
            <div className="mt-6 space-y-3">
                {ctaButton}
            </div>
            <div className="mt-6 rounded-2xl border border-line bg-surface-muted p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-fg">Mục lục sắp có</div>
                <div className="mt-3 flex flex-col gap-2">
                    <a
                        href="#panel-reviews"
                        onClick={(e) => {
                            e.preventDefault();
                            onJumpToReviews();
                        }}
                        className="text-sm font-medium text-primary hover:underline"
                    >
                        Đánh giá
                    </a>
                    <a
                        href="#panel-discussion"
                        onClick={(e) => {
                            e.preventDefault();
                            onJumpToDiscussion();
                        }}
                        className="text-sm font-medium text-primary hover:underline"
                    >
                        Thảo luận
                    </a>
                </div>
            </div>
            <div className="mt-6 space-y-3 rounded-2xl border border-line bg-surface-muted p-4 text-sm text-muted">
                <div className="text-xs font-semibold uppercase tracking-wider text-fg">An tâm mua</div>
                <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    Bản quyền được bảo vệ và theo dõi truy cập
                </div>
                <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    Kích hoạt quyền xem gần như ngay lập tức
                </div>
                <div className="flex items-start gap-3">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    Hỗ trợ khi gặp lỗi truy cập hoặc thanh toán
                </div>
            </div>
        </div>
    );
}
