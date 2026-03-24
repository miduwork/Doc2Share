import type { ReactNode } from "react";
import Header from "@/features/layout/components/Header";
import Footer from "@/features/layout/components/Footer";

type PublicLayoutProps = {
  children: ReactNode;
  /** Optional banner above main content (e.g. campaign, announcement) */
  banner?: ReactNode;
  /** Optional slot below footer (e.g. legal, partner links) */
  footerSlot?: ReactNode;
};

/**
 * Layout chung cho trang public: Header + (banner) + main + Footer + (footerSlot).
 * Dùng nhất quán để dễ thêm banner/footer toàn cục và tích hợp.
 */
export default function PublicLayout({ children, banner, footerSlot }: PublicLayoutProps) {
  return (
    <div className="app-shell flex min-h-screen flex-col bg-surface">
      <Header />
      {banner ?? null}
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      {footerSlot ?? null}
    </div>
  );
}

