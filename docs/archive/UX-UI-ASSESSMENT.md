# Đánh giá UI – Doc2Share (Cập nhật)

Đánh giá chi tiết giao diện từ góc nhìn chuyên gia UI: design system, layout, từng khu vực, accessibility, và đề xuất cải thiện theo hiện trạng codebase.

---

## 1. Design system & tokens

### Điểm mạnh

- **Một nguồn màu**: Toàn bộ primary, accent, edu đều từ CSS variables (`:root`); Tailwind chỉ tham chiếu `var(--primary)` v.v. Đổi theme chỉ cần sửa `globals.css`.
- **Semantic tokens**: `--color-action`, `--text-heading`, `--text-body`, `--surface-card`, `--border-subtle`, `--radius-button`, `--shadow-action` giúp component dùng theo ý nghĩa, dễ bảo trì và a11y sau này.
- **Tailwind mapping đầy đủ**: `action`, `semantic.heading/body`, `surface-card`, `border-subtle/strong` trong `theme.extend.colors`; shadow (card, cardHover, glow, premium), border-radius (xl, 2xl, 3xl), `--motion-ease-premium` dùng thống nhất.
- **Dark mode**: Biến gốc và semantic đều được ghi đè trong `@media (prefers-color-scheme: dark)`; không dùng invert tùy tiện.
- **Tài liệu**: `docs/UI.md` mô tả tokens và component công khai, gợi ý dùng semantic vs token gốc.

### Cần cải thiện

- **Surface trong theme**: `surface.DEFAULT` đang hardcode `#f8fafc` thay vì `var(--surface)`; nên thống nhất với `--surface` để dark mode đúng mọi chỗ.
- **Dùng semantic chưa đồng đều**: Nhiều component vẫn dùng `text-slate-900`, `bg-primary` thay vì `text-semantic-heading`, `bg-action`. Có thể chuyển dần sang semantic để dễ đổi theme/contrast.

---

## 2. Layout & cấu trúc trang

### Điểm mạnh

- **PublicLayout thống nhất**: Mọi trang public (trang chủ, login, signup, forgot/reset password, terms, privacy, contact, unauthorized, checkout, tai-lieu, tai-lieu/[id]/[slug]) đều dùng `<PublicLayout>` với Header + main + Footer. Không lặp Header/Footer, dễ thêm banner/footerSlot sau này.
- **Header**: Sticky, backdrop-blur, logo + nav (Trang chủ, Tài liệu dropdown, Tủ sách, Admin nếu role) + Đăng nhập/Đăng ký hoặc user pill. Dropdown Tài liệu có aria-expanded, aria-haspopup, role="menu"/menuitem; click và hover đều mở được.
- **Footer**: Copyright + link Điều khoản, Chính sách bảo mật, Liên hệ/FAQ; đủ cho tin cậy và hỗ trợ.
- **App shell**: `app-shell` (min-h-screen, bg, text) + PublicLayout dùng `bg-surface`; body dùng `--foreground`/`--background`, font Inter + Plus Jakarta (display).

### Cần cải thiện

- **Main landmark**: Một số trang có nhiều `<section>` trong main nhưng không có `aria-label` hoặc heading cho từng vùng; có thể bổ sung cho screen reader và SEO.
- **Skip link**: Chưa có “Skip to main content” cho keyboard user; nên thêm một link ẩn đầu trang, focus khi Tab.

---

## 3. Trang chủ

### Điểm mạnh

- **Hero**: Gradient đa lớp (primary, emerald, accent nhạt), blob trang trí, badge “Neo Edu Premium”, H1 với gradient chữ, CTA “Khám phá tài liệu”, bộ lọc DiscoveryFilters ngay dưới. Hierarchy rõ, CTA nổi bật.
- **Grid tài liệu**: DocumentCard đầy đủ (ảnh, meta, giá, CTA); section “Gợi ý tài liệu” + link “Xem tất cả”. Empty state có icon và copy.
- **Trust strip**: Shield, BookOpen, Library, Users với copy ngắn; premium-panel, spacing đều.

### Cần cải thiện

