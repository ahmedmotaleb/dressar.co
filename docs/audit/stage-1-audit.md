# DRESSAR theme: Stage 1 audit

| | |
|---|---|
| Date | 2026-10-26 |
| Theme audited | **Live (MAIN)** `#167717929191` "Updated copy of DRESSAR — Sales Optimized (DRAFT for review)", Dawn **16.1.0** |
| Scope | Audit only. No production code was changed. The live theme was read, not written. |
| Snapshot | The theme files at the root of this repo are an exact copy of the live theme as of this audit (see Appendix D). |

## How this audit was done

- **Source:** all 382 files of the live theme were pulled read-only through the Shopify Admin API. Every Liquid, CSS, JS and SVG file matched Shopify's MD5 checksum byte for byte. The 68 JSON files come back pretty-printed with Shopify's standard "auto-generated" header (the same form `shopify theme pull` gives), and all of them parse.
- **Customization map:** the live theme was diffed against stock Dawn from `github.com/Shopify/dawn` (`main` at 2026-10-22, the closest reference to 16.1.0). The previous draft theme (Dawn 15.5.0) was diffed against Dawn `v15.5.0`. This separates DRESSAR changes from Dawn's own version changes.
- **Lint:** Shopify Theme Check 3.31.0 (`@shopify/theme-check-node`), recommended config. Baseline in Appendix A.
- **Store data:** read-only Admin API queries for themes, menus, collections, product options and swatches, metafield definitions, pages, locales, shipping profiles, discounts and customer-account mode.
- **Not done (limitation):** the cloud environment's network policy blocks `dressar.co`. No page was rendered in a browser, so console errors, network requests, CLS and visual checks were **not** measured. Anything marked **(verify in browser)** is a code-level finding to confirm on a preview before acting on it.

---

## Headlines

1. **Collection pages show at most 50 products.** The collection grid is an AI-generated block that never paginates. Skirts (152 products), Dresses (107), White Friday Sale (100), New Arrivals (95), Shirts & Blouses (84), Last Pieces (63) and Winter (54) silently lose everything after product 50. → F15
2. **The sale badge on Dawn product cards is broken markup.** It shows the wrong discount on PDP "Complete the look" cards and a Liquid error on search results. → F22
3. **There are two mobile sticky Add-to-cart bars** on every product page, stacked on top of each other. → F24
4. **Category navigation is broken.** The live header is an AI block with no submenus on mobile, and its desktop dropdown sits inside `overflow: hidden`. The 7 category collections under "All Categories" can't be reached from the menu on phones (96% of sessions, per the theme's own notes). → F08
5. **The Sympl installment widget receives an empty price** in all three placements. → F25
6. **The Dawn header, collection banner and collection grid are disabled**, not deleted. Native filtering, pagination, predictive search, cart count and a11y-tested menus already exist in the theme and can be brought back instead of rebuilt. → Section F
7. **The live theme is being edited directly.** `templates/collection.json` and `AGENTS.md` changed on MAIN today at 18:16. No unpublished copy matches live, so a fresh dev duplicate is needed before Stage 2. → F01

---

## A. Architecture summary

### A1. Themes in the store

| Theme | ID | Role | Base | Notes |
|---|---|---|---|---|
| Updated copy of DRESSAR — Sales Optimized (DRAFT for review) | 167717929191 | **MAIN (live)** | Dawn 16.1.0 | Created 2026-10-22 by Shopify's theme-update flow from the DRAFT below. Edited directly as recently as 2026-10-26. |
| DRESSAR — Sales Optimized (DRAFT for review) | 167716749543 | Unpublished | Dawn 15.5.0 | Parent of live. 109 files differ from live (Dawn version changes). Still has the classic customer templates. |
| Copy of DRESSAR V4 - card design for sympl | 159363104999 | Unpublished | Dawn (older) | Last edited 2026-10-24. No `dsr-product-boost`. |
| OLD DRESSAR | 151742906599 | Unpublished | custom | |
| Horizon | 151609442535 | Unpublished | Horizon | |

None of the unpublished themes is a safe dev copy of what is live. Stage 2 should start from a **fresh duplicate of the live theme** (F01).

### A2. How the live theme is put together

The theme is stock Dawn 16.1.0 plus a DRESSAR layer. Stock Dawn is untouched in `global.js`, `product-info.js`, `facets.js`, `main-product.liquid`, `main-collection-product-grid.liquid`, `facets.liquid`, `header.liquid` and almost every other section and snippet. The DRESSAR layer has three parts.

**1. AI-generated theme blocks** (`blocks/ai_gen_block_*.liquid`, 26 files, ~520 KB of Liquid). Each one is self-contained, with an inline `<style>`, an inline `<script>`, a custom element and 40–83 settings. They are placed inside generic `_blocks` sections. 7 are active:

| Block | Name | Used on | Replaces |
|---|---|---|---|
| `0c61721` | Main header | `sections/header-group.json` | Dawn `header` section (set to `"disabled": true`) |
| `8ec498c` | Product grid | `templates/collection.json` | Dawn `main-collection-banner` + `main-collection-product-grid` (both disabled) |
| `c5191df` ×4 | Featured collection carousel | `templates/index.json` | — |
| `13d13cc` | Featured collection carousel | `templates/index.json` | — |
| `4a20873` | Media grid | `templates/index.json` | — |
| `f4a271d` | Dressar video grid | `templates/index.json` | — |
| `c719b9a` | Icons with text | `templates/index.json` | — |

13 more are not used anywhere and 6 are present only as disabled blocks (Appendix C).

**2. Hand-written DRESSAR code**

