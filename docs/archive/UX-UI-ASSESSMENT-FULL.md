# Đánh giá tổng thể UI – Doc2Share

Đánh giá toàn diện giao diện từ góc nhìn chuyên gia UI: design system, layout, từng khu vực chính, accessibility, responsive, và trạng thái sau các cải tiến gần đây.

---

## Tổng quan

| Tiêu chí | Đánh giá | Ghi chú |
|----------|----------|---------|
| **Design system** | ⭐⭐⭐⭐ | Một nguồn màu, semantic tokens, Tailwind map, dark mode; surface/btn đã gắn theme. |
| **Layout & cấu trúc** | ⭐⭐⭐⭐ | PublicLayout thống nhất, main/section landmarks, skip link, safe area. |
| **Trang chủ & danh sách** | ⭐⭐⭐⭐ | Hero, grid, filter, skeleton loading (trang chủ + /tai-lieu), empty state. |
| **Trang chi tiết SP** | ⭐⭐⭐⭐⭐ | Tab mobile, gallery + skeleton, reveal on scroll, sticky CTA, đánh giá/thảo luận. |
| **Auth & Checkout** | ⭐⭐⭐⭐ | i18n, form đầy đủ, success reset password, aria-live checkout. |
| **Thành phần dùng chung** | ⭐⭐⭐⭐ | DocumentCard, ImageCard, PriceCtaBlock, btn-primary/secondary, alt ảnh. |
| **Accessibility** | ⭐⭐⭐⭐ | Skip link, focus-visible, ARIA (menu, tab, modal), contrast WCAG, link underline. |
| **Responsive & mobile** | ⭐⭐⭐⭐ | Breakpoint nhất quán, sticky CTA + safe area, viewport-fit=cover. |
| **Phản hồi & loading** | ⭐⭐⭐⭐ | Skeleton (home, tai-lieu, dashboard), loading form, toaster, empty state. |

**Kết luận nhanh:** UI Doc2Share có **nền tảng vững**, design system rõ ràng, layout thống nhất, trang chi tiết sản phẩm mạnh, và **đã bổ sung đầy đủ** skip link, surface tokens, contrast, chuẩn hóa nút/alt/landmark/link, skeleton trang chủ, thông báo success reset password, safe area. Còn lại chủ yếu là **tinh chỉnh** (semantic heading, một vài empty/error state) và **mở rộng** (số liệu xã hội, mục lục trang dài).

---

## 1. Design system & tokens

### Điểm mạnh

- **Một nguồn màu**: Primary, accent, edu, border, surface đều từ CSS variables (`:root`); Tailwind chỉ tham chiếu `var(--*)`. Đổi theme chỉ cần sửa `globals.css`.
- **Semantic tokens**: `--color-action`, `--text-heading`, `--text-body`, `--surface-card`, `--border-subtle`, `--radius-button`, `--shadow-action`; component dùng theo ý nghĩa.
- **Tailwind mapping**: `surface.DEFAULT/card/muted` → `var(--surface)` (đã chuẩn hóa); `action`, `semantic.heading/body`, `border-subtle/strong`; shadow (card, cardHover, glow, premium); border-radius (xl, 2xl, 3xl).
- **Dark mode**: Biến và semantic đều ghi đè trong `@media (prefers-color-scheme: dark)`; không invert tùy tiện.
- **Motion**: `--motion-ease-premium` dùng thống nhất; `prefers-reduced-motion` tắt animation (reveal, skip link).
- **Tài liệu**: `docs/UI.md` mô tả tokens và component.

### Đã cải thiện (gần đây)

- Surface trong theme dùng `var(--surface)`, `var(--surface-card)`, `var(--surface-muted)`.
- `--muted` chỉnh để đạt contrast ≥ 4.5:1 (WCAG AA) trên nền trắng; comment trong CSS ghi rõ.

### Có thể cải thiện thêm

- Một số component vẫn dùng `text-slate-900` / `bg-primary` thay vì `text-semantic-heading` / `bg-action`; chuyển dần sẽ dễ đổi theme/contrast sau này.

---

## 2. Layout & cấu trúc trang

### Điểm mạnh

