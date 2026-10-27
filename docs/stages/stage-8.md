# Stage 8: localization, SEO, accessibility and performance

## 1. Approach

Stage 8 has five parts:
- **Direction:** the Arabic storefront is laid out right to left.
- **SEO:** breadcrumbs, structured data and footer markup.
- **Accessibility:** audited with axe-core on the real pages, and every finding fixed.
- **Performance:** the runtime measured in a browser.
- **Theme-wide findings from Stage 1:** typography, a broken colour scheme and the footer.

Everything stays editable in the theme editor, and every new string comes from the locale files. Dawn files carry small, marked edits; DRESSAR code is in `dsr-*` files.

## 2. Localization and direction

**Languages today** (Settings → Languages):
- **English is the default** at `/`.
- **Arabic is published** at `/ar/`.
- The theme groundwork for making Arabic the default is in `docs/stages/language.md`:
  - `en.default.json` holds real English.
  - `ar.json` is the complete Arabic storefront.

**Strings.** The theme uses 29 `dressar.*` strings. Every one exists in English, in Arabic (all translated), and in the other 30 locale files.

**Right-to-left (new).** Arabic pages now carry `<html lang="ar" dir="rtl">`:
- **The switch:** Theme settings → Dressar → Language direction → "Right-to-left layout for Arabic" (on by default).
  - `snippets/dsr-direction.liquid` decides the direction; both layouts use it.
  - The same applies to Persian, Hebrew and Urdu if they're ever published.
  - Switching it off returns every language to left to right.
- **The browser mirrors most of the page itself:** header order, menus, grids, cards, text alignment.
- **`assets/dsr-rtl.css`** (11 KB, loaded only on right-to-left pages) mirrors what Dawn places with physical left/right:
  - arrows and slider/pagination chevrons
  - disclosure carets
  - menu drawer (now opens from the right, submenus slide from the left)
  - cart drawer (opens from the left, close button on the left)
  - filter dropdowns and filter drawer
  - form fields (floating labels, search and newsletter buttons, selects)
  - quantity buttons, accordion and icon spacing
  - price gaps
  - slider page margins and snap padding, including the product thumbnails
- **Dawn's sliders** worked out their position from `scrollLeft`, which runs negative on right-to-left pages. `SliderComponent` in `assets/global.js` now measures from the slider's start edge, through three small methods: `scrollStart`, `itemStart`, `scrollToStart`. The slideshow, product rows, product gallery and thumbnails use them, and so do the direction-aware calls in `media-gallery.js`, `product-modal.js` and `theme-editor.js`.
  - Left-to-right pages compute exactly what Dawn did.

**Mixed Arabic and English text.** Merchant rich text (product and collection descriptions, footer text) now takes each paragraph's direction from its first letter (`unicode-bidi: plaintext`, in the layout):
- An English paragraph reads and aligns left to right, and an Arabic one right to left, on either storefront. Before, "Contact us :" showed as ": Contact us" on Arabic pages.
- The trade-off: in the footer's support block on Arabic pages, the English lines align left under a right-aligned heading.
- Centred text stays centred.

**Percentages.** "خصم 28%" shows the % sign to the left of the number on Arabic pages. That is the Unicode rule for digits after Arabic letters, and the normal Arabic way of writing a percentage; nothing to fix.

**Still merchant content in Arabic under `lang="en"`.** Homepage headings, slides, product titles and the footer are written in Arabic (or both languages). On the English default storefront they are declared English, and only the merchant can change that:
- make Arabic the default language (`language.md`), or
- translate the content with Translate & Adapt.

The theme can't tell which language a merchant wrote a heading in.

## 3. SEO