| File | What it does |
|---|---|
| `sections/dsr-product-boost.liquid` | Mobile sticky ATC bar (asks the shopper to pick a size first), plus CSS for the PDP trust list, sale badge and inventory line |
| `assets/product-form.js:193-356` | A **second** mobile/tablet sticky ATC bar |
| `assets/cart-drawer.js:143-282` | Free-shipping progress bar in the cart drawer (hard-coded 1500 EGP) |
| `assets/component-card.css:596-796` | Card design for the AI grids, clickable-card overlay, AI link colours, `animation: none !important` on slideshows, Judge.me mobile overflow fix, PDP price sizes |
| `assets/component-swatch.css` | Rewritten base `.swatch` rules plus a colour-name → hex map (dead on live, F20) |
| `snippets/price.liquid:41-49, 125-130` | PDP sale badge reads "خصم X% · وفّري Y" |
| `snippets/card-product.liquid:564-571` | Broken "Save X%" badge edit (F22) |
| `snippets/whatsapp-button.liquid` + `layout/theme.liquid:404` | Floating WhatsApp button (hard-coded number) |
| Sympl widget | `snippets/cart-drawer.liquid:533-536`, `sections/main-cart-footer.liquid:65-68`, `templates/product.json` custom_liquid block |
| `locales/en.default.json` | 40+ Dawn strings rewritten in Arabic |
| `assets/dressar-*.css/js` (6 files) | Empty stubs that say "Not loaded" |

**3. App embeds** (`config/settings_data.json`): Judge.me (core plus cart-drawer widget), Whatflow (WhatsApp chat button), Preorder Restock Duck, and WB Frequently Bought Together. Judge.me also supplies 4 app blocks (PDP badge, featured carousel, review widget, homepage testimonials).

### A3. What renders on each template

| Template | Sections (in order). Disabled ones are omitted. |
|---|---|
| Header group | Dawn announcement bar (2 rotating messages) → AI header `0c61721` |
| `index` | Slideshow (3 slides) → AI carousel "White Friday" → Collection list (6) → AI carousel "Best sellers" → AI carousel "New arrivals" → Slideshow "Home wear" (2) → AI carousel "Complete looks" → AI media grid → AI carousel "Back to university" (`13d13cc`) → AI video grid "Dressar Signature" → Multicolumn "Why Dressar" → AI icons-with-text → Judge.me testimonials |
| `collection` | AI product grid `8ec498c` only |
| `product` | Dawn `main-product` (title, Judge.me badge, price, Sympl, variant picker, inventory, quantity, buy buttons, trust list, description, "model wears L" text, 3 collapsible tabs, share) → Dawn disclosures → Judge.me carousel → Dawn related products "كمّلي اللوك | Complete the look" → Judge.me review widget → `dsr-product-boost` |
| `search` | Dawn `main-search` (native filters and sort) |
| `cart` | Dawn cart items + footer (+ Sympl) |
| Footer group | Dawn footer (logo, about text, support text, footer menu, newsletter, social, payment icons) |

### A4. Store facts that constrain the design

| Fact | Source | Consequence |
|---|---|---|
| 533 products, 17 collections. 7 collections have more than 50 products. | Admin API | Server-side pagination is mandatory (F15). |
| Options are **linked to Shopify category metafields**: `shopify.color-pattern` (with merchant swatch hex/images), `shopify.size`, `shopify.fabric` | product options | Native `option_value.swatch.color` is available. No hand-made colour map is needed (F20). |
| Most colours are separate products (one Color value each). Some, such as Long Linen Shirt Dress (3 colours, 8 images), are multi-colour. | product options | Card swatches matter mainly for multi-colour products. Swatch → image swap needs variant images. |
| Sizes M, L, XL, XXL, 3XL. Price sometimes varies by size (e.g. 399/449). | variants | Cards should show "from" pricing or the lowest price consistently. |
| Shipping: flat **85 EGP Cairo / 100 EGP rest of Egypt**, Egypt only, no threshold in the rates. | delivery profiles | Free shipping exists **only** through the discount below. |
| Automatic discount "شحن مجاني White Friday – للطلبات من 1500 جنيه": free shipping at ≥ 1500 EGP subtotal, from 2026-10-21, **no end date** | discounts | A progress bar is legitimate today. The threshold must be configurable and switchable (F07). |
| Locales: **`en` is primary**, `ar` is published secondary | shopLocales | The default storefront serves Arabic copy under `lang="en"` (F02). |
| New customer accounts | customerAccountsV2 | Dawn 16 dropping the classic `templates/customers/*` is correct here, not a bug. |
| Product metafield definitions: fabric, fit, care-instructions, sleeve length, dress length, neckline, and Search & Discovery `related_products` / `complementary_products`. No custom DRESSAR metafields. | metafieldDefinitions | Fabric, Fit, Care and Complete the Look can be data-driven. "Model size" needs a new definition (F26). |
| Pages exist: size-chart, care-instructions, faq, about, contact, homewear-policy | pages | Size guide and FAQ can link to real pages. |
| Main menu: Home, White Friday Sale, **All Categories (7 children)**, Complete Looks, Back to University, Home Wear, Last Pieces, Navy & Blue | menus | Nested menu support is required on mobile (F08). |

---

## B. Current feature inventory