- **PublicLayout**: Mọi trang public (trang chủ, auth, terms, privacy, contact, checkout, tai-lieu, chi tiết SP) dùng chung Header + main + Footer; không lặp code, dễ thêm banner/footerSlot.
- **Header**: Sticky, backdrop-blur, **safe area top** `pt-[env(safe-area-inset-top)]`; logo, nav (Trang chủ, Tài liệu dropdown, Tủ sách, Admin nếu role), user pill; dropdown có aria-expanded, aria-haspopup, role menu/menuitem.
- **Footer**: Copyright + Điều khoản, Chính sách bảo mật, Liên hệ/FAQ.
- **Main landmark**: `id="main-content"` + `tabIndex={-1}` trên PublicLayout, admin layout, dashboard, loading (dashboard, tai-lieu) để skip link và focus nhảy đúng.
- **Skip link**: “Bỏ qua tới nội dung chính” ẩn mặc định, hiện khi focus, nhảy tới #main-content; có trong `layout.tsx`, style trong `globals.css` (position, transform, :focus, reduced-motion).

### Đã cải thiện (gần đây)

- Skip link đầy đủ (markup + CSS + target main).
- Main có id và tabIndex trên tất cả layout/loading liên quan.
- Section dashboard (Tài liệu đã mua, Quản lý thiết bị) có `aria-labelledby` + id heading.

### Có thể cải thiện thêm

- Một số section khác (admin, trang chi tiết) có thể bổ sung aria-labelledby/aria-label nếu chưa có heading rõ.

---

## 3. Trang chủ

### Điểm mạnh

- **Hero**: Gradient đa lớp, blob trang trí, badge “Neo Edu Premium”, H1 gradient, CTA “Khám phá tài liệu”, DiscoveryFilters ngay dưới.
- **Grid tài liệu**: DocumentCard đầy đủ; section “Gợi ý tài liệu” + “Xem tất cả”; empty state có icon và copy.
- **Trust strip**: Shield, BookOpen, Library, Users; premium-panel, spacing đều.
- **Loading**: **Skeleton trang chủ** (`app/loading.tsx`) với hero skeleton + grid DocumentCardSkeleton + trust strip skeleton; tránh layout shift khi vào route `/`.

### Có thể cải thiện thêm

- Số liệu xã hội (vd. “X nghìn tài liệu”, “Y nghìn học sinh”) để tăng tin cậy.

---

## 4. Trang danh sách tài liệu (/tai-lieu)

### Điểm mạnh

- Section hero + DiscoveryFilters (pills, sidebar); sort (Mới nhất, Giá); grid DocumentCard; empty state.
- **Loading**: `loading.tsx` với DocumentCardSkeleton; landmark main đầy đủ.

### Có thể cải thiện thêm

- “Hiển thị 1–12 trong Y kết quả” nếu backend hỗ trợ total/phân trang.

---

## 5. Trang chi tiết tài liệu (/tai-lieu/[id]/[slug])

### Điểm mạnh

- **Breadcrumb**: Trang chủ / Tài liệu / [Title]; truncate + tooltip.
- **Hero**: Thumbnail (alt mô tả theo title) + title + tags (grade, subject, exam).
- **Tab mobile**: Xem thử / Mô tả / Đánh giá; role tablist, aria-selected, aria-controls.
- **Preview**: PreviewGallery với skeleton shimmer; prev/next, dots.
- **Section headings**: Border-l-4 primary + icon; nhất quán.
- **Reveal on scroll**: RevealOnScroll + prefers-reduced-motion.
- **Sticky CTA mobile**: Giá + 1 nút; **safe area bottom** `paddingBottom: max(0.75rem, env(safe-area-inset-bottom))`; sidebar desktop sticky top-[5rem].
- **Đánh giá / Thảo luận / Cộng đồng**: Form, danh sách, format vi-VN.

### Đã cải thiện (gần đây)

- Alt ảnh thumbnail: “Bìa tài liệu: {title}” (hoặc fallback).

### Có thể cải thiện thêm

- Link “Nhảy tới Đánh giá” / “Nhảy tới Thảo luận” hoặc mục lục nhỏ (ưu tiên thấp).

---

## 6. Auth (login, signup, forgot-password, reset-password)

### Điểm mạnh

