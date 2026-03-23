# Tài liệu UI – Tokens & Components

Tài liệu mô tả design tokens và các component công khai dùng trong giao diện Doc2Share.

---

## 1. Design tokens

Nguồn gốc: **CSS variables** trong `src/app/globals.css` (`:root`). Tailwind tham chiếu qua `theme.extend.colors` trong `tailwind.config.ts`.

### 1.1 Token gốc (màu nền, viền, chữ)

| Token CSS | Mô tả | Tailwind |
|-----------|--------|----------|
| `--foreground` | Chữ chính | `fg`, `text-fg` |
| `--background` | Nền trang | `bg`, `bg-bg` |
| `--surface` | Nền khối/card | `surface` (DEFAULT) |
| `--border` | Viền mặc định | `line`, `border-line` |
| `--muted` | Chữ phụ | `muted`, `text-muted` |
| `--primary`, `--primary-50` … `--primary-900` | Primary brand | `primary`, `primary-50` … |
| `--primary-foreground` | Chữ trên nền primary | `brand-foreground` |
| `--accent`, `--accent-50` … | Accent (CTA phụ) | `accent`, `accent-50` … |
| `--edu-green`, `--edu-greenLight`, `--edu-greenMuted` | Màu giáo dục | `edu-green`, … |
| `--motion-ease-premium` | Easing animation | dùng trong `transition` |

Dark mode: các biến trên được ghi đè trong `@media (prefers-color-scheme: dark)`.

### 1.2 Semantic tokens (ý nghĩa dùng)

Dùng cho component để dễ đổi theme / accessibility; giá trị trỏ tới token gốc.

| Token CSS | Ý nghĩa | Tailwind |
|-----------|---------|----------|
| `--color-action` | Nền nút/CTA chính | `action`, `bg-action` |
| `--color-action-hover` | Nền CTA khi hover | `action-hover`, `hover:bg-action-hover` |
| `--color-action-foreground` | Chữ trên CTA | `action-foreground`, `text-action-foreground` |
| `--color-action-muted` | Nền nhạt (badge, pill) | `action-muted` |
| `--color-action-muted-foreground` | Chữ trên nền action nhạt | `action-muted-foreground` |
| `--text-heading` | Tiêu đề | `semantic-heading`, `text-semantic-heading` |
| `--text-body` | Nội dung | `semantic-body`, `text-semantic-body` |
| `--text-muted` | Chữ phụ | (trùng `--muted`, dùng `text-muted`) |
| `--text-inverse` | Chữ trên nền tối | `text-inverse` |
| `--surface-card` | Nền card | `surface-card`, `bg-surface-card` |
| `--surface-elevated` | Nền nổi (modal, dropdown) | `surface-elevated` |
| `--surface-overlay` | Overlay (backdrop) | — (dùng trực tiếp `var(--surface-overlay)`) |
| `--border-subtle` | Viền nhạt | `border-subtle` |
| `--border-strong` | Viền đậm | `border-strong` |
| `--radius-card` | Bo góc card | — |
| `--radius-button` | Bo góc nút | — |
| `--shadow-action` | Bóng nút CTA | — (dùng trong `.doc-card-cta`) |
| `--shadow-action-hover` | Bóng CTA hover | — |

Ví dụ dùng semantic trong component:

- Nút chính: `bg-action text-action-foreground hover:bg-action-hover`
- Tiêu đề: `text-semantic-heading`
- Card: `bg-surface-card border-border-subtle`

---

## 2. Lớp component (globals.css)

Các class định nghĩa trong `@layer components`:

| Class | Mô tả |
|-------|--------|
| `app-shell` | Vỏ trang: min-height, nền, chữ (thường dùng qua `PublicLayout`) |
| `section-container` | Container nội dung max-width 7xl, padding ngang |
| `premium-panel` | Panel bo góc, viền, shadow, backdrop |
| `premium-card` | Card bo góc, viền, shadow |
| `premium-card-hover` | Hiệu ứng hover card (nâng nhẹ, viền primary, shadow) |
| `btn-primary` | Nút chính (primary) |
| `btn-secondary` | Nút phụ (viền, nền trắng) |
| `input-premium` | Ô input chuẩn |
| `doc-card-cover` | Wrapper ảnh bìa thẻ tài liệu (aspect 4/3, gradient) |
| `doc-card-cover-inner` | Ring viền trong ảnh bìa |
| `doc-card-cover-hover-overlay` | Overlay gradient khi hover (dùng trong ImageCard) |
| `doc-card-cta` | Khối CTA (giá + “Xem chi tiết”) – dùng semantic `--color-action` |
| `cta-sticky-mobile` | CTA dính chân (mobile) / bình thường (desktop) |
| `filter-pill` / `filter-pill-active` | Pill lọc (sidebar, bộ lọc) |
| `micro-card` | Card 3D tilt (biến `--card-rx`, `--card-ry`) |
| `card-shimmer` | Hiệu ứng shimmer khi hover |
| `reveal-section`, `reveal-delay-1`, `reveal-delay-2` | Animation reveal khi vào viewport |
| `section-spacing`, `section-spacing-sm`, `section-spacing-lg` | Padding dọc section |

