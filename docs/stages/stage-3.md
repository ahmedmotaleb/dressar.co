# Stage 3: header, navigation, predictive search

## 1. Architecture decision (written before coding)

**Restore Dawn 16.1.0's own `header` section and style it for DRESSAR. Take the AI header block out of rendering.**

Audit of what is there today:

| Concern | AI header block `0c61721` (live) | Dawn `header` section (disabled in `header-group.json`, code intact) |
|---|---|---|
| Nested menu, desktop | Hover-only dropdown inside `overflow: hidden`, so it is clipped. No keyboard access. | `<details>` dropdowns: keyboard, Escape, close on focus-out, `aria-expanded`/`aria-controls` |
| Nested menu, mobile | Top-level links only; the 7 categories are unreachable | `header-drawer`: drill-down submenus (3 levels), focus trap, Escape, body scroll lock, focus restore |
| Predictive search | None (link to `/search`) | `header-search` modal + `predictive-search`, already enabled in settings |
| Cart count | None; the icon is a plain link to `/cart` | `#cart-icon-bubble`, which `cart-drawer.js` re-renders after AJAX add and binds to open the drawer |
| Account | Link to `/account` | `<shopify-account>`, Shopify's component for new customer accounts |
| Sticky | Switches to `position: fixed`, so the page jumps (CLS); non-passive scroll handler | `sticky-header`: `position: sticky`, no layout change |
| Routes | Hard-coded `/`, `/cart`, `/search`, `/account` | `routes.*` (works under `/ar/` and `/en/`) |
| SEO | none | Organization + WebSite/SearchAction JSON-LD |
| Settings | 43 settings, most of them colours | Logo position, menu, sticky type, separator, colour schemes, utilities, spacing |

Everything Stage 3 requires already exists in Dawn and is tested upstream, so nothing is rebuilt. DRESSAR-specific work is limited to:

1. **Configuration** (`sections/header-group.json`): enable `header` with the existing merchant settings (main menu, centred logo, black scheme). Disable the AI header's `_blocks` section, keeping it in the file so it can be restored. The block file is not deleted.
2. **One stylesheet** (`assets/dsr-header.css`) for the DRESSAR look: two-row editorial desktop header (logo row, then a navigation row with search · menu · account/cart), refined nav typography, a clean dropdown, a mobile drawer, and the predictive search layout.
3. **Small, documented additions to Dawn files**:
   - `sections/header.liquid`: two settings (transparent on homepage, mobile logo width), a "compact" sticky option, and a few lines in `StickyHeader` to measure the logo row.
   - `snippets/header-dropdown-menu.liquid`, `snippets/header-drawer.liquid`: a "View all" link to the parent menu item's own URL. It comes from menu data, and the parent's page was unreachable before.
   - `sections/predictive-search.liquid`: a visible no-results line and a sold-out label (existing locale keys).

**Sticky behaviour:** the new "Always, compact" option keeps the header `position: sticky` with a negative `top` equal to the logo row's height. When scrolling, the logo row scrolls away and the navigation row (search, menu, account, cart) stays pinned. Nothing changes size, so there is no layout shift and no animation, and the navigation never disappears. On mobile the header is one row and stays pinned as a whole.

**Transparent header:** the current behaviour (transparent over the homepage hero) is kept as a setting. It is limited to desktop (≥ 990 px), where it is done in CSS alone without measuring heights (no CLS). On phones the header stays solid, because Dawn's mobile drawer positions itself from the header's height.

**Language:** every new storefront string uses an existing locale key. Theme-editor labels for the new settings are plain English, like the existing Dressar settings group. Uppercase and letter-spacing in the navigation are switched off for Arabic (`:lang(ar)`), because uppercase means nothing in Arabic and letter-spacing can pull Arabic letters apart in some browsers. (Chromium was checked in Stage 4 and keeps them joined.) The new CSS uses logical properties where the layout is directional, ready for the RTL stage.

## 2. Files modified