- PublicLayout, nội dung căn giữa; card bo góc, shadow.
- **i18n**: Chuỗi từ `t("auth.*")` / `t("common.*")`; sẵn sàng đa ngôn ngữ.
- Form: label, input, placeholder, validation, lỗi inline, nút disabled khi loading; OAuth Google (login).
- Reset password: ba trạng thái (xác thực, link không hợp lệ, form); link “Gửi lại link” → forgot-password.

### Đã cải thiện (gần đây)

- **Thông báo success sau reset password**: Redirect `/login?success=password-reset`; trang login đọc query và hiển thị banner success (emerald, role="status") với nội dung “Mật khẩu đã được đổi. Bạn có thể đăng nhập bằng mật khẩu mới.”; key i18n `auth.login.passwordResetSuccess`.

### Có thể cải thiện thêm

- Map lỗi Supabase theo field (email/password) nếu API trả về.

---

## 7. Checkout

### Điểm mạnh

- PublicLayout; VietQR, thông tin đơn, Copy, “Tôi đã thanh toán”, ảnh QR (alt “VietQR thanh toán”), tải QR; completed có thông báo + “Về Tủ sách”.
- **Accessibility**: aria-live trạng thái; thông báo cho screen reader khi completed.
- Nút “Thử lại” khi lỗi; link “Quay lại tài liệu” trong .content-prose (underline).

### Có thể cải thiện thêm

- Text “Tự động kiểm tra mỗi 12 giây”; auto redirect sau completed (tùy product).

---

## 8. Thẻ tài liệu & component dùng chung

### Điểm mạnh

- **DocumentCard**: Variant default/compact; ImageCard + PriceCtaBlock; micro-card 3D tilt (hover), shimmer; modal “Xem nhanh” focus trap, return focus.
- **ImageCard**: Ảnh bìa dùng chung, topBadge/bottomBadge, shimmer; alt từ doc.title.
- **PriceCtaBlock**: Giá + CTA; .doc-card-cta semantic; nút đủ lớn (min-h, text-base).
- **DocumentCardSkeleton**: Dùng cho loading grid (trang chủ, tai-lieu).

### Đã cải thiện (gần đây)

- Alt ảnh: ProductPageClient thumbnail, DashboardClient thư viện đều dùng mô tả có nghĩa (Bìa tài liệu / Bìa: title).

### Có thể cải thiện thêm

- Modal “Xem nhanh”: Escape đóng (nếu chưa) cho keyboard.

---

## 9. Nút & CTA

### Điểm mạnh

- **btn-primary**: bg-primary, shadow, hover, active scale; transition.
- **btn-secondary**: **Chuẩn hóa** với token theme: `bg-surface`, `text-fg`, `hover:bg-surface-muted`, `border-line`; transition; các trang (unauthorized, DocumentCard, checkout, admin, Header, v.v.) dùng thống nhất; override khi cần (vd. trang chủ “Xem tất cả” text-primary, SecureReader nền tối).
- **doc-card-cta**: Semantic --color-action, kích thước CTA đủ lớn.
- Sticky bar mobile: một CTA chính; không trùng sidebar.

---

## 10. Typography & đọc

### Điểm mạnh

- **Font**: Inter (sans), Plus Jakarta Sans (display); Vietnamese subset; body antialiased.
- **Cấp bậc**: H1 hero (text-4xl–6xl, font-display), H2 section (text-xl–2xl), H3 card (text-lg), body (text-sm/base); line-clamp title/description.
- **Số & giá**: toLocaleString("vi-VN") + "₫" nhất quán.

### Có thể cải thiện thêm

- Một số H1/H2 vẫn dùng `text-slate-900 dark:text-white`; có thể chuyển sang `text-semantic-heading` để thống nhất token.

---

## 11. Màu sắc & contrast (a11y)

### Điểm mạnh