- **Skeleton**: Khi fetch docs chưa có skeleton grid; có DocumentCardSkeleton nhưng trang chủ chưa dùng. Có thể dùng skeleton khi `!docs && loading`.
- **Số liệu xã hội**: Chưa có testimonial hoặc số (kiểu “X nghìn tài liệu”, “Y nghìn học sinh”); thêm sẽ tăng tin cậy.

---

## 4. Trang danh sách tài liệu (/tai-lieu)

### Điểm mạnh

- **Section hero**: Tiêu đề “Kho tài liệu”, mô tả ngắn; bộ lọc mobile inline, desktop sidebar.
- **DiscoveryFilters**: Pills (grade, subject, exam), variant sidebar; filter-pill / filter-pill-active nhất quán; Reset khi có filter.
- **Grid + sort**: Sort (Mới nhất, Giá thấp, Giá cao) qua URL; grid DocumentCard; empty state có copy.
- **Loading**: Có `loading.tsx` với DocumentCardSkeleton lặp; tránh layout shift.

### Cần cải thiện

- **Số kết quả**: Đang hiển thị “X tài liệu”; có thể thêm “Hiển thị 1–12 trong Y kết quả” nếu backend hỗ trợ phân trang/total.

---

## 5. Trang chi tiết tài liệu (/tai-lieu/[id]/[slug])

### Điểm mạnh

- **Breadcrumb**: Trang chủ / Tài liệu / [Title]; title dài truncate + tooltip; hỗ trợ điều hướng và SEO.
- **Hero**: Ảnh bìa nhỏ (nếu có thumbnail) + title (font-display, responsive) + tags (grade primary, subject slate, exam emerald); hierarchy rõ.
- **Tab mobile**: Chỉ trên mobile, tab “Xem thử / Mô tả / Đánh giá” (Mô tả ẩn nếu không có description); role="tablist", aria-selected, aria-controls; chuyển nội dung mượt.
- **Preview**: PreviewGallery với slides (PDF 1 slide iframe, ảnh 1 hoặc 2 slide khi có thumbnail + preview); skeleton shimmer đến khi onLoad; nhiều slide có prev/next và dots.
- **Section headings**: Xem thử, Mô tả, Đánh giá, Thảo luận, Cộng đồng dùng border-l-4 border-primary + icon; nhất quán, dễ quét.
- **Reveal on scroll**: Các block chính bọc RevealOnScroll; Intersection Observer thêm class is-visible; CSS opacity + translateY với motion-ease-premium; prefers-reduced-motion tắt animation.
- **Sticky CTA mobile**: Thanh cố định chân trang (chỉ < md): giá + “Xem & tải về”/“Chỉ xem online” + một nút (Đăng nhập để mua / Mua ngay / Đọc tài liệu). Sidebar đầy đủ chỉ từ md; tránh trùng CTA.
- **Sidebar desktop**: Giá, CTA, trust bullets (ShieldCheck, Clock3, BadgeCheck); sticky top-[5rem]; shadow nhẹ.
- **Đánh giá**: Badge ★ + điểm + số lượt; danh sách đánh giá; form đánh giá (sao + textarea) cho người mua; nút sao lớn, hover rõ.
- **Thảo luận**: Danh sách comment + form (chỉ người mua); ngày tháng format vi-VN.
- **Cộng đồng**: Zalo/Telegram nếu cấu hình; nút rõ.

### Cần cải thiện

- **Gallery nhiều ảnh**: Hiện chỉ 1–2 slide (thumbnail + preview_url). Nếu sau này backend trả nhiều ảnh xem thử, chỉ cần mở rộng `previewSlides`; UI gallery đã sẵn sàng.
- **Anchor / mục lục**: Trang dài; có thể thêm link “Nhảy tới Đánh giá” / “Nhảy tới Thảo luận” hoặc sticky mục lục nhỏ trên desktop (ưu tiên thấp).

---

## 6. Auth (login, signup, forgot-password, reset-password)

### Điểm mạnh

- **Layout**: PublicLayout, nội dung căn giữa, min-h-[calc(100vh-8rem)]; card bo góc, shadow.
- **i18n**: Chuỗi lấy từ `t("auth.*")` / `t("common.*")`; namespace auth, common; bước đầu map key → tiếng Việt trong code, sẵn sàng đa ngôn ngữ sau.
- **Form**: Label + input + placeholder, quên mật khẩu (login), nhập lại mật khẩu (signup), validation khớp mật khẩu; lỗi inline; nút disabled khi loading; OAuth Google (login).
- **Reset password**: Ba trạng thái (đang xác thực, link không hợp lệ, form đặt lại) đều dùng PublicLayout; link “Gửi lại link” dẫn forgot-password.