| Area | Exists today | Implementation | State |
|---|---|---|---|
| Announcement bar | Rotating, 2 messages | Dawn | ✅ works. Copy hard-codes 1500 EGP. |
| Header | Centred logo, 2-row centred menu, transparent on home, sticky "always", account/search/cart icons | AI block `0c61721` | ⚠️ no cart count, no submenus on mobile, clipped dropdown, CLS, a11y gaps |
| Predictive search | Code present and enabled in settings | Dawn | ❌ not mounted anywhere (it lived in the disabled Dawn header) |
| Search results page | Native filters and sort, horizontal | Dawn `main-search` | ✅ (except the broken sale badge on cards) |
| Collection page | Grid, client-side sort, in-page title search, client "pagination" | AI block `8ec498c` | ❌ 50-product cap, no filters, no title/H1/count |
| Native filters, sort, pagination, mobile filter drawer | Present | Dawn `main-collection-product-grid` + `facets.liquid` | 💤 disabled in `collection.json` |
| Product cards | 5 different implementations | Dawn `card-product` + 4 AI blocks | ⚠️ inconsistent. No sold-out state on AI cards. Broken Dawn sale badge. |
| Colour swatches on cards | Yes | AI blocks, name-guessing | ⚠️ wrong colours; native swatch data ignored |
| Size chips on cards | Yes (collection grid) | AI block | ⚠️ ignores availability |
| PDP | Gallery with thumbnails, hover zoom, variant buttons and native swatches, URL `?variant=`, price/compare-at, inventory, quantity, ATC plus dynamic checkout (Buy now), collapsible tabs, share, product JSON-LD | Dawn `main-product` | ✅ solid foundation |
| PDP sale badge with % and amount | Yes | `snippets/price.liquid` (custom) | ✅ honest maths. Copy hard-coded. |
| Sticky ATC (mobile) | **Two** implementations | `dsr-product-boost` + `product-form.js` | ❌ duplicated and stacked |
| Trust list / size help | COD, inspect before paying, 3-day exchange, nationwide delivery, WhatsApp size help | `custom_liquid` block + `dsr-product-boost` CSS | ✅ works. Hard-coded number differs from the floating button. |
| Size guide | Collapsible tab → `/pages/size-chart` | Dawn collapsible tab | ✅ |
| Complete the look | "Related products" intent | Dawn `related-products` | ⚠️ should use complementary intent (data empty) |
| Reviews | Judge.me badge, carousel, review widget, home testimonials, cart drawer widget | App | ⚠️ PDP widget set to `sample_data` (verify) |
| Cart drawer | Thumbnail, title, variant, qty +/-, remove, line price, note, discounts, subtotal, checkout, focus trap | Dawn | ✅ |
| Free-shipping progress | Yes, in drawer | Custom JS in `cart-drawer.js` | ✅ correct today. Threshold and copy hard-coded. |
| BNPL (Sympl) | Cart drawer, cart page, PDP | Third-party widget | ❌ price attribute empty |
| WhatsApp | Floating button + Whatflow app button | Custom snippet + app | ⚠️ likely duplicated. 3 different numbers. |
| Footer | Logo, about, support links, menu, newsletter, social, payment icons | Dawn | ✅. FAQ link points to size chart. |
| Recently viewed | Block exists | AI `4dc647a` | 💤 disabled |
| Wishlist | — | — | none |

---

## C. Problems discovered

Each finding has an ID, a priority, the evidence (`file:line`) and its impact.

### C1. Process and global

**F01 · P0 (process): no safe dev copy, and live is being edited directly.**
MAIN changed on 2026-10-26 18:16 (`templates/collection.json` disabled the University marquee block, and `AGENTS.md` was added). The DRAFT is Dawn 15.5.0 and 109 files behind live. Editing a stale draft would bring back old Dawn code when published.
→ Duplicate the live theme as "DRESSAR DEV" and do all work there. This repo's snapshot is the rollback baseline.

**F02 · P1: language architecture.**
The primary locale is `en`, but 40+ Dawn UI strings in `locales/en.default.json` were rewritten in Arabic. Arabic (`/ar/`) is a secondary language whose custom `locales/ar.json` is missing 222 keys, which fall back to the default. As a result:
- The default storefront renders Arabic UI under `<html lang="en">`, left-to-right (`layout/theme.liquid:2`). Screen readers and search engines treat it as English.
- Future Dawn updates will conflict with the in-place edits to `en.default.json`.
- Hard-coded links in the AI header drop the `/ar/` prefix (F13).

This is a business decision (should Arabic become primary? should the site be RTL?), so it is listed under Decisions.

**F03 · P1: typography and legibility.**
Heading and body font are both `poppins_n2` (weight **200**, `config/settings_data.json`), and body text is drawn at 75% opacity (`layout/theme.liquid:122`). Poppins has **no Arabic glyphs**, so Arabic copy falls back to whatever the device has: a different typeface and weight from the Latin text. Thin, low-contrast body text on a mobile-first fashion store hurts readability and contrast (WCAG 1.4.3).

**F04 · P2: broken colour schemes.**
- `scheme-2` is text `#121212` on background `#000000` (`settings_data.json:213`). It is used by blog cards, which makes their text invisible.
- `scheme-4`'s background is the literal string `{{ shop.brand.colors.primary[0].background }}` with a black→white gradient (`settings_data.json:235`). It is the **sale badge** scheme (`:108`), so white badge text sits on the white end of the gradient.

**F05 · P2: two floating WhatsApp integrations.**
`snippets/whatsapp-button.liquid` is rendered on every page (`layout/theme.liquid:404`) **and** the Whatflow "WhatsApp chat button" app embed is enabled, which probably means two floating buttons (verify in browser). The snippet hard-codes the number, Arabic copy and position (`:14-18`) and runs an infinite pulse animation.

**F06 · P1: three different WhatsApp numbers.**
- `201035612069`: floating button (`snippets/whatsapp-button.liquid:14`)
- `201020676173`: PDP size-help link (`templates/product.json`, block `dsr_trust`)
- `01020676173`: Size Chart tab text (block `collapsible_tab_RC7gzi`)

Customers may be contacting a number nobody answers. The correct number needs confirming, then it should become one theme setting.

**F07 · P1: free-shipping threshold hard-coded in four places.**
1. `assets/cart-drawer.js:161` (`150000` piastres plus Arabic copy in JS)
2. `locales/en.default.json` → `products.product.shipping_policy_html`, shown under the price on **every** PDP
3. `sections/header-group.json:27` (announcement)
4. `templates/index.json` (hero subheading)