- **Focus**: `*:focus-visible` outline 2px primary, offset 2px.
- **Contrast**: `--muted` đã chỉnh (#475569 light) đạt ≥ 4.5:1 trên nền trắng/background; comment WCAG trong globals.css.
- **Link trong nội dung**: Class **.content-prose** (terms, privacy, contact, doc/read, checkout): link có color primary, **underline**, text-underline-offset; hover đậm hơn; không chỉ dựa vào màu.
- **Lỗi**: Form dùng bg-red-50 / text-red-700 (dark tương ứng).
- **Dark mode**: Biến đổi đồng bộ.

### Đã cải thiện (gần đây)

- Kiểm tra và chỉnh --muted (WCAG AA); link trong nội dung gạch chân qua .content-prose.

---

## 12. Responsive & mobile

### Điểm mạnh

- **Breakpoint**: sm/md/lg/xl nhất quán; grid 1→2→3 cột; nav ẩn/hiện (md), sidebar (lg).
- **Sticky CTA**: Chỉ mobile; thanh gọn; **safe area bottom** cho .cta-sticky-mobile và sticky bar ProductPageClient; **viewport-fit=cover** trong `layout.tsx` (export viewport) để env(safe-area-inset-*) có hiệu lực trên iOS (notch, home indicator).
- **Header**: pt-[env(safe-area-inset-top)].
- Tab nội dung mobile (Xem thử/Mô tả/Đánh giá); touch target đủ lớn.

### Đã cải thiện (gần đây)

- Safe area cho sticky bar (header top, hai thanh bottom); viewport viewportFit: "cover".

---

## 13. Accessibility (a11y)

### Điểm mạnh

- **Skip link**: Có, ẩn → hiện khi focus, nhảy tới main.
- **Focus visible**: Outline primary toàn cục.
- **ARIA**: Menu (expanded, haspopup, menu/menuitem), tab (tablist, tab, aria-selected, aria-controls), modal (dialog, labelledby), aria-live checkout; section aria-labelledby (dashboard).
- **Ngôn ngữ**: `<html lang="vi">`.
- **Reduced motion**: Reveal, skip link, shimmer/tilt tắt khi prefers-reduced-motion.
- **Form**: Label gắn input (htmlFor/id).
- **Ảnh**: Alt có nghĩa cho thumbnail/preview (đã chuẩn hóa); ảnh trang trí/VietQR có alt phù hợp.

### Đã cải thiện (gần đây)

- Skip link; landmark main + section; alt ảnh; contrast; link underline trong nội dung.

---

## 14. Loading, lỗi, empty state

### Điểm mạnh

- **Skeleton**: Trang chủ (RootLoading), /tai-lieu, dashboard; PreviewGallery shimmer; DocumentCardSkeleton tái sử dụng.
- **Form**: Nút submit disabled + text “Đang …”; lỗi inline.
- **Checkout**: “Đang tạo đơn…”, “Đang kiểm tra…”; aria-live completed; “Thử lại” khi lỗi.
- **Empty state**: Trang chủ, grid tài liệu có copy + icon + CTA.
- **Toaster**: Sonner top-center, richColors, closeButton.

### Đã cải thiện (gần đây)

- Skeleton trang chủ; thông báo success sau reset password.

### Có thể cải thiện thêm

- Secure Reader: thêm “Thử lại” khi lỗi fetch; một số flow có thể thêm copy “Tự động kiểm tra…” (checkout).

---

## 15. Tóm tắt ưu tiên còn lại (tùy chọn)

| Ưu tiên | Nội dung |
|--------|----------|
| **Trung bình** | Chuyển dần H1/H2 sang `text-semantic-heading`; Escape đóng modal Xem nhanh; map lỗi auth theo field. |
| **Thấp** | Số liệu xã hội trang chủ; “Hiển thị 1–12 trong Y” trên /tai-lieu; mục lục/anchor trang chi tiết; “Tự động kiểm tra 12s” + auto redirect checkout; “Thử lại” Secure Reader. |

---

## Kết luận

UI Doc2Share đạt mức **chuyên nghiệp, sẵn sàng production**: design system nhất quán (tokens, surface, btn-secondary, contrast), layout thống nhất với skip link và landmark, skeleton loading trên các route chính, thông báo success sau reset password, safe area cho notch/home indicator, và accessibility được chăm chút (focus, ARIA, alt, link underline, reduced motion). Trang chi tiết sản phẩm là điểm nhấn (tab mobile, gallery, reveal, sticky CTA, đánh giá/thảo luận). Các cải thiện còn lại chủ yếu là polish và mở rộng nội dung (số liệu, mục lục, copy), không ảnh hưởng đến độ vững của UI hiện tại.