### Cần cải thiện

- **Lỗi Supabase**: Thông báo lỗi chung; nếu API trả lỗi theo field có thể map xuống từng ô (email/password) để UX rõ hơn.
- **Success state**: Sau reset password redirect login với query success=password-reset; trang login có thể hiển thị toast/banner “Đặt lại mật khẩu thành công” khi có query đó.

---

## 7. Checkout

### Điểm mạnh

- **PublicLayout**: Trang checkout bọc PublicLayout; không lặp Header.
- **Nội dung**: Tiêu đề VietQR, thông tin đơn (mã, số tiền, nội dung CK), nút Copy, “Tôi đã thanh toán” (polling), ảnh QR, tải QR; trạng thái completed có thông báo và link “Về Tủ sách”.
- **Accessibility**: aria-live cho trạng thái đơn; thông báo cho screen reader khi completed.
- **Lỗi**: Có nút “Thử lại” khi lỗi tạo đơn; copy/QR lỗi có setError.

### Cần cải thiện

- **Feedback khi đang kiểm tra**: Đã có “Đang kiểm tra...” trên nút; có thể thêm text “Tự động kiểm tra mỗi 12 giây” để user yên tâm.
- **Redirect sau completed**: Hiện chỉ link “Về Tủ sách”; có thể thêm auto redirect (vd. 3s) tùy product.

---

## 8. Thẻ tài liệu & component dùng chung

### Điểm mạnh

- **DocumentCard**: Variant default (đầy đủ) và compact (ảnh 3/2, bỏ mô tả, CTA gọn); dùng ImageCard + PriceCtaBlock; micro-card 3D tilt (hover), card-shimmer; modal “Xem nhanh” có focus trap và return focus.
- **ImageCard**: Ảnh bìa dùng chung, topBadge/bottomBadge, aspectClass, shimmer; dùng trong DocumentCard và có thể tái sử dụng.
- **PriceCtaBlock**: Giá + CTA (default/compact); dùng semantic .doc-card-cta; nút “Xem chi tiết” đủ lớn (min-h, padding, text-base).
- **DocumentCardSkeleton**: Dùng cho loading grid; cấu trúc gần với card thật.

### Cần cải thiện

- **Alt ảnh**: ImageCard nhận `alt`; DocumentCard truyền `doc.title`. Đảm bảo mọi nơi dùng ImageCard đều truyền alt có nghĩa.
- **Modal “Xem nhanh”**: Đã có focus trap và aria; có thể thêm Escape để đóng (nếu chưa) cho keyboard.

---

## 9. Nút & CTA

### Điểm mạnh

- **btn-primary / btn-secondary**: Lớp component chuẩn; transition, hover, active scale; focus-visible dùng outline primary.
- **doc-card-cta**: Dùng semantic --color-action, --shadow-action; kích thước CTA card đã tăng (min-h-[44px], text-base, icon h-5).
- **Sticky bar mobile**: Một nút CTA chính; không trùng với sidebar.

### Cần cải thiện

- **Một số trang**: Unauthorized, reader error v.v. đã dùng btn-primary/btn-secondary; nên rà lại toàn bộ nút “phụ” đều dùng btn-secondary thay vì class ad-hoc.

---

## 10. Typography & đọc

### Điểm mạnh

- **Font**: Inter (sans), Plus Jakarta Sans (display); Vietnamese subset; body antialiased.
- **Cấp bậc**: H1 hero (text-4xl–6xl, font-display), H2 section (text-xl–2xl), H3 card (text-lg), body (text-sm/base); line-clamp cho title/description.
- **Số & giá**: toLocaleString("vi-VN") + "₫" nhất quán.

### Cần cải thiện

- **Semantic heading**: Một số H1/H2 vẫn dùng `text-slate-900 dark:text-white`; có thể chuyển sang `text-semantic-heading` để thống nhất với token.

---

## 11. Màu sắc & contrast (a11y)

### Điểm mạnh