| Check | State |
|---|---|
| One H1 per page | Home: the logo (Dawn). Collection: its title. Product: its title. Search and cart: their titles. Tested on every page in both languages. |
| Titles, meta description, canonical | Dawn's (`page_title`, `page_description`, `canonical_url`), unchanged; canonical is absolute |
| Structured data | Organization (every page), WebSite + SearchAction (home), Product (Shopify's `structured_data`, product pages), **BreadcrumbList (new: collection and product pages)**. Each exactly once per page, all valid JSON (tested). |
| Breadcrumbs (new) | `snippets/dsr-breadcrumbs.liquid`: Home › collection › product. The collection appears when the shopper came through one (`/collections/…/products/…`); otherwise Home › product. A labelled `<nav>` and `<ol>`; the current page is marked and isn't a link. On one line, with a long product title shortened. The BreadcrumbList matches the visible trail (names, positions, absolute URLs). |
| Images | Every image in `<main>` has `alt` and `width`/`height` (tested). |
| Crawlable navigation | Every main-menu destination, parents included, is a plain `<a href>` (Stage 3's "View all" links). |
| Footer headings | The about and support text used `<h5>` for paragraphs: 8 fake headings on every page. Now `<p>`, same wording. |
| Footer links | "FAQ" opened the size chart in a new tab; it now goes to `/pages/faq`. Internal links no longer open new tabs. |

**Where breadcrumbs appear:**
- **Collection pages:** the banner's "Show breadcrumbs" setting (on).
- **Product pages:** a "Dressar: breadcrumbs" block, first in the product info, which can be moved or removed in the editor.

**Alt text.** None of the 50 products checked has alt text on any photo. The theme prints whatever alt text a photo has, so this is a merchant action (Products → media → "Add alt text", or Shopify Magic).

## 4. Accessibility

`tests/a11y.test.js` runs **axe-core 4.10** (WCAG 2.0, 2.1 and 2.2 A and AA, plus best practices) on:
- home, collection, product, search and cart, at 390 and 1280 px, in English and Arabic
- the open menu drawer, filter drawer, cart drawer and search dialog

**Result: no violations of any level.** One rule isn't counted: "scrollable region must have keyboard access", on two Dawn sliders whose slides hold no links (home wear slideshow; "Why Dressar" on phones). Both keep keyboard-operable previous/next buttons, and Chromium and Firefox make such scrollers focusable themselves.

Fixed in this stage:

| Finding | Fix |
|---|---|
| Quantity field on product pages had no accessible name: Dawn hides its label text from screen readers and names the label, not the input | The input itself points at Dawn's hidden label (`aria-labelledby`), in `sections/main-product.liquid` |
| Struck-through compare-at price on cards: 4.1:1 | 5.9:1 |
| Unavailable sizes on cards: 2.3:1 | 4.9:1, still struck through and lighter than available sizes |
| Product count above the grid: 3.4:1 (Dawn fades the wrapper as well as the text) | Wrapper fade removed: 6.4:1 |
| Floating WhatsApp button outside any landmark | Inside a labelled `<aside>` |
| Colour scheme 2: dark text on black (blog cards, audit F04) | White text and buttons on its black background |
| Body text in Poppins 200, and Arabic falling back to the device's thinnest weight (audit F03) | Body text at weight 300 (Theme settings → Typography); headings stay 200 |

Also checked:
- **Skip link:** the first Tab lands on "Skip to content", visibly.
- **Drawers:** each drawer keeps focus inside and Escape closes it back to its button.
- **Search dialog:** it puts focus in the field.
- **Reduced motion:** with it on, nothing animates indefinitely. The slideshows no longer auto-rotate (Stage 7).
- **Target size:** axe's WCAG 2.2 target-size rule passes. Swatches are 28.6 px; breadcrumb links at least 26 px tall.

## 5. Performance

Measured in Chromium at 390 px, CPU slowed 4×, by `tests/perf.test.js`. Photos are detailed placeholders, and no app or third-party script runs, so this measures the theme's own code; it is not a Lighthouse score for the store.

| Page (English) | LCP element | LCP | CLS | TBT | DOM elements | JS files / KB | CSS files / KB |
|---|---|---|---|---|---|---|---|
| Home | hero photo, `fetchpriority="high"` | ~1.4 s | 0.002 | ~110 ms | 2,655 | 17 / 116 | 32 / 224 |
| Collection | first product photo (eager) | ~1.0 s | 0 | ~10 ms | 1,895 | 19 / 134 | 36 / 244 |
| Product | featured photo, `fetchpriority="high"` (new) | ~0.7 s | 0 | ~1 ms | 964 | 25 / 157 | 34 / 238 |

Arabic is within a few percent of these, plus `dsr-rtl.css`.

**LCP strategy:**
- **Home:** the hero's first photo loads eagerly at high priority (Dawn); the rest of the slideshow is lazy.
- **Collection:** the first two cards load eagerly (Stage 4).
- **Product:** the featured photo now also gets `fetchpriority="high"`, a marked edit in `snippets/product-thumbnail.liquid`.
- **Below the fold:**
  - homepage rows from the third section lazy-load every photo (Stage 7)
  - Shopify's `image_tag` lazy-loads from the fourth section by itself
- **Never lazy:** the LCP image is lazy on no page (tested).

**Layout shift:** every image has width and height; CLS ≈ 0.

**JavaScript:**
- all theme scripts are deferred, and none is included twice (tested)
- the 5 AI product carousels and their inline scripts are gone (Stage 7)
- the homepage keeps 3 small inline scripts (2.3 KB) from the editorial blocks still in use; collection and product pages have none from AI blocks

**Render-blocking CSS:** in `<head>`, only `base.css`, the cart drawer's styles (the drawer is on every page) and, on Arabic pages, `dsr-rtl.css`. Other head stylesheets load asynchronously.

**Repeated CSS:** each Dawn row on the homepage links the card and slider CSS again. That is Dawn's pattern, and the browser fetches each file once.

**DOM size:** the homepage has 2,655 elements; Lighthouse flags more than 1,400. Most are the 40 product cards in five rows. Showing 6 products per row, or fewer rows, is the lever if the preview's Lighthouse score asks for it.

**Fonts:**
- Poppins 200 (headings), 300 (body) and 500 (menu and cards), all `font-display: swap`
- the body and heading fonts are preloaded

**Third-party scripts** (not measurable here; check on the preview):
- **Sympl:** on every page when enabled, for the cart drawer widget.
- **App embeds:** Judge.me (core and cart drawer widget), Preorder Duck, WB Frequently Bought Together and Whatflow.
  - Whatflow's button is hidden on both devices, yet its embed still loads.
  - Switching that embed off is a free saving if the app's other features don't need it.

**Not run here:** Lighthouse and real-device timing. The storefront and preview can't be reached from this environment (manual check below).

## 6. Files

| File | Change |
|---|---|
| `snippets/dsr-direction.liquid` (new) | `rtl` or `ltr` for the visitor's language |
| `assets/dsr-rtl.css` (new) | The right-to-left layer |
| `layout/theme.liquid`, `layout/password.liquid` | `dir` on `<html>`; `dsr-rtl.css` on right-to-left pages; per-paragraph direction for rich text |
| `assets/global.js` (Dawn) | Direction-aware `SliderComponent` / `SlideshowComponent` |
| `assets/media-gallery.js`, `assets/product-modal.js`, `assets/theme-editor.js` (Dawn) | Direction-aware scrolling |
| `config/settings_schema.json` | Theme settings → Dressar → Language direction |
| `snippets/dsr-breadcrumbs.liquid`, `assets/dsr-breadcrumbs.css` (new) | Breadcrumbs and BreadcrumbList |
| `sections/main-collection-banner.liquid` (Dawn) | "Show breadcrumbs" setting |
| `sections/main-product.liquid` (Dawn) | "Dressar: breadcrumbs" block; quantity input named |
| `templates/product.json` | Breadcrumbs block first in the product info |
| `snippets/product-thumbnail.liquid` (Dawn) | Featured photo at high fetch priority |
| `assets/dsr-card.css`, `assets/dsr-collection.css` | Contrast of compare-at price, unavailable sizes, product count; logical price gap |
| `snippets/whatsapp-button.liquid` | Inside a labelled `<aside>` |
| `sections/footer-group.json` | Paragraphs instead of `<h5>`; FAQ link; no new tabs for internal links |
| `config/settings_data.json` | Body font weight 300; colour scheme 2 readable |
| `locales/*.json` | `dressar.breadcrumbs.label`, `dressar.breadcrumbs.home` |

## 7. Tests and results

| Suite | `en.default` | `ar` (right to left) |
|---|---|---|
| `a11y.test.js` (new: axe-core, keyboard, reduced motion) | 78 / 78 | 78 / 78 |
| `seo.test.js` (new) | 51 / 51 | 51 / 51 |
| `rtl.test.js` (new: both languages compared, plus the setting off) | 29 / 29 | |
| `perf.test.js` (new) | 18 / 18 | 18 / 18 |
| `home.test.js` | 349 / 349 | 349 / 349 |
| `cart.test.js` | 73 / 73 | 73 / 73 |
| `product.test.js` | 183 / 183 | 183 / 183 |
| `collection.test.js` (title-fit check now direction-proof) | 293 / 293 | 293 / 293 |
| `header.test.js` | 210 / 210 | 210 / 210 |
| `schema.test.js` | 6 / 6 | |
| `liquid-logic.test.js` (Stage 2 badge logic) | 15 / 15 | |
| `pdp-sticky-sympl.test.js` (Stage 2 sticky bar and Sympl) | 47 / 47 | |

Every Arabic run is now a right-to-left run. Three things in Dawn's own behaviour showed up only there, and are fixed:
- slider maths
- the filter panel opening off-screen
- the thumbnail strip snapping out of range on load

**Harness additions:**
- the real footer instead of a stub, with the store's footer menu
- `image_tag` prints `alt`, `width` and `height` like Shopify
- a localized country/language selector
- an outline of the Product JSON-LD
- `tests/lib/pages.js`: one storefront router for the new suites, including product URLs seen through a collection

**Theme Check:** 30 offenses, all warnings, identical to Stage 7; none new. A Liquid comment inside the quantity `<input>` tag was flagged by Theme Check's parser during the work and moved outside the tag.

**Visual QA:** home, collection (with filter panel and drawer), product, cart drawer and menu drawer, in Arabic right to left at 390 and 1280 px, **in the test harness**. The real storefront, photos, apps and fonts on devices could not be loaded from this environment.

## 8. Manual checks and merchant actions

1. **On the preview, in Arabic (`/ar/`), on a phone and a desktop:**
   - open the menu, a submenu, the cart drawer, the filters and the search
   - swipe each homepage row and the product gallery
   - check text alignment in product descriptions
2. **Lighthouse** (mobile) on home, a collection and a product page of the preview. If the DOM-size warning matters, use 6 products per homepage row.
3. **Google Rich Results Test** on a product page: Product and BreadcrumbList, and whether Judge.me adds a second Product or AggregateRating block.
4. **Alt text** for product photos and the homepage images (Products → media).
5. **Default language:** decide whether Arabic becomes the default (`docs/stages/language.md`). Translate the English storefront's content with Translate & Adapt, including the footer's "Subscribe to our emails".
6. **App embeds:** switch off Whatflow's embed if only its (hidden) button used it.
7. **Typography:** check the body weight 300 on the preview. Theme settings → Typography → Body sets it back.

## 9. Risks and rollback

- **Right-to-left touches the whole Arabic storefront.** Tested in the harness on every page type at seven widths; real devices still need a look.
  - **Rollback, right-to-left:** Theme settings → Dressar → switch off "Right-to-left layout for Arabic".
  - Without it, nothing of `dsr-rtl.css` loads and the slider maths takes Dawn's path.
- **Rollback, breadcrumbs:** remove the product block and untick the banner setting.
- **Rollback, everything:** revert this commit.
- **Dawn updates:** `global.js`, `media-gallery.js`, `product-modal.js`, `theme-editor.js`, `main-product.liquid`, `main-collection-banner.liquid` and `product-thumbnail.liquid` carry small edits marked "Dressar".