---

## 3. Components công khai

Các component có thể dùng trực tiếp trong app (không nội bộ admin).

### 3.1 Layout

- **`PublicLayout`** (`@/components/layout/PublicLayout`)  
  Layout chung trang public: Header + (banner) + main + Footer + (footerSlot).  
  Props: `children`, `banner?: ReactNode`, `footerSlot?: ReactNode`.

- **`Header`** (`@/components/Header`)  
  Thanh điều hướng trên: logo, Kho tài liệu, Đăng nhập/Đăng ký hoặc menu user. Thường dùng qua `PublicLayout`.

- **`Footer`** (`@/components/Footer`)  
  Chân trang: copyright, Điều khoản, Chính sách bảo mật, Liên hệ. Thường dùng qua `PublicLayout`.

### 3.2 Thẻ tài liệu & khối dùng chung

- **`DocumentCard`** (`@/components/DocumentCard`)  
  Thẻ tài liệu: ảnh bìa, tiêu đề, meta (khối/môn/kỳ thi), mô tả (tùy variant), giá + CTA.  
  Props: `doc`, `categories`, `viewCount?`, `ratingCount?`, `avgRating?`, `soldCount?`, **`variant?: "default" | "compact"`**.  
  - `default`: đầy đủ (mô tả, rating, CTA lớn).  
  - `compact`: ảnh 3/2, bỏ mô tả và dòng meta phụ, CTA gọn.

- **`ImageCard`** (`@/components/ImageCard`)  
  Khối ảnh bìa dùng chung: thumbnail (hoặc placeholder), overlay, badge góc trên-trái và dưới-phải.  
  Props: `imageUrl`, `alt`, `topBadge?`, `bottomBadge?`, `aspectClass?`, `className?`, `shimmer?`.

- **`PriceCtaBlock`** (`@/components/PriceCtaBlock`)  
  Khối giá + CTA (vd. “Giá bán”, số tiền, “Xem chi tiết” + icon).  
  Props: `price`, `priceLabel?`, `ctaText?`, **`variant?: "default" | "compact"`**, `className?`.

- **`DocumentCardSkeleton`** (`@/components/DocumentCardSkeleton`)  
  Skeleton loading cho thẻ tài liệu (dùng khi danh sách đang tải).

### 3.3 Khác

- **`DiscoveryFilters`** (`@/components/DiscoveryFilters`)  
  Bộ lọc khối lớp / môn / kỳ thi; hỗ trợ hiển thị inline (mobile) hoặc sidebar.  
  Props: `grades`, `subjects`, `exams`, `basePath`, `variant?`.

- **`SecureReader`** (`@/components/SecureReader`)  
  Trình xem tài liệu bảo vệ (watermark, chống tải).

---

## 4. Gợi ý sử dụng

- **Màu**: Ưu tiên semantic (`bg-action`, `text-semantic-heading`, `border-border-subtle`) khi muốn dễ đổi theme; dùng token gốc (`primary`, `fg`) khi cần bám sát palette.
- **Nút**: Dùng class `btn-primary`, `btn-secondary`; CTA trong card dùng `doc-card-cta` hoặc `PriceCtaBlock`.
- **Trang public**: Bọc nội dung bằng `<PublicLayout>`; không lặp Header/Footer trong từng trang.
- **Danh sách tài liệu**: Dùng `DocumentCard`; cần dạng gọn (vd. “Tài liệu liên quan”) thì truyền `variant="compact"`.
- **Ảnh bìa / khối giá+CTA tùy biến**: Dùng trực tiếp `ImageCard` và `PriceCtaBlock` nếu cần layout khác với `DocumentCard`.
