# Stage 4: collection page and product cards

## 1. Architecture decision

**Turn Dawn's own collection banner and product grid back on, and build one DRESSAR card on Dawn's `card-product` snippet. Take the AI grid out of rendering.**

| Need | AI grid block `8ec498c` (live) | Dawn banner + grid + facets (disabled in `collection.json`, code intact) |
|---|---|---|
| All products | Server pagination since Stage 2 (stop-gap) | `{% paginate %}`, 16 per page |
| Filters | None (title search over the page's cards) | Shopify storefront filters: availability, price, colour, size, type (whatever Search & Discovery enables) |
| Sort | Client-side, "Featured" broken | Shopify sort, in the URL |
| Mobile filters | None | Drawer with focus trap, Escape and scroll lock |
| H1, description, count | None | H1, description and product count |
| Empty states | Wipes the grid | "No products found" with a link to clear filters |
| URLs | Nothing in the URL | Filters, sort and page are in the URL (shareable, crawlable) |
| Card | Its own card, name-guessed swatch colours, sizes regardless of stock | Dawn card (srcset, width/height, hover photo, sold-out badge), extended below |

The DRESSAR part is small: a card layer (`dsr-card.css` and three snippets), a collection layer (`dsr-collection.css`), "Read more" for long descriptions, and settings.

## 2. Files

| File | Change |
|---|---|
| `templates/collection.json` | `banner` and `product-grid` enabled with their existing settings. `image_ratio` is set to `tall` (3:4, what the live AI grid uses). `show_collection_image` is off: the collection images are 2048 × 2048, and on a phone they would push the first products below the screen (the live page shows no image either). AI grid section `1783850161d9269d0b` set to `"disabled": true`; its blocks and settings are kept. |
| `templates/search.json` | Search results use the same 3:4 card (`image_ratio: tall`, was `adapt`) |
| `snippets/card-product.liquid` (Dawn) | `tall` ratio (3:4). Loads `dsr-card.css`. Both badge copies render `dsr-card-badge`. Renders swatches and sizes under the price. |
| `snippets/dsr-card-badge.liquid` (new) | Sold-out or sale badge: the markdown printed on the card (lowest price against lowest compare-at), floored; "Sale" below 1% |
| `snippets/dsr-card-swatches.liquid` (new) | Colour swatches from Shopify's swatch data (`option_value.swatch`) |
| `snippets/dsr-card-sizes.liquid` (new) | Sizes, struck through when no variant of that size is in stock |
| `assets/dsr-card.css` (new) | Card look: 3:4 photo on a warm neutral, uppercase tracked name, firmer price, restrained badge, swatches, sizes |
| `assets/dsr-card.js` (new) | Swatch behaviour (custom element `dsr-card-swatches`) |
| `assets/dsr-collection.css` (new) | Compact banner, "Read more", filter bar typography |
| `sections/main-collection-banner.liquid` (Dawn) | Description folds behind "Read more" (`dsr-read-more` element) when it is longer than about three lines. Loads `dsr-collection.css`. |
| `sections/main-collection-product-grid.liquid`, `sections/main-search.liquid` (Dawn) | Load `dsr-collection.css`; `tall` option in the image-ratio setting |
| `sections/featured-collection.liquid`, `sections/related-products.liquid`, `sections/main-product.liquid` (Dawn) | `tall` option in the card image-ratio setting (schema only) |
| `assets/component-swatch.css` | Back to Dawn 16.1 exactly: removes the dead colour-name map (it matched only an unused AI block) and fixes the unavailable state that clipped a swatch to a sliver (audit F20, F30) |
| `layout/theme.liquid` | Loads `dsr-card.js` once (deferred), when swatches are on |
| `sections/dsr-product-boost.liquid` | The sticky bar treats `?variant=…&pick=color` (from a card swatch) as "colour chosen, size not yet" |
| `config/settings_schema.json` | Theme settings → Dressar → Product cards (section 6) |
| `config/settings_data.json` | Colour scheme 4, used by the sale badge: background `#860505` instead of a literal `{{ shop.brand… }}` string with a black-to-white gradient (audit F04). Badge corner radius 4 instead of a 40 px pill. |
| `locales/en.default.json`, `locales/ar.json` | `dressar.card.*` (colours, sizes, sold out) and `dressar.collection.read_more/read_less` |
| 30 other `locales/*.json` | The `dressar.*` keys copied in English by `tests/sync_locales.py`. These languages are not published; this clears Theme Check's missing-translation errors (section 9). |

Tests: `tests/collection.test.js` (new), `tests/lib/catalog.js` (new), `tests/fixtures/catalog.json` (new), `tests/lib/theme-harness.js` (`paginate` tag, Arabic plural forms, JSON templates, page hook), `tests/liquid-logic.test.js` and `tests/pdp-sticky-sympl.test.js` (updated, section 9).

## 3. Collection page

- **H1** is the collection title (one per page). The description is clamped to three lines with a fade and an accessible "Read more" / "Show less" button (`aria-expanded`, `aria-controls`). Short descriptions show in full with no button. Without JavaScript the whole description shows.
- **Filters and sort** are Dawn's. Desktop and tablet (≥ 750 px): a horizontal bar of filter dropdowns, sort and product count. Phones: a "Filter and sort" drawer.
- **Active filters** show as removable pills, with "Remove all".
- **Empty filter result:** "No products found. Use fewer filters or remove all", with the link back to the unfiltered collection. **Empty collection:** "Sorry, there are no products in this collection".
- **Pagination:** 16 per page (the merchant's setting), real pages with real URLs, filters kept across pages.
- **Grid:** 2 columns below 990 px, 4 from 990 px (merchant settings). The first two photos load eagerly (LCP), the rest lazily.

**Which filters appear is decided in Shopify, not the theme:** Search & Discovery → Filters. See section 10.

## 4. Product card

One card for the collection page, search, recommendations and featured collections.

- **Photo:** 3:4 frame, cropped with `object-fit: cover` (never stretched), on the "Photo background" colour while it loads. Dawn's `srcset`/`sizes` plus `width`/`height`.
- **Second photo:** on hover, on desktop with a mouse, when the product has one. Touch screens keep the first photo.
- **Name:** uppercase and tracked (the owner's chosen reference), at most two lines.
- **Price:** "From" when sizes cost different amounts. The compare-at price is struck through when Dawn prints it.
- **Badge:** sold out, or the real markdown ("28% off" / "خصم 28%").
- **Colours:** Shopify's own swatches (colour or image), up to 5 and then "+N". A colour with no stock in any size is marked sold out. Products in one colour show none.
- **Sizes:** the product's own size order; a size is struck through when it has no stock in any colour. Sold-out products show none.

**Badge fix carried over from Stage 2:** Dawn prints the card badge twice, and on standard cards it hides the second copy. Stage 2 put the percentage on the hidden copy, so the visible badge still said "Sale". Both copies now render the same snippet. A test checks that the visible badge matches the card's printed prices on every sale card.

**Swatch behaviour:**
- A swatch with a variant photo is a button (`aria-pressed`). It shows that colour's photo, and on desktop with a mouse it previews on hover.
- Picking a colour points the card's links at the first in-stock variant in that colour (`?variant=…&pick=color`).
- On the product page that colour is preselected. The sticky add-to-cart bar still asks for a size first (the Stage 2 rule), because `pick=color` says only the colour was chosen.
- Swatches without a variant photo are plain dots with a text label (`role="img"`).

**No colour map:** swatch colours come only from the colour option's swatch data in Shopify (Settings → product options linked to the Color category metafield). A colour option without that data (some older products) shows "2 colours" instead of guessed dots.

## 5. Performance

- The AI grid's inline CSS and JS are no longer on collection pages.
- **Per card:**
  - One pass over the variants for sizes, one for the first in-stock variant per colour (≤ 25 variants each), no nested variant loops.
  - Swatch photo URLs are only computed for the up to 5 swatches shown.
- **Assets:**
  - `dsr-card.css` (5 KB unminified) loads once per section, the way Dawn loads its card CSS.
  - `dsr-card.js` (3 KB unminified, deferred) loads once per page. It loads globally because cards also arrive by fetch (filters, recommendations), where scripts don't run.
  - `dsr-collection.css` is 3 KB unminified.
- No library, no framework.
- **Layout stability:** the frame ratio is set before photos load, so the page doesn't jump. Filtering replaces the grid in place (Dawn).

## 6. Theme editor settings

Theme settings → Dressar → Product cards:

| Setting | Default | Notes |
|---|---|---|
| Photo background | `#f2ede8` | Behind photos while they load |
| Show colour swatches | on | |
| Show sizes | on | |
| Colour option names | `Color, Colour, اللون, لون` | Only for colour options without swatch data (they show a count) |
| Size option names | `Size, Sizes, المقاس, مقاس` | Not case-sensitive. The store has both "Size" and "SIZE". |

Collection page: the existing banner and grid settings (products per page, columns, image ratio now including "Tall (3:4)", hover photo, filters, sort, filter layout, quick add).

## 7. Accessibility

Dawn's semantics are unchanged: labelled filter controls, the drawer's focus trap and Escape, `aria-current` on the current page, the status region for the product count. Additions:

- **Swatches:**
  - Buttons named by colour, with `aria-pressed`. Sold-out colours are named "Genzari, sold out".
  - Tap targets about 29 × 29 px (WCAG 2.5.8 asks for 24).
  - Visible focus ring; keyboard operable.
- **Sizes:** a labelled list. Struck-through sizes are read as "L, sold out" (the strike is not the only cue).
- **"Read more":** a real button with `aria-expanded` and `aria-controls`.
- **Badges:** the text says it ("28% off", "Sold out"); the card link already points `aria-labelledby` at the badge (Dawn).

## 8. Language

- **New storefront strings** are locale keys. Arabic uses its own plural forms ("لونين" for two, "3 ألوان" for three).
- **Theme-editor labels** are plain English, like the existing Dressar group.
- **Arabic letter-spacing:** off for Arabic (`:lang(ar)`). Card names keep their tracking in English; Chromium keeps the Arabic half of bilingual names joined (checked).
- **Still left-to-right:** the Arabic storefront is still LTR, so mixed strings such as "خصم 14%" show their parts in LTR order. That is the right-to-left work planned in Stage 8.

## 9. Tests and results

| Suite | `en.default` | `ar` |
|---|---|---|
| `collection.test.js` (new) | 293 / 293 | 293 / 293 |
| `header.test.js` (Stage 3) | 210 / 210 | 210 / 210 |
| `liquid-logic.test.js` (Stage 2, updated) | 15 / 15 | |
| `pdp-sticky-sympl.test.js` (Stage 2, + 2 cases) | 47 / 47 | |

`collection.test.js` renders the real collection template from `tests/fixtures/catalog.json`. That file holds 11 real products from the Admin API (options, swatch colours, per-variant stock and prices, variant photos), plus 9 earlier fixture products with sizes added, repeated to the real Skirts size of 152.

It checks, at 360/390/430/768/990/1280/1440 px:

- **Page:**
  - one H1
  - product count
  - 16 cards on page 1, the AI grid gone
  - no horizontal overflow
  - 2 or 4 columns
- **Photos:**
  - every card photo is 3:4 and cropped
  - `srcset`/`sizes`/`width`/`height`
  - first two eager, the rest lazy
- **Badges and price:**
  - one visible badge per card
  - every visible sale badge equals the markdown on the card
  - 28% and "From" on the skirt whose 3XL costs more
  - sold out with no %
- **Swatches:**
  - the merchant's exact swatch colours
  - tap targets ≥ 24 px
  - a sold-out colour is marked
  - no swatches on one-colour products
  - "2 colours" where there is no swatch data
- **Sizes:**
  - match variant stock (Long Linen Shirt Dress: M and XL)
  - "SIZE" is found
  - none on sold-out products
  - the product's own order (L, XL, XXL, M, 3XL)
- **Long titles** stop at two lines.
- **Picking a colour with the keyboard:**
  - the card shows its photo
  - links get `variant=` (first in-stock of that colour) and `pick=color`
  - `aria-pressed` follows
- **Desktop hover:** shows the second photo; there is none for one-photo products; after a pick, the picked photo stays.
- **Phones:**
  - the filter drawer opens, locks the page and takes focus
  - Escape closes it and returns focus
  - "In stock" from the drawer updates the URL, count and grid in place, with a pill
- **Desktop and tablet:** the filter panel stays in the viewport, and "In stock" updates in place.
- **Sort, empty result, last page:**
  - price sort ascending, with the sort select showing it
  - an impossible filter combination shows the empty state with its link back
  - page 10 holds the last 8
- **Descriptions:**
  - Home Wear's description is collapsed, "Read more" expands it, and products start on the first screen
  - Pants (short) has no button
- **No JS errors.**

Plus:
- **Server side:** all 152 products reachable across 10 pages (no 50 cap).
- **Touch:** no hover-photo swap at 1024 px.
- **Search results:** the same card.
- **Empty collection:** says so.

**Theme Check:** 30 offenses, down from 210. Nothing new.
- The 180 "missing translation" errors (the `dressar.*` keys missing in 30 unpublished languages since Stage 2) are cleared by `tests/sync_locales.py`. The new keys would have added 150 more.
- The remaining 30 are warnings, all in files these stages did not change: AI blocks, Dawn files, the Sympl script URL.
- No Liquid syntax errors, and no offense in any file Stage 4 created or changed.

**Visual QA:** collection pages at 390 and 1280 px (Skirts, Home Wear), the filter drawer at 390 px and the filter panel at 1280 px, in English and Arabic, **in the test harness** (placeholder photos, real fonts). The real storefront could not be opened from this environment (`dressar.co` and Shopify's CDN are blocked by its network policy).

## 10. Manual checks and merchant actions

1. **Search & Discovery → Filters** (Shopify admin): make sure Availability, Price, Color and Size are on (Product type too, if wanted). The theme shows whatever is enabled, in that order. *Not readable through the Admin API, so not verified.*
2. **Swatch data:** some colour options aren't linked to the Color category metafield (for example "Linen blouse" black/marron, "Havan Linen Blouse"). They show "2 colours" instead of dots. Linking them (Products → the product → Color option → "Connect to category metafield") gives them swatches and the colour filter.
3. **On the preview:**
   - open Skirts, filter by size and colour, sort by price, page through
   - pick a colour on a card and open it: that colour should be preselected, and the sticky bar should ask for a size
   - check a long description (Home Wear) and "Read more"
4. **Theme editor:** Collection → banner and grid settings; Theme settings → Dressar → Product cards.

## 11. Risks

- **Dawn updates:** `card-product.liquid`, `main-collection-banner.liquid`, and the image-ratio schema lines in five sections carry small, marked edits.
- **Filters depend on store configuration:** with filters off in Search & Discovery, the bar shows only sort.
- **The harness is not Shopify:**
  - Filter counts and semantics follow Shopify's documented variant-level behaviour but are emulated.
  - Real filter labels and sort names come from Shopify.
- **Compare-at hidden on some cards:** when only the compare-at price varies by size (e.g. 449 / 499 at the same 249), Dawn prints no struck price. The badge still shows the conservative percentage (against the lowest compare-at price).
- **Sale badge colour:** fixing colour scheme 4 also changes the background of anything else set to that scheme. Today that is only a homepage slide whose text box is hidden, so nothing visible changes.
- **Rollback:**
  - In the theme editor, hide "Collection banner" and "Product grid" and show the AI section again.
  - Or revert this commit.

## 12. Widths tested

360, 390, 430, 768, 990, 1280, 1440 px (and 1024 px with touch), in `en.default` and `ar`.