- **Focus**: `*:focus-visible` outline 2px primary, offset 2px.
- **Lỗi**: Form lỗi dùng bg-red-50 / text-red-700 (dark tương ứng); 403 dùng red-100/600.
- **Dark mode**: Biến đổi đồng bộ; không invert tùy tiện.

### Cần cải thiện

- **Kiểm tra WCAG**: Nên kiểm tra contrast (4.5:1 chữ nhỏ, 3:1 chữ lớn) cho cặp primary-700/primary-600 trên white, text-slate-500 trên bg-slate-50, và badge (amber, emerald) chữ trên nền.
- **Link**: Link trong đoạn văn nên có underline (hover hoặc mặc định nhẹ) để không chỉ dựa vào màu.

---

## 12. Responsive & mobile

### Điểm mạnh

- **Breakpoint**: sm/md/lg/xl dùng nhất quán; grid 1 → 2 → 3 cột; nav ẩn/hiện (md), sidebar (lg).
- **Sticky CTA**: Chỉ mobile; thanh gọn (giá + 1 nút); pb-24 cho main để nội dung không bị che.
- **Tab nội dung**: Mobile dùng tab Xem thử/Mô tả/Đánh giá; desktop hiển thị đủ block.
- **Touch**: Nút đủ lớn (min-h, padding); filter pills dùng được trên mobile.
- **Header dropdown**: Click và hover đều mở; menu mobile có cùng links.

### Cần cải thiện

- **Safe area**: Sticky bar mobile chưa dùng padding-bottom safe-area cho máy có notch; có thể thêm pb-[env(safe-area-inset-bottom)] khi cần.

---

## 13. Accessibility (a11y)

### Điểm mạnh

- **Focus visible**: Outline primary toàn cục.
- **Aria**: Nút đăng xuất, menu, dropdown (expanded, haspopup, menu/menuitem), tab (tablist, tab, aria-selected, aria-controls), modal (dialog, labelledby), aria-live checkout.
- **Ngôn ngữ**: `<html lang="vi">`.
- **Reduced motion**: Reveal, shimmer, micro-card tilt tắt khi prefers-reduced-motion.
- **Form**: Label gắn input qua htmlFor/id.

### Cần cải thiện

- **Skip link**: Thêm “Bỏ qua tới nội dung chính” đầu trang, ẩn bằng sr-only, hiện khi focus.
- **Landmark**: Main có thể thêm aria-label="Nội dung chính" hoặc tương đương; các section lớn có thể có aria-labelledby trỏ tới heading.
- **Ảnh**: Đảm bảo mọi ảnh nội dung (thumbnail, preview) có alt mô tả; ảnh trang trí alt="".

---

## 14. Loading, lỗi, empty state

### Điểm mạnh

- **Preview**: Skeleton shimmer trong PreviewGallery đến khi iframe/image onLoad.
- **Danh sách**: loading.tsx với DocumentCardSkeleton cho /tai-lieu.
- **Form**: Nút submit disabled + text “Đang …” khi loading; lỗi inline.
- **Checkout**: “Đang tạo đơn hàng…”, “Đang kiểm tra…”; aria-live khi completed; nút Thử lại khi lỗi.
- **Empty state**: Trang chủ, grid tài liệu có copy và icon; CTA “Xem tất cả” / “Khám phá tài liệu”.
- **Toaster**: Sonner top-center, richColors, closeButton; dùng cho action admin và thông báo.

### Cần cải thiện

- **Dashboard / tủ sách**: Nếu danh sách tài liệu đã mua fetch chậm, có thể thêm skeleton list tương tự DocumentCardSkeleton.
- **Secure Reader**: Lỗi chỉ “Về Tủ sách”; có thể thêm “Thử lại” gọi lại fetchSignedUrl.

---

## 15. Tóm tắt & đề xuất ưu tiên

### Bảng tóm tắt