The claim is true today only because of a campaign discount with no end date (A4). Base shipping is a flat 85/100 EGP. If the discount is edited or switched off, the PDP and drawer will keep promising free shipping.

### C2. Header, navigation, search (`blocks/ai_gen_block_0c61721.liquid`)

**F08 · P0: category navigation.**
- **Mobile:** the menu renders only top-level links (`:523-527`), so "All Categories" and its 7 children (Skirts, Shirts & Blouses, Dresses, Basics, Pants, Coats & jackets, Abayas & Cardigans) are unreachable from the menu. Tapping "All Categories" lands on the generic `/collections` list.
- **Desktop:** the dropdown is positioned inside `.ai-header-wrapper { overflow: hidden }` (`:101`), so it is clipped (verify in browser). It opens on `:hover` only (`:256`): no keyboard, no touch.

**F09 · P1: no live cart count, and the icon doesn't open the drawer.**
The cart icon is a plain `<a href="/cart">` (`:468`) with no `#cart-icon-bubble`. Dawn's drawer can't bind to it (`assets/cart-drawer.js:11-12`), and the `cart-icon-bubble` section re-render has no target, so the count never shows.

**F10 · P1: no predictive search.**
Search is a link to `/search` (`:462`). Predictive search is enabled (`settings.predictive_search_enabled`), and its section and JS ship, but they were mounted by the disabled Dawn header. They now load on every page for nothing (F40).

**F11 · P1: layout shift from the sticky header.**
At `scrollY > 100` the wrapper switches to `position: fixed` (`:126-135`) with no placeholder. On every non-home page the content jumps up by the whole header height. The scroll handler is not passive and runs on every scroll event (`:575-593`).

**F12 · P1: header accessibility.**
- Account, search and cart are icon-only links with no accessible name (`:455-472`).
- The hamburger has a hard-coded English `aria-label="Open menu"` and no `aria-expanded`/`aria-controls` (`:415`).
- The mobile menu has no focus trap, doesn't close on Escape, and leaves the page behind it focusable.
- There is no `<header>` landmark.

**F13 · P2: header styling and robustness.**
- Menu hover colour `#000000` on a `#000000` header makes the link vanish on hover. Dropdown hover is `#ffffff` text on `#f0f0f0` (`header-group.json:111-120`).
- Height: 36 px top + 36 px bottom padding, a 180 px logo, a 40 px logo-to-menu gap and the menu row make a tall header. The brief asks for a compact one.
- The `menu_type: "mega"` option does nothing. The country/language "selectors" are `href="#"` dead links (currently off).
- The logo is a single 600w `src` with an invalid `height="auto"` (`:430`).
- Routes are hard-coded as `/`, `/account`, `/search`, `/cart` (Theme Check `HardcodedRoutes`), which breaks `/ar/`.

**F14 · P2: SEO loss from disabling the Dawn header.**
The Organization (logo, social `sameAs`) and WebSite/SearchAction JSON-LD in `sections/header.liquid:461-505` is no longer output anywhere.

### C3. Collection page (`blocks/ai_gen_block_8ec498c.liquid`)

**F15 · P0: 50-product cap.**
`{% for product in source_collection.products %}` (`:301`) has no `{% paginate %}`, and Shopify returns at most 50 products in that case. 7 of 17 collections are truncated:

| Collection | Products | Hidden |
|---|---|---|
| Skirts | 152 | 102 |
| Dresses | 107 | 57 |
| White Friday Sale (live campaign) | 100 | 50 |
| New Arrivals | 95 | 45 |
| Shirts & Blouses | 84 | 34 |
| Last Pieces | 63 | 13 |
| Winter Collection | 54 | 4 |

**F16 · P1: no real filtering.**
The only controls are a client-side sort and a title search over the ≤ 50 rendered cards. There are no Shopify filters (availability, price, size, colour, type), no mobile filter drawer, and nothing in the URL. "Pages" are shown and hidden client-side, so they can't be linked, shared or crawled. Dawn's native grid and facets, which do all of this, are disabled at `templates/collection.json:14,23`.

**F17 · P1: no collection heading.**
With the Dawn banner disabled, collection pages have no H1, title, description or product count.

**F18 · P1: grid bugs.**
- A search with no matches replaces the container's `innerHTML` (`:639`), destroying the cards. Clearing the search then leaves an empty grid until reload.
- "Featured" sort returns `0` (`:571`), so it never restores the original order.
- The UI is English on an Arabic store: "Sort by:", "Featured", "Search products...", "Color:", "Size:", "Previous", "Next", "Page x of y", "No products found", "Save X%".
- The `<label>Sort by:</label>` isn't associated with its `<select>`, and the search field has only a placeholder as its label (`:272-288`).

**F19 · P1: sold-out and size availability.**
No AI card (collection or homepage) shows a sold-out state. The collection card lists every size value (`limit: 5`), whether or not it's in stock, pre-marks the first one `.active`, and clicking a size does nothing (`:459-467`, `:606-613`). That implies a selection and availability that may be false.

**F20 · P1: swatches ignore the merchant's colour data.**
- Options are linked to `shopify.color-pattern`, with hex values set by the merchant (for example Genzari = `#0E7F8B`, baby blue = `#a2cce4`).
- The blocks instead guess from the name with `contains` (`:393-433`): "baby blue" → pure `#0000ff`, unknown names → `#cccccc`.
- The CSS fallback map in `assets/component-swatch.css:31-145` is **dead on live**. Its selector `[data-color-swatch][data-color=…]` only matches the unused block `8e2a527`. Its guesses also contradict the merchant's data (Genzari → olive `#6b7c5e`).
- Clicking a swatch swaps the image but not the card's link to that variant.