| File | Change |
|---|---|
| `sections/header-group.json` | Dawn `header` enabled. Its existing settings are kept: main menu, centred logo, black scheme 3. Its other values had no effect while it was disabled, and are set to match the live header: compact sticky, transparent on the homepage, a white dropdown (`menu_color_scheme` scheme 1), and the country/language selectors off, as in the AI header (the footer keeps the language selector). AI header section `178387093978949043` set to `"disabled": true`; its block settings are kept. The announcement bar and the already-disabled "Buy 2" block are unchanged. |
| `sections/header.liquid` (Dawn) | Loads `dsr-header.css`. Adds the `--dsr-logo-width-mobile` variable, a 500-weight "Dressar UI" `@font-face` built from the body font, the `header-wrapper--transparent` class, and the `dsr-header` class. `StickyHeader`: the "compact" type and `setCompactOffset()`. Schema: sticky option `compact`, settings `transparent_on_homepage` and `mobile_logo_width`. |
| `snippets/header-dropdown-menu.liquid` (Dawn) | "View all" item at the top of each dropdown level |
| `snippets/header-drawer.liquid` (Dawn) | "View all" item at the top of each drawer submenu level |
| `sections/predictive-search.liquid` (Dawn) | Sold-out label on product results. Visible no-results line. |
| `sections/dsr-product-boost.liquid` | Compatibility only: the PDP sticky bar also hides for Dawn's `overflow-hidden-tablet` / `-mobile` body classes, which the menu drawer and search use. |
| `snippets/whatsapp-button.liquid` | Compatibility only: the floating button hides while the menu, search or a drawer locks the page. |
| `tests/package.json` | `npm test` also runs `header.test.js`. Adds `@fontsource/poppins` (real font metrics in the tests). |

New files:

| File | Purpose |
|---|---|
| `assets/dsr-header.css` | The DRESSAR header layer (7.2 KB unminified) |
| `snippets/dsr-menu-view-all.liquid` | Shared "View all" list item, used by the dropdown and the drawer |
| `tests/header.test.js` | 210 browser checks across the 7 widths (section 10) |
| `tests/lib/theme-harness.js` | Renders the theme's real Liquid with LiquidJS (Shopify tags, filters and objects emulated) and serves it to Chromium |
| `tests/fixtures/store.json` | Test data: the real main-menu tree, 9 real products (3 sold out), logo size. It is a snapshot from the Admin API and is not read by the theme. |

Every edit to a Dawn file is marked with a `Dressar` comment, so it can be found again when Dawn is updated.

## 3. AI header runtime removed

- `blocks/ai_gen_block_0c61721.liquid` no longer renders: its only placement (section `178387093978949043` in `header-group.json`) is disabled. A repo-wide search finds no other reference.
- Removed from every page: its ~7.8 KB inline `<style>`, ~2.3 KB inline `<script>` (including the non-passive scroll handler that switched the header to `position: fixed`) and its markup.
- **The block file is not deleted.** It is still in the theme, and the section entry still carries its settings. Rollback: in the theme editor, show the AI header section and hide "Header" (or revert `sections/header-group.json`). Deletion can be decided after the new header has been live for a while.

## 4. Dawn functionality restored

All of it is Dawn's own code, unchanged in behaviour:

- `<details>` dropdown menus (`header-menu`): click and keyboard, Escape, close on focus-out and click-outside, `aria-expanded`/`aria-controls` (from `global.js`).
- Mobile `header-drawer` with drill-down submenus (3 levels), focus trap, Escape, body scroll lock, focus restore.
- `header-search` modal with `predictive-search` (Section Rendering API, `/search/suggest`).
- `#cart-icon-bubble`, re-rendered by `cart-drawer.js` after AJAX add. The icon opens the cart drawer.
- `<shopify-account>` for new customer accounts (sign-in dialog, orders, profile).
- `sticky-header` (`position: sticky`), now with a "compact" type.
- Organization and WebSite/SearchAction JSON-LD (the AI header had none).
- `routes.*` for every link, so `/ar/` and `/en/` URLs keep the language.

## 5. Navigation

