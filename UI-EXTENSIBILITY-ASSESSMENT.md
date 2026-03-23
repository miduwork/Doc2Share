# Đánh giá UI – Mở rộng & Tích hợp

Đánh giá toàn bộ giao diện Doc2Share từ góc nhìn **dễ mở rộng** và **dễ tích hợp**: design tokens, kiến trúc component, layout, theme, và các điểm tích hợp bên ngoài (analytics, i18n, white-label, v.v.).

---

## 1. Hiện trạng tổng quan

| Khía cạnh | Hiện tại | Mức độ sẵn sàng mở rộng/tích hợp |
|-----------|----------|-----------------------------------|
| **Design tokens** | CSS vars trong `:root` (màu, border, motion); Tailwind extend (colors, shadow, radius, font). | Khá tốt: đổi theme tập trung ở một chỗ. Thiếu: spacing scale thống nhất, breakpoint/semantic token. |
| **Component** | ~23 component (Header, Footer, DocumentCard, DiscoveryFilters, admin/*). Dùng class từ globals + Tailwind. | Trung bình: tái sử dụng tốt nhưng ít variant/slot; component đặc thù (DocumentCard) gắn chặt layout. |
| **Layout** | `app-shell`, `section-container`, từng trang tự bố cục (Header + main + footer). | Ổn: pattern rõ. Thiếu layout wrapper tái sử dụng (PublicLayout, AdminLayout đã có nhưng chưa tách component). |
| **Styling** | Một file `globals.css` (components + utilities); Tailwind config; không có thư viện UI bên ngoài. | Dễ tích hợp: không phụ thuộc kit nặng. Rủi ro: globals phình to, class trùng tên khó tìm. |
| **Theme / mode** | Dark theo `prefers-color-scheme`; không có theme switcher hay nhiều theme. | Chưa mở rộng: thêm theme (ví dụ high-contrast, brand B) sẽ phải sửa nhiều chỗ. |
| **i18n** | Chuỗi tiếng Việt hardcode trong component. | Chưa sẵn sàng: chưa có key/namespace, khó tích hợp i18n sau. |
| **Tích hợp bên ngoài** | Toaster (Sonner), Supabase Auth. | Ổn: ít phụ thuộc. Chưa có slot/placeholder cho analytics, chat, banner. |

---

## 2. Design tokens & theme

### Điểm mạnh

- **Biến CSS**: `--foreground`, `--background`, `--surface`, `--primary`, `--border`, `--muted`, `--motion-ease-premium` dùng trong globals và có thể dùng trong Tailwind qua `var(--...)`. Dark mode ghi đè cùng bộ biến.
- **Tailwind extend**: `colors.fg/bg/line`, `colors.primary.*`, `colors.edu`, `colors.accent`, `fontFamily.sans/display`, `boxShadow.card/premium/glow`, `borderRadius.xl/2xl/3xl`. Nhất quán và dễ đổi màu/brand.

### Cần cải thiện để mở rộng

1. **Single source of truth**
   - **Vấn đề**: Màu primary vừa ở `:root` (`--primary`) vừa trong Tailwind (`primary.DEFAULT` = hex). Đổi brand phải sửa cả hai.
   - **Đề xuất**: Dùng CSS var cho toàn bộ màu chính; Tailwind chỉ tham chiếu: `primary: { DEFAULT: "var(--primary)", 50: "var(--primary-50)", ... }`. Hoặc sinh palette từ một biến (JS/ build step) nếu cần.

2. **Semantic tokens**
   - **Vấn đề**: Nhiều chỗ dùng trực tiếp `primary`, `slate-600`, `emerald-500`. Thêm theme “high contrast” hoặc “brand B” sẽ phải tìm thay toàn codebase.
   - **Đề xuất**: Thêm lớp semantic (ví dụ `--color-action`, `--color-success`, `--color-surface-elevated`, `--text-primary`, `--text-muted`) và dùng trong component. Theme mới chỉ đổi giá trị semantic.

3. **Spacing & typography scale**
   - **Hiện tại**: Đã có `section-spacing-sm/ section-spacing/ section-spacing-lg`; font có `sans`, `display`. Chưa có scale spacing chung (4/8/12/16/24/32...) dưới dạng token đặt tên.
   - **Đề xuất**: Khai báo `--space-1` … `--space-12` (hoặc dùng Tailwind spacing) và ưu tiên dùng token cho section/gap; thêm `--text-heading`, `--text-body` nếu cần đổi font size toàn cục.

4. **Theme switcher & nhiều theme**
   - **Hiện tại**: Chỉ `prefers-color-scheme`.
   - **Đề xuất**: Thêm `[data-theme="light|dark"]` (hoặc class trên `html`) và ưu tiên `data-theme` hơn `prefers-color-scheme` khi user chọn. Chuẩn bị sẵn cấu trúc `:root, [data-theme="dark"] { ... }` để sau này thêm `[data-theme="brand-b"]` mà không phá layout.

---

## 3. Kiến trúc component

### Điểm mạnh

- Component rõ ràng (Header, Footer, DocumentCard, DiscoveryFilters, admin/*); dùng chung `section-container`, `btn-primary`, `premium-panel`.
- DiscoveryFilters có `variant` (pills | sidebar) — hướng đúng cho mở rộng.
- Không phụ thuộc UI library nặng, dễ tùy biến.

### Cần cải thiện để mở rộng

1. **Variant & composability**
   - **Vấn đề**: DocumentCard layout cố định (ảnh + title + tags + meta + giá + CTA). Muốn “card nhỏ” (list) hoặc “card nổi bật” (hero) phải copy/sửa nhiều.
   - **Đề xuất**: Tách “card base” (wrapper + ảnh + overlay) và “card content” (title, tags, meta, price-cta). DocumentCard = composition. Hoặc thêm prop `variant: "default" | "compact" | "featured"` và render nhánh layout khác nhau.

2. **Slots & children**
   - **Vấn đề**: Header, Footer nội dung cố định. Thêm banner, promo bar, hoặc slot “sau nav” buộc phải sửa từng component.
   - **Đề xuất**: Header nhận optional `slotRight`, `slotAfterNav` (React node); Footer nhận optional `slotBeforeLinks`. Layout gốc (layout.tsx hoặc AppShell) nhận optional `banner`, `footerSlot` để tích hợp campaign/legal mà không đụng sâu vào Header/Footer.

3. **Component documentation & discovery**
   - **Vấn đề**: Không có danh sách “design system” trong code — dev mới khó biết nên dùng class/component nào.
   - **Đề xuất**: Thêm `docs/UI.md` hoặc `src/components/README.md` liệt kê: tokens (CSS vars + Tailwind), component công khai (Button, Card, Input, SectionContainer), quy ước đặt tên. Có thể kèm vài ví dụ code (snippet).

4. **Tách primitive vs domain**
   - **Vấn đề**: DocumentCard vừa là “card có ảnh + CTA” vừa gắn domain “document” (price, grade, subject, preview).
   - **Đề xuất**: Nếu có thêm “product” hoặc “course” card tương tự, tách `ProductCard`/`ContentCard` dùng chung primitive (ImageCard, PriceCtaBlock) nhận props chung; DocumentCard chỉ map doc → props. Giảm trùng lặp và dễ tích hợp loại nội dung mới.

---

## 4. Layout & trang

### Điểm mạnh

- Pattern nhất quán: `app-shell` > Header + main + Footer (hoặc không footer). Admin có layout riêng (sidebar + content).
- `section-container` (max-w-7xl, px-4) dùng rộng rãi.

### Cải thiện để tích hợp

1. **Layout component**
   - **Đề xuất**: Tách `PublicLayout` (Header + main + Footer, optional props cho slot) và dùng trong layout.tsx hoặc từng route. Trang chỉ render nội dung; đổi header/footer toàn cục chỉ sửa một nơi. Dễ tích hợp banner, script, consent bar.

2. **Route-level layout**
   - **Hiện tại**: Một số trang tự import Header/Footer; một số nằm trong layout có sẵn.
   - **Đề xuất**: Route groups (e.g. `(public)`, `(admin)`) với layout.tsx riêng, mỗi layout dùng PublicLayout/AdminLayout. Thêm trang mới chỉ cần đặt đúng group, không cần nhớ gắn Header.

3. **Breakpoint & container**
   - **Đề xuất**: Nếu sau này có “wide” (max-w-screen-2xl) hoặc “narrow” (max-w-3xl), nên đặt tên semantic: `section-container` mặc định, `section-container--wide` / `section-container--narrow` (hoặc prop) để dễ mở rộng không phá layout hiện tại.

---

## 5. Tích hợp bên ngoài

### Analytics, tracking, consent

- **Hiện tại**: Không thấy hook/component chung cho analytics.
- **Đề xuất**: Một `AnalyticsProvider` hoặc hook `useTrack` wrap app hoặc layout; các CTA/trang quan trọng gọi hook thay vì gọi trực tiếp GA/tag. Dễ đổi provider hoặc tắt theo consent.

### i18n

- **Hiện tại**: Chuỗi tiếng Việt trong JSX.
- **Đề xuất**: Chuẩn bị sẵn: (1) tách chuỗi ra file/key (theo namespace: common, auth, product, checkout), (2) dùng key trong component (e.g. `t('product.viewDetail')`). Khi tích hợp next-intl hoặc react-i18next chỉ cần nối key với bản dịch; không phải đào từng component.

### Payment / bên thứ ba

- **Hiện tại**: Checkout dùng VietQR; ít phụ thuộc UI bên ngoài.
- **Đề xuất**: Giữ checkout page “wrapper”: phần hiển thị (số tiền, trạng thái, nút “Thử lại”) dùng component nội bộ; logic gọi API/redirect tách trong action hoặc service. Sau này thêm cổng khác (Stripe, MoMo) chỉ thêm branch UI + service, không phá layout chung.

### Embed & white-label

- **Nếu cần**: Brand màu/logo khác nhau theo tenant hoặc subdomain: toàn bộ màu/logo nên đi qua CSS var hoặc config (NEXT_PUBLIC_*). Header/Footer nhận `logoUrl`, `brandName` từ config hoặc context. Hiện tại đã dùng biến màu; chỉ cần thêm vài biến (--logo-url, --brand-name) và đọc từ env/API khi chạy white-label.

---

## 6. Đề xuất ưu tiên (mở rộng & tích hợp)

### Ưu tiên cao

| # | Hành động | Lý do |
|---|-----------|--------|
| 1 | **Thống nhất nguồn màu**: Primary (và nếu có thể accent, edu) lấy từ CSS var; Tailwind theme chỉ tham chiếu `var(--primary)` thay vì hex. | Đổi brand/theme một chỗ; tránh lệch giữa globals và Tailwind. |
| 2 | **Tách PublicLayout**: Component nhận `children`, optional `banner`, `footerSlot`; bên trong render Header + (banner) + main + Footer + (footerSlot). Layout root hoặc (public) dùng PublicLayout. | Mọi trang public nhất quán; tích hợp banner/script/footer dễ. |
| 3 | **Chuẩn bị i18n**: Tách chuỗi hiển thị ra object/key (ít nhất cho auth, checkout, product title/CTA); component dùng key. Có thể bước đầu vẫn map key → tiếng Việt trong cùng file. | Sau này gắn next-intl / i18next không phải refactor toàn bộ. |

### Ưu tiên trung bình

| # | Hành động | Lý do |
|---|-----------|--------|
| 4 | **Semantic tokens**: Thêm vài biến như `--color-action`, `--color-success`, `--text-heading`; dùng trong globals và vài component then chốt. | Hỗ trợ theme “high contrast” hoặc theme thứ hai mà không sửa từng class. |
| 5 | **DocumentCard variant hoặc composition**: Thêm `variant="compact"` hoặc tách ImageCard + PriceCtaBlock dùng chung. | Tái sử dụng cho list/related; dễ thêm loại card khác (course, bundle). |
| 6 | **UI docs**: `docs/UI.md` hoặc `src/components/README.md` mô tả tokens, component công khai, quy ước. | Onboarding nhanh; giảm style ad-hoc khi mở rộng. |

### Ưu tiên thấp

| # | Hành động | Lý do |
|---|-----------|--------|
| 7 | **Theme switcher**: `data-theme` trên `<html>` + class Light/Dark; ưu tiên lựa chọn user hơn `prefers-color-scheme`. | Trải nghiệm tốt hơn; nền tảng cho nhiều theme. |
| 8 | **Header/Footer slot**: Optional prop cho slot (e.g. banner trên header, block dưới footer). | Tích hợp campaign, partner, legal mà không fork component. |
| 9 | **Analytics hook**: `useTrack('event', { ... })` hoặc provider; CTA/trang quan trọng gọi. | Dễ đổi/tắt analytics; sẵn sàng consent. |

---

## 7. Tóm tắt

- **Mạnh**: Tokens CSS + Tailwind rõ; ít phụ thuộc UI lib; pattern layout và component dùng lại tốt.
- **Cần cải thiện**: (1) Một nguồn màu (var) và vài semantic token, (2) Layout component (PublicLayout) + slot, (3) Chuẩn bị i18n bằng key, (4) DocumentCard linh hoạt hơn (variant/composition), (5) Tài liệu UI ngắn gọn.

Làm lần lượt theo bảng ưu tiên trên sẽ giúp UI **dễ mở rộng** (theme mới, loại card mới, trang mới) và **dễ tích hợp** (i18n, analytics, payment, white-label, banner) mà không phá vỡ cấu trúc hiện tại.