**F21 · P1: five product-card implementations.**
Dawn `snippets/card-product.liquid` (search, PDP recommendations), `8ec498c` (collection), `c5191df` (4 homepage rows) and `13d13cc` (homepage row). The DRESSAR card design is CSS aimed at AI class names through `[class*='ai-product-card…']` substring selectors (`assets/component-card.css:596-796`), which is fragile. Prices, badges, swatches and image ratios differ between pages. The `13d13cc` swatches are `<div>`s with click handlers, so they aren't keyboard-operable.

### C4. Product cards and pricing

**F22 · P0: broken sale badge in Dawn cards (`snippets/card-product.liquid:564-571`).**
```liquid
class="badge badge--bottom-left color-{% assign discount = product.compare_at_price | minus: product.price | times: 100 | divided_by: product.compare_at_price %}
<span style="color: red;">Save {{ discount }}%</span>
  >
```
A Liquid `assign` and a `<span>` were pasted **inside the class attribute**, and the maths uses `product` instead of `card_product`.
- The HTML comes out malformed (Theme Check `LiquidHTMLSyntaxError` at `:572`), and the badge loses its colour scheme.
- On the PDP "Complete the look" row, every card shows the **current product's** discount: a wrong number, which is a misleading-pricing risk.
- On search results `product` is nil, so the `divided_by` raises a divide-by-zero Liquid error.
- It affects every on-sale card Dawn renders.

**F23 · P2: card images.**
The AI blocks use a single fixed `image_url: width: 600/800` with no `srcset`/`sizes`. The homepage rows send 800w images to ~180 px-wide mobile cards. `width`/`height` attributes are set (good for CLS).

### C5. Product page

**F24 · P0: duplicate mobile sticky ATC.**
- `assets/product-form.js:193-356` injects a bar at ≤ 989 px (z-index 4) that presses the real button straight away.
- `sections/dsr-product-boost.liquid` renders another at ≤ 749 px (z-index 899) that asks the shopper to pick a size first.

Both are `position: fixed; bottom: 0`, so on phones they stack. Between 750 and 989 px the floating WhatsApp button (z-index 900, offset only for the `dsr` bar) sits over the first bar's Add to cart button.

**F25 · P0 (verify in browser): the Sympl installment widget gets an empty price.**
- PDP: `productprice="{{productPrice}}"` (custom_liquid block in `templates/product.json`)
- Cart drawer: `productprice="{{cartTotalAmount}}"` (`snippets/cart-drawer.liquid:535`)
- Cart page: `productprice="{{cartTotalAmount}}"` (`sections/main-cart-footer.liquid:67`)

Neither variable exists (Theme Check `UndefinedObject`), so all three render `productprice=""` and the instalment amounts can't be right. The PDP widget also wouldn't follow variant price changes. On `/cart` the drawer and the page both include it, so the remote script tag appears twice.

**F26 · P1: static "the model in the photo wears Large" on every PDP.**
Block `text_BKGPDg` (`templates/product.json:116`) says "البنت اللي في الصورة مقاسها لارج" on all 533 products. It is false wherever the model wears another size, and it is a size-related returns risk. It should come from a product metafield and be hidden when empty.

**F27 · P1, or P0 if confirmed: Judge.me review widget set to `"review_data": "sample_data"`.**
Section `178648157455ed3771` in `templates/product.json`. Confirm in the theme editor that this only affects the editor preview. If sample reviews show on the live storefront, that is fake social proof.

**F28 · P2: PDP details aren't data-driven; no breadcrumbs.**
Fabric, fit and care live in free-text descriptions and a shared page. The standard metafields `shopify.fabric`, `fit`, `care-instructions`, `sleeve-length-type` and `skirt-dress-length-type` exist but are mostly empty and unused. There are no breadcrumbs and no BreadcrumbList JSON-LD.

**F29 · P2: "Complete the look" uses related intent.**
The Dawn `related-products` section uses `intent=related`. Search & Discovery's `complementary_products` metafield exists but is empty on the 50 products sampled. Use complementary intent with related as fallback, and fill in the data.

**F30 · P2 (verify in browser): unavailable colour swatches.**
`.swatch--unavailable` (`assets/component-swatch.css:19-28`) clips the whole swatch to a thin diagonal sliver, so an unavailable colour loses its colour. The base `.swatch` rules were rewritten and ignore Dawn 16.1's `--swatch-focal-point`.

**F31 · P3: hard-coded copy.**
The PDP sale-badge copy (`snippets/price.liquid:125-126`), the trust list, the sticky bar's "اختاري مقاسك" label and the WhatsApp texts are hard-coded rather than coming from locale strings or settings. Emojis in the trust list and announcements work against the "premium, restrained" brief.

### C6. Cart

**F32 · P2: free-shipping bar mechanics.**
Beyond F07, the bar fetches `/cart.js` on **every** page load (`assets/cart-drawer.js:282`), even with the drawer closed: one extra request per page view. It has no `aria-live`, so screen-reader users don't hear progress updates. The Dawn cart drawer itself is stock and fine.