- **Source:** the menu picked in the header settings (`main-menu`). No URL is hard-coded. Adding, renaming or nesting items in *Online Store → Navigation* updates both desktop and mobile.
- **Desktop (≥ 990 px):** row 1 is the centred logo. Row 2 is search (start), menu (centred) and account/cart (end). All 8 top-level items fit one line from 1220 px (1280 px with the larger Arabic size). Below that the menu wraps onto a second centred line instead of overflowing.
- **Dropdowns:** opened by click, Enter or Space. Width `max-content`, at most `min(32rem, 100vw − 4rem)`. Height capped at `100vh − 16rem`, scrolling inside if a menu gets long. The last two top-level items open to the left so they stay on screen. No ancestor clips them: the AI header's `overflow: hidden` wrapper is gone. Tested inside the viewport and on top (`elementFromPoint`) at 990/1280/1440.
- **"View all":** a parent item with children (for example "All Categories" → `/collections`) only opens its submenu in Dawn, so its own page could not be reached. Each submenu now starts with "View all" (`sections.featured_collection.view_all`, with the parent's name for screen readers). It links to the parent's URL and is skipped for placeholder `#` links.
- **Mobile drawer:** full-width below the header, every top-level item, touch rows of at least 48 px, drill-down to every category with a back button, Escape twice to close fully.
- **Typography:** uppercase, tracked 500-weight body font for the top level, sentence case for submenu items. For Arabic, no uppercase and no letter-spacing, and a slightly larger size.

## 6. Search

- One implementation only: Dawn's `predictive-search`. The AI header's link to `/search` is gone. Two `header-search` elements are in the DOM by Dawn's design (one for the desktop row, one for the mobile row); exactly one is visible at each width (tested).
- Results show the image, title (2 lines max), price, compare-at price and, new, a "Sold out" label (`products.product.sold_out`).
- New: a visible no-results line (`templates.search.no_results`, with the search terms). Dawn only announced it to screen readers.
- Under 750 px, products come before query suggestions.
- At 360 px: the input is focused and labelled, the panel stays in the viewport, and long titles wrap without overflow.
- Keyboard: arrow keys move through results, Enter opens one, Escape closes and returns focus to the search button.
- Settings used: *Theme settings → Search behaviour* (predictive search on, vendor off, price on), unchanged.

## 7. Cart count

`#cart-icon-bubble` is Dawn's. After an AJAX add, `product-form.js` asks for the `cart-icon-bubble` section and `cart-drawer.js` swaps it in. Tested with the real product form at 390 and 1280: the bubble shows the count without a reload, the drawer opens, and clicking the cart icon opens the drawer instead of going to `/cart`. With an empty cart there is no bubble.

## 8. Accessibility

Dawn's semantics are kept as they are: `<details>/<summary>` menus, `aria-expanded`, `aria-controls`, `aria-current="page"`, the focus trap in the drawer and search, focus restore, visually hidden labels, the skip link, and the `role="dialog"` search modal. Additions:

- "View all" links carry the parent's name for screen readers ("View all: All Categories").
- No-results text is now visible as well as announced.
- The 500-weight font keeps the small uppercase navigation text readable. Measured contrast: menu text 13.1:1 on the black header (scheme 3), dropdown items 10.1:1, drawer items 18.7:1 (WCAG AA needs 4.5:1).
- Touch targets: header icons 48 × 48 px, drawer rows 52 px tall.
- Focus outlines are Dawn's (`focus-inset`). Nothing in `dsr-header.css` removes an outline.
- Tested: Tab and Enter open a dropdown, Tab walks its links, tabbing past closes it, and Escape closes it with focus back on the toggle. In the drawer, focus moves to the submenu's back button and Escape restores focus to the menu button.

The AI header had none of this: no keyboard access to submenus and no ARIA state.

## 9. Performance

- **Removed:** the AI header's inline CSS (~7.8 KB) and JS (~2.3 KB) on every page, and its scroll handler (non-passive, `position: fixed` switch, which caused layout shift).
- **Added:** `dsr-header.css` (7.2 KB unminified, render-blocking on purpose because it sets the header grid, so loading it late would shift the layout). Also one extra font file: the body font at weight 500 ("Dressar UI"), `font-display: swap`, used only for navigation text. Dawn's own header CSS and JS (`component-*.css`, `details-disclosure.js`, `details-modal.js`, `search-form.js`, `predictive-search.js`) were already loaded by the theme or are loaded by the header section.
- **No libraries,** no jQuery, no framework, no new app.
- **CLS while scrolling:** measured < 0.01 at every width (PerformanceObserver `layout-shift`). The compact sticky header moves nothing. The transparent header is out of the flow from the first paint, so nothing is measured or moved.

## 10. Tests and results

`node tests/header.test.js ..` (in `tests/`: `npm test`) renders the theme's real header group, menu, search and cart Liquid, CSS and JS, and drives them in Chromium with Poppins loaded.

| Suite | `en.default` | `ar` |
|---|---|---|
| `header.test.js` | 210 / 210 | 210 / 210 |
| `liquid-logic.test.js` (Stage 2) | 12 / 12 | |
| `pdp-sticky-sympl.test.js` (Stage 2) | 45 / 45 | |

What `header.test.js` checks:

- **At every width:**
  - exactly one header and one announcement bar
  - exactly one visible search toggle
  - cart and account visible
  - no horizontal overflow
  - logo aspect ratio
  - predictive search: focus and label, results with image/title/price/compare-at, panel inside the viewport, ArrowDown, sold-out label, no-results line, Escape and focus restore
  - sticky: cart still reachable after scrolling, CLS < 0.01
  - no count bubble on an empty cart
  - no JS errors
- **Desktop (990/1280/1440):**
  - every top-level item visible, drawer toggle hidden
  - dropdown opens, is inside the viewport and not covered
  - dropdown links match the menu's children plus "View all"
  - Escape, Enter, `aria-expanded`/`aria-controls`
  - Tab into the dropdown, tab past closes it
  - compact sticky: logo row gone and menu still visible after scrolling (above 990 px)
- **Mobile and tablet (360/390/430/768):**
  - drawer lists every item, body scroll locked
  - WhatsApp button hidden while the drawer is open
  - drill-down shows every category, submenu fully in view
  - focus moves to the back button, no horizontal overflow
  - Escape closes the drawer and restores focus
- **Cart flow (390, 1280):** real product form add → bubble shows the count → drawer opens → cart icon opens the drawer.
- **PDP (390):** the sticky add-to-cart bar is hidden while the menu drawer is open.
- **Homepage (1280, 390):** transparent over the hero on desktop and solid after scrolling. Solid on mobile.

**Theme Check** (3.31.0, recommended config): 210 offenses, exactly the same 210 as the Stage 2 / language baseline (none new, none gone).

- 180 are `MatchingTranslations` errors: the 6 `dressar.*` keys from Stage 2 are missing in the 30 locale files of languages the store does not publish. Shopify falls back to English there.
- 30 are warnings in files Stage 3 did not change, most of them in AI blocks.
- No Liquid syntax errors, and no offense in any file Stage 3 created or changed.

**Bug found and fixed by the tests:** at exactly 990 px, Dawn's JavaScript treats the page as mobile (`max-width: 990px`) while the CSS treats it as desktop (`min-width: 990px`). The compact offset now uses its own `(min-width: 990px)` query, so CSS and JS agree.

**Visual QA:** screenshots of the dropdown (990/1280), drawer drill-down (360/390), search with results (360/1280), sticky state (390/1280), cart drawer after add (390) and the transparent homepage (1440) were reviewed, in English and Arabic, **in the test harness**. The real storefront and the theme editor preview could not be opened from this environment: `dressar.co`, `*.myshopify.com` and `cdn.shopify.com` are blocked by its network policy. The harness uses the theme's real files, but Shopify's own rendering, apps and real images were not seen. See section 11.

## 11. Manual checks still required

On the preview of the development theme (`https://dressar.co/?preview_theme_id=167837270247`), on a phone and a desktop:

1. **Header look** with the real logo, fonts and announcement bar, at about 375 px and 1280+ px. Check the transparent header over the real homepage hero (desktop) and that it turns solid on scroll.
2. **Menu:** open "All Categories" on desktop and in the mobile drawer, follow a category, and use "View all".
3. **Search:** type a real product name and a nonsense word. Check that images, prices and "Sold out" match the store.
4. **Cart:** add to cart from a product page. The count and drawer should update without a reload.
5. **Account icon:** with new customer accounts, Shopify's `<shopify-account>` opens its sign-in dialog. Sign in once and check the orders link. This component comes from Shopify and cannot run outside it.
6. **Arabic (`/ar`):** menu titles come from *Translate & Adapt*; untranslated ones show in English (as in the screenshots). The page is still LTR until the RTL stage.
7. **Theme editor → Header:** the new settings are "Sticky header → Always, compact", "Transparent over homepage hero" and "Mobile logo width". Check that changing each one updates the preview.
8. **Apps:** check that the Judge.me stars, the Sympl widget and the WhatsApp button still show as before.

## 12. Known risks

- **Dawn updates:** five Dawn files carry small, marked DRESSAR edits (section 2). A Dawn update would need them re-applied. `git diff` against Dawn 16.1.0 shows exactly what to carry over.
- **Harness ≠ Shopify:** Liquid is rendered by LiquidJS with emulated Shopify filters. Behaviour that depends on Shopify's servers (real `font_modify` output, real predictive-search ranking, `<shopify-account>`, app embeds) is not covered by the tests.
- **Font weight 500:** if the body font is changed to one without a 500 weight, `font_modify` returns nothing, the `@font-face` is skipped, and the navigation falls back to the body font. Nothing breaks.
- **Menu length:** the 8 current items fit one line from 1220 px (1280 px in Arabic). More or longer items, including Arabic menu titles once they are translated, wrap onto a second line, as the menu already does on narrower desktops. That makes the header taller; it does not overflow.
- **Transparent header** is desktop-only by design. It needs a homepage whose first section is a full-bleed image or video; over a light, plain first section the white menu text would be hard to read. It can be switched off in the header settings.
- **Rollback:** revert this commit, or in the theme editor hide "Header" and show the AI header section again.

## 13. Widths tested

360, 390, 430, 768, 990, 1280 and 1440 px, in `en.default` and `ar`.

| Width | Header layout | Height |
|---|---|---|
| 360–768 | one row: menu · search · logo · account · cart | ~59 px, pinned when scrolling |
| 990–1219 | logo row + navigation row (menu on two centred lines) | ~188 px; ~106 px pinned when scrolling (compact) |
| 1220–1440 | logo row + navigation row (menu on one line) | ~139 px; ~57 px pinned when scrolling (compact) |

Heights are measured in English. In Arabic the larger type makes the desktop header about 6–11 px taller, and the menu wraps up to 1279 px. The announcement bar (43–45 px) scrolls away above the header at every width, as before.
