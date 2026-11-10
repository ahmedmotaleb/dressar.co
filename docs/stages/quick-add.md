# Quick add: outlined "+" button on product cards

**Status:** on the branch only. **Not uploaded to any Shopify theme.** On 2026-11-10, before this commit, the dev theme `#167837270247` was published and became the live theme (see `docs/dev-theme.md`). This work may only go to an unpublished theme, so it waits for one to preview it on.

## What changed

Every product card now has a square **"+"** on its photo. It replaces Dawn's full-width "Choose options" / "Add to cart" text button.

| | |
|---|---|
| Look | 38 × 38 px, 1px solid #1F1F1F border, white, 2px radius, black 18px plus centred; no text, shadow or gradient |
| Where | The photo's bottom corner, 10px in: bottom-right, or bottom-left on Arabic (right-to-left) pages. It doesn't touch the sale or sold-out badge, which sits on the other corner. |
| When it shows | **Desktop with a mouse (990px and up):** on hover and on keyboard focus. **Phones, tablets and touch screens:** always. |
| Accessible name | "Quick add to cart" (Arabic: "إضافة سريعة إلى السلة") plus the product's title, from locale keys `dressar.card.quick_add` |
| Everywhere cards show | Collection pages, search results, the homepage rows and "Complete the look" |

## Behaviour

Built on Dawn's own quick-add parts.

- **Several variants (sizes, colours):** opens Dawn's quick-add dialog with the product's own colour and size picker, price and add-to-cart button (`modal-opener`, `quick-add-modal`, `assets/quick-add.js`).
  - The breadcrumbs and the long "Fabric & Fit" section stay out of the dialog (Dawn's `quick-add-hidden`).
  - If a colour swatch was tapped on the card, the dialog opens on that colour.
- **One variant:** adds it straight to the cart through Dawn's `product-form` (`assets/product-form.js`).
- **After adding:** the cart drawer opens with the item and the cart count updates (Dawn's cart drawer).
- **Duplicate clicks:** ignored while a request is running (Dawn's `aria-disabled` guard).
- **Sold out:** the button is disabled (and faded). Nothing opens or adds.
- **Card navigation is unchanged:** tapping anywhere else on the card opens the product. Colour swatches work as before.

## Setting

Theme settings → Dressar → Product cards → **"Show quick add button"** (on). One switch for every card, so it's the same everywhere. Each section's own Dawn "Quick add" setting still works; its "Bulk" mode is untouched.

## How it's built

| File | Change |
|---|---|
| `snippets/dsr-card-quick-add.liquid` (new) | The button (opener, or one-variant product form) and the dialog. IDs include the section, so the same product in two homepage rows doesn't repeat IDs. |
| `snippets/card-product.liquid` (Dawn) | Renders the button on the photo and the dialog where Dawn kept its quick add. Loads Dawn's `quick-add.css` with the cards. Dawn's text button is gone. |
| `assets/dsr-card.css` | Button styles, corner position (logical properties for right to left), hover/focus reveal |
| `assets/dsr-card.js` | A picked colour also points the dialog at that colour |
| `layout/theme.liquid` | Loads `quick-add.js`, `product-info.js` and `product-form.js` **once**, because cards also arrive by fetch. Product pages already load the last two. |
| `sections/main-search.liquid`, `sections/related-products.liquid` (Dawn) | Pass the section ID to the cards |
| `sections/main-product.liquid` (Dawn) | Breadcrumbs and "Fabric & Fit" marked `quick-add-hidden` |
| `config/settings_schema.json` | The setting |
| `locales/*.json` | `dressar.card.quick_add` |

## Three things found on the way

1. **Dawn's quick-add picker didn't work outside product pages.** Dawn loads `product-info.js`, which drives the variant picker, only with the product section. So in the quick-add dialog on a collection page, choosing a colour or size changed nothing, and the default variant was added. It now loads once with the quick add.
2. **The button has to sit beside the photo box, not inside it.** Dawn gives `.card__inner` a transform (`perspective(0)`, for gradient continuity), which keeps anything inside it under the card's full-card link. The button lives in a click-through frame the size of the photo, using the card's own aspect ratio, so only the "+" takes clicks.
3. **Dawn's dialog IDs weren't unique per section** (`QuickAdd-<product>`), so a product in two homepage rows repeated them. They now include the section ID.

## Tests

`tests/quick-add.test.js` (new), 224 checks: English at 360, 390, 430, 768, 1280 and 1440 px, and Arabic at 390 and 1280.

- **Look and position:** size, border, colour, radius, no shadow, icon size and centring, no text.
- **Placement:** the corner (end side in both directions), 10px in, clear of the badge.
- **Taps:** the button takes the tap above the card link; the rest of the photo still opens the product.
- **Accessible name:** from the locale.
- **Visibility:** hidden at rest and shown on hover or focus on desktop; always shown on phones, tablets and a touch screen at desktop width.
- **One-size product:** one click, one request, the right variant; a second click while adding is ignored; the drawer opens and the count goes to 1.
- **Sold out:** the one-size and multi-size products are disabled, and nothing happens.
- **Several sizes:** the dialog opens with the picker, without breadcrumbs, inside the screen. Picking a colour and size, then adding, adds exactly that variant once; the dialog closes, the drawer opens and the count goes to 1.
- **Swatches:** still change the photo, and the dialog opens on the picked colour.
- **Everywhere:**
  - homepage rows, search results and Complete the look all have the button on every card
  - the scripts load once, and no IDs repeat
  - no JS errors, no horizontal overflow

The test harness's `{% form %}` tag now renders Shopify's arguments: IDs from variables, `data-type`, `novalidate`. Before, the product page's form had no ID in the harness.

### Results

| Suite | en | ar (right to left) |
|---|---|---|
| quick-add (new) | 224/224, both languages in one run | |
| schema, liquid-logic, pdp-sticky-sympl | 6/6, 15/15, 47/47 | |
| header | 210/210 | 210/210 |
| collection | 293/293 | 293/293 |
| product | 183/183 | 183/183 |
| cart | 73/73 | 73/73 |
| home | 349/349 | 349/349 |
| a11y (axe-core WCAG 2.2 AA) | 78/78 | 78/78 |
| seo | 51/51 | 51/51 |
| rtl (both languages) | 29/29 | |
| perf | 18/18 | 18/18 |
| regression | 50/50 | 50/50 |

- **Theme Check:** 23 warnings, unchanged; none from this change.
- **One intermittent miss, fixed in the test.**
  - **What happened:** in one full run, the 430px size check failed once (223/224), and six re-runs passed.
  - **Cause:** Dawn's reveal-on-scroll slides each card in with a fractional `translateY`. Chromium's on-screen box for a moving card can then measure 37.999996 or 38.000004px tall. A sweep of positions reproduced this about 5% of the time.
  - **Fix:** the check now compares the button's layout size, which the animation doesn't change, and prints any card that fails.
- **Visual QA:** in the test harness only, with placeholder photos, not on the real store. Screenshots checked:
  - 390px in English and Arabic
  - 1280px on hover
  - the open dialog

## Manual checks, once it's on a preview theme

- **On a phone:**
  - tap "+" on a product with sizes, pick a size, add
  - tap "+" on a one-size product
  - check the cart drawer and count
- **On a desktop:** hover a card, then tab through a grid with the keyboard.
- **In Arabic (`/ar/`):** the "+" sits bottom-left.
- **Apps:** inside the dialog, check the Sympl widget and Preorder Duck (if it changes sold-out buttons).

## Rollback

- **In the editor:** Theme settings → Dressar → Product cards → switch off "Show quick add button".
- **In code:** revert this commit.