**F33 · P2: an upstream Dawn fix is pending.**
Dawn `main` (2026-10-22, PR #4004, "Fix cart icon and drawer refresh after Standard Actions updates") changes `assets/cart.js` and `assets/standard-actions-override.js` after 16.1.0. Adopt it when Shopify releases it. Don't hand-patch.

### C7. Homepage (`templates/index.json`)

**F34 · P2: 7 H1s on the homepage.**
Every slide in both slideshows (5) plus the collection-list and multicolumn titles are set to `h1`. The brand/logo has none.

**F35 · P2: slideshow motion and loading.**
Both slideshows use `image_behavior: "ambient"`, and that is then cancelled with `animation: none !important` in `assets/component-card.css`. Set the setting to none and delete the override. The second slideshow's first image loads eagerly even though it is far below the fold (Dawn sets `fetchpriority` correctly only for the first section).

**F36 · P2: weight.**
Four instances of `c5191df` each inline their own CSS and carousel JS (the block is 27 KB of Liquid). With 5 hero slides, 6 product rows (up to 12 products each, two images per card), a media grid, a video grid and a reviews carousel, the page is long and heavy on mobile.

**F37 · P3: hierarchy.**
New Arrivals is the 5th section. The page has two hero slideshows and no "shop by category" block near the top: the collection list is labelled "shop by need" and mixes categories with campaigns. There is no newsletter on the page (the footer's heading is English: "Subscribe to our emails"). Disabled leftovers remain in the template.

### C8. Footer

**F38 · P2: footer links and markup.**
The "FAQ" link actually points to `/pages/size-chart` and opens a new tab (`sections/footer-group.json:36`). The about and support text use `<h5>` for paragraph text, which puts 8 fake headings on every page.

### C9. Maintainability and performance hygiene

**F39 · P2: dead code.**
- 13 unused AI blocks and 6 present only as disabled (Appendix C). They show up in the editor's block picker for every `_blocks` section.
- 6 stub assets `dressar-*.css/js` (76–987 B, "Not loaded").
- ~115 lines of dead swatch-map CSS (F20).
- Empty `_blocks` sections in `collection.json` and `footer-group.json`.
- The orphaned snippet `quick-order-product-row.liquid` is a Dawn file, so leave it.

**F40 · P2: unused JS/CSS loaded globally.**
`predictive-search.js` and `component-predictive-search.css` (F10), and `details-modal.js` (only used by Dawn's header search modal).

**F41 · P2: locales.**
In-place edits to `en.default.json` (F02), and `ar.json` missing 222 keys (Appendix A).

**F42 · P2: Theme Editor overload.**
9 AI blocks exceed Shopify's 40-settings guideline (43–83 settings each). Colours are set per block instead of through colour schemes, and several strings can't be edited at all.

### C10. What could not be checked (needs a browser on a preview URL)

Console errors, third-party script weight (Judge.me ×6 placements, Whatflow, Preorder Duck, WB FBT, Sympl), real CLS/LCP numbers, horizontal overflow at 360/390/430/768 px, duplicate event listeners at runtime, 404 requests, and visual confirmation of F05, F08 (desktop), F25, F27 and F30.

---

## D. Priority list

### P0: broken or revenue-critical
| ID | Issue | Area |
|---|---|---|
| F01 | No dev copy matching live, and live edited directly | Process |
| F15 | Collection grid capped at 50 products (7 collections truncated) | Collection |
| F22 | Broken sale badge in `card-product.liquid` (wrong % / Liquid error) | Cards |
| F24 | Two stacked sticky ATC bars on mobile PDP | PDP |
| F08 | Category submenus unreachable on mobile, clipped on desktop | Header |
| F25 | Sympl widget receives an empty price (verify) | PDP/Cart |
| F27 | Judge.me widget on `sample_data` (P0 if it shows on live) | PDP |

### P1: high-impact conversion and UX
F09 cart count / drawer · F10 predictive search · F11 header CLS · F12 header a11y · F16 native filters · F17 collection heading · F18 grid bugs · F19 sold-out and size availability · F20 native swatches · F21 one consistent card · F26 model-size metafield · F06 WhatsApp numbers · F07 configurable free-shipping threshold · F02 language architecture (decision) · F03 typography/contrast

### P2: performance and maintainability
F04 colour schemes · F05 duplicate WhatsApp · F13 header robustness · F14 Organization JSON-LD · F23 srcset · F28 metafield-driven details and breadcrumbs · F29 complementary recommendations · F30 unavailable swatch · F32 free-shipping fetch · F33 upstream Dawn fix · F34 H1s · F35 slideshow · F36 homepage weight · F38 footer · F39 dead code · F40 unused global JS · F41 locales · F42 editor overload

### P3: cosmetic
F31 hard-coded copy and emojis · F37 homepage hierarchy

---

## E. Files and components to modify

| Stage | Files | Change |
|---|---|---|
| 2 (P0) | `snippets/card-product.liquid:564-571` | Restore a valid badge using `card_product`. Show "−X%" only when `compare_at_price > price`, with the text from locale strings. |
| 2 | `templates/collection.json` **or** `blocks/ai_gen_block_8ec498c.liquid` | Either re-enable Dawn's banner and grid (recommended, see G), or as a stop-gap wrap the AI loop in `{% paginate %}` with the Dawn `pagination` snippet. |
| 2 | `assets/product-form.js:193-356`, `sections/dsr-product-boost.liquid` | Keep **one** sticky bar (the `dsr` section: editor-controllable, asks for a size first). Remove the injected duplicate and carry over its "mirror sold-out/disabled" behaviour. |
| 2 | `templates/product.json` (Sympl block), `snippets/cart-drawer.liquid:533-536`, `sections/main-cart-footer.liquid:65-68` | Pass real prices (format to confirm with Sympl). Load the script once. Update the PDP value on `variant:change`. |
| 2 | Theme editor (Judge.me block) | Switch review data to real reviews if sample data is visible. |
| 3 | `sections/header-group.json`, `sections/header.liquid`, `snippets/header-*.liquid`, `assets/base.css` / `component-menu-drawer.css` | Re-enable the Dawn header with DRESSAR styling (centred logo, centred menu, black scheme, transparent-on-home option) and retire AI block `0c61721`. Turn on predictive search in the header. |
| 3 | `sections/predictive-search.liquid`, `assets/component-predictive-search.css` | Show product image, title, price/compare-at and availability. Products first. |
| 4 | `templates/collection.json`, `sections/main-collection-banner.liquid`, `sections/main-collection-product-grid.liquid`, `snippets/facets.liquid` | Native filters (availability, price, size, colour, type, configured in Search & Discovery), sort, pagination, mobile drawer, H1 and product count. |
| 4 | `snippets/card-product.liquid` (+ a new `snippets/card-swatches.liquid`, `snippets/card-sizes.liquid`), `assets/component-card.css` | One DRESSAR card everywhere: fixed ratio with `object-fit`, secondary image on hover, honest sale %, native swatches (`option_value.swatch`), available/unavailable sizes, sold-out badge, `srcset`. |
| 4 | `assets/component-swatch.css` | Remove the dead colour map. Restore Dawn 16.1's base swatch rules and a legible unavailable state. |
| 5 | `templates/product.json`, `sections/main-product.liquid` (blocks only) | Breadcrumbs; metafield-driven Fabric/Fit/Care and model-size rows; tidy block order; one WhatsApp setting. |
| 6 | `assets/cart-drawer.js:143-282`, `config/settings_schema.json` | Free-shipping bar driven by theme settings (on/off, threshold, copy) and rendered from cart data already in the drawer: no extra fetch, `aria-live`. |
| 6 | `sections/related-products.liquid` (or a new `sections/complete-the-look.liquid`) | Complementary intent, related fallback, uses the shared card. |
| 7 | `templates/index.json`, homepage blocks | Reorder to the target flow, one H1, replace the 4× `c5191df` carousels with one reusable section using the shared card, remove disabled leftovers. |
| 8 | `layout/theme.liquid`, `config/settings_data.json`, `locales/*.json`, `snippets/whatsapp-button.liquid`, footer group | Fonts, colour schemes, lang/dir, unused global JS, JSON-LD, locale strings, WhatsApp settings, footer links. |
| 8 (cleanup) | `blocks/` (19 files), `assets/dressar-*.css/js` (6 stubs) | Delete only after confirming they aren't referenced by any template in the store (Appendix C). |

---

## F. Already exists: do NOT rebuild

| Feature | Where | Use it as |
|---|---|---|
| Header with nested drawer menu, dropdown/mega menu, sticky with no CLS, cart count bubble, drawer trigger, predictive-search modal, account, localization, Organization/WebSite JSON-LD | `sections/header.liquid`, `snippets/header-drawer.liquid`, `header-dropdown-menu`, `header-mega-menu`, `header-search` (disabled in `header-group.json:73`) | The base of the Stage 3 header |
| Predictive search (products, collections, pages, queries) | `sections/predictive-search.liquid`, `assets/predictive-search.js` | Restyle and extend, don't rewrite |
| Native filtering (Shopify filter API), sort, server pagination, mobile filter drawer, URL state, active-filter pills, product count | `sections/main-collection-product-grid.liquid`, `snippets/facets.liquid`, `snippets/pagination.liquid`, `assets/facets.js` (disabled in `collection.json:23`) | The base of the Stage 4 collection page |
| Collection banner with H1 and description | `sections/main-collection-banner.liquid` (disabled in `collection.json:14`) | Re-enable |
| Product card with fixed ratio, hover image, sold-out and sale badges, quick add | `snippets/card-product.liquid` | Fix F22 and extend into the single DRESSAR card |
| PDP: gallery, variant picker with native swatches, `?variant=` URL sync, media switching, price/compare-at, inventory, quantity, ATC, dynamic checkout (Buy now), sold-out handling, collapsible tabs, share, pickup, product JSON-LD | `sections/main-product.liquid`, `assets/product-info.js`, `assets/product-form.js` (lines 1-192), `assets/media-gallery.js` | Keep. Configure blocks only. |
| PDP sale badge "خصم X% · وفّري Y" | `snippets/price.liquid` | Keep the maths. Move the copy to locales. |
| Sticky ATC that asks for a size first | `sections/dsr-product-boost.liquid` | Keep this one, drop the duplicate |
| Complementary products block, related products section | `main-product` `complementary` block, `sections/related-products.liquid` | Use for Complete the Look |
| Cart drawer and cart page (thumbnail, title, variant, qty, remove, price, subtotal, note, discounts, focus trap) | `snippets/cart-drawer.liquid`, `assets/cart-drawer.js`, `assets/cart.js`, `sections/main-cart-*` | Keep. Fix Sympl, make the shipping bar configurable. |
| Free-shipping progress logic (subtotal-based, matches the discount) | `assets/cart-drawer.js:143-282` | Keep the logic, move the threshold and copy to settings |
| Announcement bar, footer, newsletter, collection list, multicolumn, slideshow, collapsible content | Dawn sections | Configure, don't replace |
| Reviews, WhatsApp chat, preorder/restock, frequently bought together | Apps | Don't duplicate in theme code |
| Swatch colours and images | Shopify `color-pattern` metaobjects (Admin → product options) | The single source of truth for swatches |

---

## G. Recommended implementation order

**Stage 2a: safety first (no storefront change)**
1. Duplicate the live theme as **"DRESSAR DEV"**. Optionally connect it to this repo through Shopify's GitHub integration so every push syncs to the dev theme only.
2. Confirm the decisions below.

**Stage 2b: P0 fixes on the dev theme**
1. F22 card badge (one snippet, smallest blast radius).
2. F24 remove the duplicate sticky ATC.
3. F25 Sympl prices (after confirming the format).
4. F15 collection cap. Recommended: re-enable Dawn's banner and grid now, which gives native pagination and filters immediately; Stage 4 then restyles them. A stop-gap `paginate` in the AI block would otherwise be thrown away in Stage 4.
5. F08 navigation. Fixed by Stage 3's header (if the Dawn header is approved, it ships straight after 2b; otherwise patch the AI block's mobile menu and dropdown here).
6. F27 Judge.me check in the editor.

**Stage 3: header, search, navigation** (F08–F14, F40-partial)
Dawn header + DRESSAR styling, compact mobile header (menu, logo, search, cart), optional sticky, live cart count, drawer trigger, nested mobile menu, predictive search with image, price, compare-at and availability.

**Stage 4: collection, cards, swatches, filters** (F15–F21, F23, F30)
Native facets plus a mobile drawer, H1 and count, one DRESSAR card component everywhere, native swatches with variant-image swap, availability-aware sizes, sold-out state, `srcset`. Requires filter setup in Search & Discovery.

**Stage 5: PDP** (F26, F28, F31)
Breadcrumbs (plus JSON-LD), metafield-driven Fabric/Fit/Care/model size, block order, size guide, single sticky ATC polish (<990 px and dialogs), WhatsApp setting.

**Stage 6: cart and recommendations** (F07, F29, F32, F33)
Settings-driven free-shipping bar, Complete the Look with complementary intent.

**Stage 7: homepage** (F34–F37)
Target flow, a single H1, one reusable product-row section replacing the AI carousels, cleanup.

**Stage 8: performance, SEO, accessibility** (F02–F05, F14, F38–F42)
Fonts, colour schemes, lang/dir, JSON-LD, unused JS, locales, dead-code removal.

**Stage 9: cross-device QA**
360/390/430/768 px and desktop, console, network, CLS, Theme Check delta against Appendix A.

---

## Decisions needed before Stage 2

1. **Dev theme.** May Claude create the duplicate through the Admin API (an unpublished copy of the live theme, never published), or will you duplicate it in Admin → Online Store → Themes → ⋯ → Duplicate? Do you want the GitHub integration connected to it?
2. **Header.** Recommended: restore the Dawn header and restyle it to the current look. The alternative is patching the AI header block.
3. **Collection page.** Recommended: re-enable Dawn's native grid and facets and restyle the cards. The alternative is patching the AI block, which has no access to native filters without a rewrite.
4. **WhatsApp.** Which number is correct (`201035612069` or `201020676173`)? Keep the custom button or the Whatflow app button, not both?
5. **Language.** Should Arabic become the primary language (Settings → Languages), and should the storefront be right-to-left? This is a large design change, because Dawn has no built-in RTL. It is not part of Stage 2.
6. **Sympl.** What price format does the widget expect (EGP with decimals, or piastres)? Sympl's integration guide or support can confirm.
7. **Model size.** OK to create a product metafield (for example `custom.model_size`, single-line text) and fill it per product?

## Manual Shopify configuration that code can't do

- Search & Discovery → Filters: enable Availability, Price, Size, Color, Product type (and Fabric if wanted).
- Search & Discovery → Recommendations: fill in complementary products for Complete the Look.
- Product data: fill in Fabric, Fit and Care metafields; model size (after decision 7).
- Judge.me: confirm the review widget shows real data (F27).
- Free-shipping campaign: decide whether the automatic discount ends, and match the theme setting to it.
- Colour schemes 2 and 4 (F04) can be fixed in Theme settings → Colors.

---

## Appendix A: Theme Check baseline (live theme, 255 offenses)

| Severity | Count | Check |
|---|---|---|
| Error | 222 | MatchingTranslations (all in `locales/ar.json`) |
| Error | 1 | LiquidHTMLSyntaxError, `snippets/card-product.liquid:572` (F22) |
| Warning | 9 | ExcessiveSettingsCount (AI blocks, 43–83 settings) |
| Warning | 6 | UnusedAssign |
| Warning | 6 | UndefinedObject (`cartTotalAmount` ×2 → F25; `amount` in disabled block `35c082d`; 3 are Dawn false positives) |
| Warning | 5 | HardcodedRoutes (4 in the AI header → F13) |
| Warning | 2 | RemoteAsset (Sympl ×2) |
| Warning | 2 | VariableName (Dawn) |
| Warning | 1 | OrphanedSnippet (Dawn) |
| Warning | 1 | LiquidComplexity (`snippets/facets.liquid`, Dawn) |

Stage 9 should show no new offenses against this baseline.

## Appendix B: DRESSAR changes vs stock Dawn

- `layout/theme.liquid`: +1 line (WhatsApp snippet render).
- `sections/main-cart-footer.liquid`, `snippets/cart-drawer.liquid`: Sympl widget.
- `snippets/card-product.liquid`: broken badge (F22).
- `snippets/price.liquid`: PDP savings badge.
- `assets/product-form.js`, `assets/cart-drawer.js`, `assets/component-card.css`, `assets/component-swatch.css`: appended DRESSAR blocks (Section A2).
- New: `sections/dsr-product-boost.liquid`, `snippets/whatsapp-button.liquid`, 26 `blocks/ai_gen_block_*.liquid`, 6 `assets/dressar-*` stubs, `AGENTS.md`.
- Everything else matches Dawn 16.1.0. The remaining diffs against Dawn `main` are Dawn's own 16.1 doc-comment changes, plus the post-16.1 upstream fix noted in F33.

## Appendix C: AI block usage

| Status | Blocks |
|---|---|
| Active (7) | `0c61721` header · `8ec498c` collection grid · `c5191df` ×4 home rows · `13d13cc` home row · `4a20873` media grid · `f4a271d` video grid · `c719b9a` icons |
| Disabled only (6) | `0f087b7` announcement · `24adf50` featured collection · `35c082d` price comparison · `3cce436` media slideshow · `4dc647a` recently viewed · `c781fe7` announcement |
| Unused (13) | `20925d5` · `22187a5` · `33a376d` · `59620d2` · `5d0c3b8` · `5e179fb` · `616f91c` · `8b981a5` · `8e2a527` · `a2450c4` · `bce2c9d` · `c87a290` · `eb40921` |

## Appendix D: snapshot and rollback

- The repo root holds the live theme `#167717929191` exactly as read on 2026-10-26. Code files match Shopify's MD5 checksums. JSON files are Shopify's pretty-printed form with the standard header comment.
- **Rollback:** the live theme is not modified by any stage. Every stage works on the dev duplicate, so rolling back means not publishing it. If a published dev theme ever needs reverting, re-publish the previous theme in Admin → Themes, or restore files from this commit.