| Hạng mục | Đánh giá |
|----------|----------|
| **Design system** | Tốt: một nguồn màu, semantic tokens, Tailwind map, dark mode, docs/UI.md. Cần: surface.DEFAULT gắn --surface; dùng semantic nhiều hơn. |
| **Layout** | Tốt: PublicLayout toàn trang public, Header/Footer thống nhất, breadcrumb chi tiết, sticky CTA mobile. Cần: skip link, landmark/label main. |
| **Trang chủ** | Tốt: hero, grid, trust strip. Cần: skeleton khi fetch; có thể thêm số liệu xã hội. |
| **Danh sách tài liệu** | Tốt: filter, sort, skeleton loading, empty state. Có thể: số kết quả / phân trang. |
| **Chi tiết tài liệu** | Rất tốt: hero, tab mobile, gallery + skeleton, reveal on scroll, sticky CTA, section headings, đánh giá/thảo luận. Có thể: anchor/mục lục. |
| **Auth** | Tốt: i18n, form đầy đủ, quên MK, xác nhận MK. Có thể: map lỗi theo field; success state sau reset. |
| **Checkout** | Tốt: PublicLayout, aria-live, Thử lại. Có thể: text “Tự động kiểm tra 12s”; auto redirect sau completed. |
| **Thẻ & component** | Tốt: DocumentCard variant, ImageCard, PriceCtaBlock, skeleton, CTA size. Cần: alt nhất quán; Escape đóng modal. |
| **Nút & CTA** | Tốt: btn-primary/secondary, doc-card-cta size. Cần: chuẩn hóa nút phụ toàn bộ. |
| **Typography** | Tốt: font, cấp bậc, số. Có thể: semantic-heading cho H1/H2. |
| **Màu & contrast** | Tốt: focus, lỗi, dark. Cần: kiểm tra WCAG; link underline. |
| **Responsive** | Tốt: breakpoint, sticky bar, tab mobile, touch. Có thể: safe area notch. |
| **Accessibility** | Khá tốt: focus, aria, lang, reduced-motion. Cần: skip link, landmark; đảm bảo alt ảnh. |
| **Phản hồi** | Tốt: skeleton preview & list, loading form, aria-live, empty state, toaster. Có thể: skeleton dashboard; reader “Thử lại”. |

### Đề xuất ưu tiên

**Ưu tiên cao (ảnh hưởng trực tiếp UX / a11y)**

1. **Skip link**: Thêm link “Bỏ qua tới nội dung chính” (sr-only, hiện khi focus) trong layout hoặc Header.
2. **Surface token**: Trong tailwind theme, `surface.DEFAULT` dùng `var(--surface)` thay vì hex để dark mode đúng mọi nơi.
3. **Kiểm tra contrast**: Chạy kiểm tra WCAG (vd. axe hoặc Contrast Checker) cho primary, slate, badge; chỉnh màu nếu dưới ngưỡng.

**Ưu tiên trung bình (nhất quán & polish)**

4. **Chuẩn hóa nút**: Rà toàn bộ nút “phụ” (unauthorized, reader error, v.v.) dùng `btn-secondary`.
5. **Alt ảnh**: Đảm bảo thumbnail/preview có alt mô tả; ảnh trang trí alt="".
6. **Landmark**: Main có aria-label hoặc aria-labelledby; section lớn có heading/aria-labelledby.
7. **Link underline**: Link trong nội dung có underline (hover hoặc mặc định nhẹ).

**Ưu tiên thấp (tinh chỉnh)**

8. **Skeleton trang chủ**: Khi fetch docs đang loading, hiển thị grid DocumentCardSkeleton.
9. **Success sau reset password**: Trang login đọc query success=password-reset và hiển thị toast/banner ngắn.
10. **Safe area**: Sticky bar mobile thêm padding-bottom env(safe-area-inset-bottom) cho thiết bị notch.

---

## Kết luận

UI Doc2Share đã có nền tảng vững: **một nguồn màu**, **semantic tokens**, **PublicLayout thống nhất**, **DocumentCard/ImageCard/PriceCtaBlock** tái sử dụng, **trang chi tiết** với tab mobile, gallery + skeleton, reveal on scroll, sticky CTA mobile, **i18n** sẵn sàng, **docs/UI.md** rõ ràng. Các cải thiện còn lại chủ yếu là **accessibility** (skip link, landmark, contrast, alt), **nhất quán** (surface token, nút phụ, semantic heading), và **polish** (skeleton trang chủ, success state, safe area). Ưu tiên cao nên tập trung vào skip link, surface và contrast để trải nghiệm chuyên nghiệp và dùng được cho mọi người.
