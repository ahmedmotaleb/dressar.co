# Stage 9: release candidate

**Status: ready for merchant preview. Not published.**

| | |
|---|---|
| **Branch** | `claude/dressar-theme-audit-7xbdeb` (PR #1, not merged) |
| **Dev theme** | `#167837270247` "DRESSAR DEV (Claude) — from live 2026-10-26", **unpublished**, synced to this release candidate |
| **Live theme** | `#167717929191`, **never written**. Its `updatedAt` is still 2026-10-26 18:16 UTC (before the audit). |
| **Base** | Dawn 16.1.0, snapshot of live in `09c373a` |

## 1. Stages

| Stage | Commit | What changed | Report |
|---|---|---|---|
| 1 Audit | `a6c2ca8` | 42 findings, P0–P3 | `docs/audit/stage-1-audit.md` |
| 2 P0 fixes | `d2bee8d`, `c44c8b8` | Card sale badge; one sticky add-to-cart; Sympl widget with real prices; WhatsApp number setting; model-size block; collection pagination stop-gap | `stage-2.md` |
| Language groundwork | `33ecaf7` | Complete Arabic locale, real English default locale | `language.md` |
| 3 Header | `8ef021d` | Dawn header restored with DRESSAR styling: accessible drawer, dropdowns, predictive search, cart bubble, no layout shift | `stage-3.md` |
| 4 Collection and cards | `049423e` | Dawn grid, filters, sort and pagination (no 50 cap); one 3:4 DRESSAR card with honest % badge, colour swatches and sizes | `stage-4.md` |
| 5 Product page | `135cf8f`, `97560ae` | Hierarchy, size help on WhatsApp, model size, metafield-driven fabric and fit, reassurance row, sale badge from locales | `stage-5.md` |
| 6 Cart | `7da521a` | Settings-driven free-shipping progress in the drawer and on the cart page; complementary-first "Complete the look"; one WhatsApp button | `stage-6.md` |
| 7 Homepage | `b55b350` | Dawn product rows replace 5 AI carousels; merchandising order; nothing auto-rotates; categories in 3 columns | `stage-7.md` |
| 8 Localization, SEO, accessibility, performance | `2e55206` | Right-to-left Arabic; breadcrumbs and BreadcrumbList; axe-clean pages; footer markup; contrast and typography; product LCP priority | `stage-8.md` |
| 9 Release candidate | this commit | Regression matrix; dead code removed; this report | this file |

The commits between them (`0514c79`, `cb08fe5`, `bf82fdb`, `179076d`, `67ed12b`, `47bca7f`, `9f22b56`, and the last one) record each dev-theme sync in `docs/dev-theme.md`.

## 2. Stage 9 cleanup

Every deletion was proven unused first: no reference anywhere in the theme. The search covered templates, section groups, `config/settings_data.json`, every Liquid file, and the other blocks' schemas.

| Removed | Why it was safe |
|---|---|
| 13 AI blocks: `ai_gen_block_20925d5`, `22187a5`, `33a376d`, `59620d2`, `5d0c3b8`, `5e179fb`, `616f91c`, `8b981a5`, `8e2a527`, `a2450c4`, `bce2c9d`, `c87a290`, `eb40921` | Referenced by nothing; they only cluttered the editor's block picker (audit F39) |
| 6 stub assets `assets/dressar-*.css/js` (76–987 B) | Loaded nowhere; each said "Not loaded" or "Superseded" |
| 129 lines of AI-card CSS in `assets/component-card.css` | Targeted only the AI product cards. No enabled section prints them: the homepage rows are Dawn since Stage 7, the collection grid since Stage 4. |
| Two empty AI containers: `templates/collection.json` `17858764834ef3df09`, `sections/footer-group.json` `1783552182a339475d` | No blocks; each rendered an empty `<div>` |

**Kept on purpose:**
- **AI blocks referenced by switched-off sections** (header group, homepage, product and collection templates): `0c61721`, `0f087b7`, `13d13cc`, `24adf50`, `35c082d`, `3cce436`, `4dc647a`, `8ec498c`, `c5191df`, `c781fe7`.
  - A template that names a missing block is refused by Shopify.
  - They are the rollback for Stages 3, 4, 5 and 7.
  - Switched back on, `13d13cc` and `8ec498c` would now show without the old DRESSAR polish (link colours, card type), since that CSS is gone.
- **AI blocks in use:** `4a20873` (editorial photos), `c719b9a` (service icons), `f4a271d` (videos).
- **App integration code** (Judge.me, Sympl, Whatflow, Preorder Duck, WB FBT), untouched.
- **`snippets/quick-order-product-row.liquid`** (Dawn's own) and `snippets/dsr-model-size.liquid`. Theme Check calls the latter orphaned because it is rendered from a Custom Liquid block in `templates/product.json`, which it can't see.

**On the dev theme**, the 3 changed files are synced (MD5-identical). The 19 deleted files are still there: this environment's Shopify connector refuses file deletion on any theme. They are unreferenced and load nowhere; `docs/dev-theme.md` lists them and the two ways to remove them (GitHub-connected theme, or Edit code).

## 3. Tests

All commands run from `tests/` with `npm test`. Each suite also runs in Arabic with `LOCALE=ar node <suite>.test.js ..`. The harness renders the theme's real Liquid, CSS and JavaScript in Chromium, with store data from the Admin API (read-only).

| Suite | What it covers | `en.default` | `ar` (right to left) |
|---|---|---|---|
| `schema.test.js` | Schema and template rules Shopify enforces on upload | 6 / 6 | |
| `liquid-logic.test.js` | Stage 2 sale-badge maths | 15 / 15 | |
| `pdp-sticky-sympl.test.js` | Stage 2 sticky add-to-cart and Sympl | 47 / 47 | |
| `header.test.js` | Header, menus, drawer, search, cart bubble | 210 / 210 | 210 / 210 |
| `collection.test.js` | Grid, filters, sort, pages, cards, search results | 293 / 293 | 293 / 293 |
| `product.test.js` | Product page, variants, media, size help, fabric and fit | 183 / 183 | 183 / 183 |
| `cart.test.js` | Drawer, cart page, free shipping, Complete the look | 73 / 73 | 73 / 73 |
| `home.test.js` | Homepage order, rows, hero, categories | 349 / 349 | 349 / 349 |
| `a11y.test.js` | axe-core WCAG 2.2 AA, keyboard, reduced motion | 78 / 78 | 78 / 78 |
| `seo.test.js` | H1, canonical, structured data, breadcrumbs, images, crawlable menus | 51 / 51 | 51 / 51 |
| `rtl.test.js` | Arabic against English, direction setting | 29 / 29 (both languages) | |
| `perf.test.js` | LCP element, CLS, duplicate scripts, blocking CSS | 18 / 18 | 18 / 18 |
| `regression.test.js` (new) | 10 page types × 7 widths: overflow, JS errors, missing assets, single UI; global flows | 50 / 50 | 50 / 50 |
| **Total** | | **1,402** | **1,305** |

**Theme Check** 3.31: **23 offenses, all warnings, none from this upgrade's own code**. It was 30 through Stages 3–8; the 7 that went with the deleted AI blocks are gone. What remains:
- **AI blocks still referenced:** settings counts, hard-coded routes.
- **Dawn's own:** variable names, complexity, an unused assign.
- **Two known false positives:** `scheme_classes`, the orphaned model-size snippet.
- **The Sympl script on its CDN** (`RemoteAsset`).

**Static checks** (`schema.test.js`):
- schema names of at most 25 characters
- unique setting IDs
- valid select defaults
- template blocks that their section declares
- template values allowed by their schema

### Regression matrix (the brief's list)

| Area | Item | Where it's covered |
|---|---|---|
| Homepage | navigation, hero, collections, carousels/grids, links, footer | `home`, `header`, `regression` |
| | reviews | **manual** (Judge.me renders from the app) |
| Collection | all products reachable (152, no 50 cap), pagination, sort, every enabled filter, clear filters, sold out, sale cards, swatches, sizes, mobile filter drawer | `collection` (293 checks per language) |
| Search | predictive search | `header` |
| | full results, sale and long titles | `collection` |
| | no results | `regression` |
| PDP | variant switching, price, compare-at, sale %, media, sold-out variant, size guide, model size | `product` |
| | Sympl, sticky add to cart, add to cart | `pdp-sticky-sympl`, `product`, `cart` |
| | dynamic checkout | off on purpose (Stage 5) |
| | Complete the look | `cart` |
| | reviews | **manual** |
| Cart | drawer, quantity update, remove, shipping progress, subtotal, Sympl | `cart` |
| | checkout handoff (POST `/cart`, `name="checkout"`, drawer and page) | `regression` |
| | discounts | **manual** (needs real discount codes) |
| Global | account entry, announcement bar, cart count, footer, language switch (`/localization`), 404, contact and newsletter forms | `regression` |
| | WhatsApp: one button, labelled | `regression`, `cart`, `a11y` |

### Quality gates

| Gate | Result |
|---|---|
| No new Liquid syntax errors | Theme Check: none (one was caught during Stage 8 and fixed before commit) |
| No critical console errors | None on any page, any width, either language |
| No broken asset requests caused by theme changes | Every theme asset requested exists (`regression`, `home`) |
| No horizontal overflow | None at 360–1440 px on 10 page types, both languages |
| No duplicate header, announcement, sticky add-to-cart, cart, search or WhatsApp UI | One of each (`regression`, `header`, `pdp-sticky-sympl`) |
| No collection truncation | All 152 skirts reachable |
| No fake availability | Sizes and swatches follow variant stock; sold-out products list no sizes |
| No incorrect sale percentage | Badge = floor((compare − price) / compare), checked on every sale card |
| No hard-coded navigation URLs introduced | Menus come from Shopify; breadcrumbs from `routes` and objects; footer FAQ now uses the existing page |
| Stage 2 behaviour still passes | `liquid-logic` 15/15, `pdp-sticky-sympl` 47/47 |
| Theme Editor remains usable | Schema checks pass; every new option is a setting or block. **Manual check** in the real editor. |
| Dev theme remains unpublished | `UNPUBLISHED` (checked at every sync) |
| Live theme remains untouched | Never written; `updatedAt` 2026-10-26 18:16 UTC |

## 4. Visual QA

Done **in the test harness only**: the theme's real code with placeholder photos, no apps, and Poppins from `@fontsource`. Screenshots were reviewed for:
- **Header:** sticky, drawer, dropdowns, search, at 360–1440.
- **Collection:** banner, filters, filter drawer, at 360–1440.
- **Product page:** 360–1440.
- **Cart drawer:** 360–1440.
- **Homepage:** 390 and 1280, plus full-page captures at seven widths.
- **Footer:** 390 and 1280.
- **Arabic right to left:** every page above.

The real storefront (`dressar.co`, `*.myshopify.com`, the preview URL) can't be reached from this environment, so **no screenshot of the real store was taken**.

## 5. Performance

Harness measurement at 390 px with the CPU slowed 4×. This is not a Lighthouse score; details are in `stage-8.md`.

| Page | LCP element | CLS | Notes |
|---|---|---|---|
| Home | hero photo, high priority | ≈ 0 | 2,655 DOM elements (40 product cards) |
| Collection | first product photo, eager | 0 | first two cards eager, the rest lazy |
| Product | featured photo, high priority | ≈ 0 | |

Compared with live:
- **Homepage:** 5 AI carousels removed (13.6 KB of inline script and 25 KB of inline CSS fewer), and no auto-rotation or infinite zoom.
- **Cart:** no `/cart.js` request on page load.
- **Collection:** one card system instead of the 34 KB AI grid.
- **Third-party scripts:** unmeasured (see manual checks).

## 6. Manual checks on the preview (required before publishing)

1. **Open the preview** of theme `#167837270247`: Online Store → Themes → … → Preview, on a phone and a desktop, in English (`/`) and Arabic (`/ar/`).
2. **Homepage:**
   - real photos in the 3:4 rows, swipe each row, hero stays still
   - Judge.me testimonials show under the service icons
3. **Collection:**
   - filters (Search & Discovery's filter list, see merchant actions), sort, page 2, a sold-out product, a sale card
   - tap a colour swatch
4. **Product page:**
   - change size and colour
   - sold-out size
   - size chart popup, WhatsApp size help, model size (a product with `custom.model_size`)
   - Sympl widget amounts
   - sticky add-to-cart on a phone (only one)
   - Judge.me badge and reviews, Complete the look
5. **Cart:**
   - add, change quantity, remove in the drawer
   - free-shipping bar
   - a real discount code
   - Sympl, Judge.me's cart widget
   - **checkout: go through to payment** (cash on delivery and Sympl) without completing, or complete a test order if the store has a test mode
6. **Arabic, right to left:**
   - menu drawer from the right, submenus, cart drawer from the left
   - filters, search, product gallery swipe, breadcrumbs
7. **Theme editor:**
   - open each template, select sections and blocks
   - check the new settings: Theme settings → Dressar (cards, free shipping, language direction), banner "Show breadcrumbs", product block "Dressar: breadcrumbs"
8. **Lighthouse** (mobile) on home, a collection and a product page; Google Rich Results Test on a product page.
9. **Apps:** each app still works where it renders (Judge.me, Sympl, Preorder Duck, WB FBT); only one WhatsApp button.

## 7. Merchant actions

Only things that need Shopify Admin or a business decision:

1. **Search & Discovery → Filters:** choose the collection filters (availability, price, colour, size). The Admin API showed none set, so the storefront shows Shopify's defaults.
2. **Search & Discovery → Recommendations:** add complementary products ("Complete the look"). Only 2 products have them today.
3. **Free shipping:** keep Theme settings → Dressar → Free shipping in step with the automatic discount; switch it off when the offer ends.
4. **White Friday:** when the sale ends, switch off the homepage campaign row and the hero's first slide, and update the announcement bar.
5. **Alt text** for product photos (none of the 50 checked has any) and homepage images.
6. **Default language:** decide whether Arabic becomes the default (`docs/stages/language.md`). Translate the English storefront with Translate & Adapt, including the footer's "Subscribe to our emails".
7. **Product data:**
   - category metafields (fabric, fit, length, sleeve, neckline, care), which feed "Fabric and fit"
   - `custom.model_size` for photographed products
8. **Brand copy:** consider naming hijab-friendly styling and maxi lengths on the homepage (`stage-7.md`).
9. **Apps:** switch off the Whatflow embed if only its (hidden) button used it.
10. **Dev theme leftovers:** before publishing `#167837270247`, delete the 19 unused files that Stage 9 removed from the branch (`docs/dev-theme.md`), or publish a GitHub-connected theme built from the branch instead.

## 8. Known limitations

- **No real-store QA from here:** the storefront, preview and CDN are blocked, so all browser testing is in the harness.
- **Apps aren't rendered in tests:** Judge.me, Sympl's script, Whatflow, Preorder Duck and WB FBT.
- **Checkout, payments and discounts** happen on Shopify's side and weren't exercised.
- **Right to left** is new to this Dawn theme. Every page type was checked in the harness at seven widths, but real devices and app widgets (Judge.me) may still show left-to-right leftovers.
- **Homepage DOM size** (2,655 elements) is above Lighthouse's 1,400 guideline.
- **Merchant content** in Arabic is declared English on the English default storefront until the language decision (merchant action 6).
- **Dawn updates:** DRESSAR's own code lives in `dsr-*` files. Small edits in Dawn files are marked "Dressar" and need merging by hand when Dawn is updated:
  - **Scripts:** `global.js`, `media-gallery.js`, `product-modal.js`, `theme-editor.js`.
  - **Layouts:** `theme.liquid`, `password.liquid`.
  - **Sections:** `header`, `predictive-search`, `main-collection-banner`, `main-collection-product-grid`, `main-search`, `featured-collection`, `main-product`, `related-products`, `main-cart-footer`.
  - **Snippets:** `card-product`, `price`, `product-thumbnail`, `cart-drawer`, `header-drawer`, `header-dropdown-menu`.
  - **Styles:** the DRESSAR block at the end of `component-card.css`.
  - **Back to stock Dawn** after live's custom edits: `cart-drawer.js`, `component-swatch.css` and `product-form.js` (Stage 2 removed its injected sticky bar).

## 9. Rollback

- **Before publishing:** nothing to roll back; live is untouched.
- **After publishing:**
  - Online Store → Themes: publish the previous theme again (`#167717929191` stays in the library, unchanged).
  - This is the full rollback, one click.
- **Per feature, in the editor:**
  - **Right to left:** Theme settings → Dressar → "Right-to-left layout for Arabic".
  - **Free shipping:** Theme settings → Dressar → Free shipping.
  - **Breadcrumbs:** banner setting and product block.
  - **Homepage rows:** switch a Dawn row off and its old AI section on.
  - **Complete the look:** "Products shown" → Related only.
- **In code:** revert a stage's commit on the branch (each stage is one commit), then sync.

## 10. Publish checklist

1. **Finish §6 on the preview.** Fix or accept every finding.
2. **Merchant actions 1, 3 and 4** (filters, free shipping, campaign) set for launch day.
3. **Check for edits made after this candidate:**
   - Compare the live theme's `updatedAt` with 2026-10-26 18:16 UTC. If live has changed since, copy those edits (Theme editor or files) into the dev theme first.
   - Compare the dev theme against the branch head (`docs/dev-theme.md` explains how).
4. **Duplicate the current live theme** as a dated backup (Themes → … → Duplicate).
5. **Publish** `#167837270247` (or the GitHub-connected theme built from the branch: Themes → Add theme → Connect from GitHub).
6. **If Arabic becomes the default** (`language.md`): straight after publishing, Settings → Languages → Change default → Arabic.
7. **Within the first hour, on the live site:**
   - homepage, a collection, a product, add to cart, checkout to the payment step, in both languages
   - Judge.me, Sympl and WhatsApp
8. **Merge PR #1** once the published theme is confirmed, so `main` matches what's live.
