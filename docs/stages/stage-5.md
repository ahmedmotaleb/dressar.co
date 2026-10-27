# Stage 5: product page and variants

## 1. Approach

Dawn's product section stays the base: gallery, variant picker with native swatches, `?variant=` URLs, price, stock line, quantity, add to cart, collapsible tabs, product JSON-LD. Stage 2's fixes stay as they were: sale badge maths, the single sticky bar, Sympl, model size.

Stage 5 reorders the page to the brief's hierarchy, swaps hard-coded content for native blocks and settings, and adds two small Dressar blocks: WhatsApp size help, and fabric and fit.

## 2. New order (`templates/product.json`, theme-editor editable)

| # | Block | Notes |
|---|---|---|
| 1 | Title | the page's only H1 |
| 2 | Price, compare-at, sale badge, Sympl | Badge copy now a locale string: "28% off · save 101 ج.م" / "خصم 28% · وفّري 101 ج.م" |
| 3 | Judge.me review summary | moved below the price |
| 4 | Colour and size (Dawn variant picker) | swatches from Shopify's swatch data; sizes with no stock in the chosen colour are struck through |
| 5 | **Size guide** (Dawn "Pop-up" block → page `size-chart`) | Opens the real Size Chart page in a dialog, next to the size picker. It used to be a tab near the bottom. |
| 6 | **WhatsApp size help** (new block) | Same number as the floating button (Theme settings → Dressar), product named in the message |
| 7 | Model size (Stage 2) | moved next to the size help; renders nothing without `custom.model_size` |
| 8 | Stock line (Dawn inventory) | "Low stock: 3 left" / "Out of stock" |
| 9 | Quantity | unchanged |
| 10 | Add to cart | **"Buy it now" turned off** (section 5) |
| 11 | **Reassurance** (Dawn "Icon with text" block) | The merchant's four promises in three items, with Dawn icons instead of emojis: cash on delivery after inspection · exchange within 3 days · delivery across Egypt |
| 12 | Description | product details |
| 13 | **Fabric and fit** (new block) | from category metafields (section 3) |
| 14 | Size chart tab, care tab (page), shipping and exchange tab | unchanged merchant content |
| 15 | Share | |

**Sections:** product → disclosures → Complete the look → Judge.me reviews → Judge.me featured reviews (Complete the look was below the featured reviews carousel).

**Kept, disabled:** the old hard-coded trust list (`dsr_trust`, a custom-Liquid block with emojis and a typed-in WhatsApp number), and the already-disabled COD note and price-comparison blocks.

## 3. Fabric and fit (`snippets/dsr-product-facts.liquid`)

Read from Shopify's standard category metafields (Products → product → Category metafields), which the store already fills well:

| Fact | Metafield | Products filled |
|---|---|---|
| Fabric | `shopify.fabric` | 247 |
| Length | `shopify.skirt-dress-length-type`, else `top-length-type`, else `pants-length-type` | 131 / 42 / 8 |
| Sleeves | `shopify.sleeve-length-type` | 92 |
| Neckline | `shopify.neckline` | 74 |
| Care | `shopify.care-instructions` | 22 |
| Fit | `shopify.fit` | 8 |

- **What shows:** only filled facts are listed. With none, the whole row is left out. Nothing is invented or defaulted.
- **Labels** ("Fabric", "الخامة"…) are locale strings. The values are the taxonomy entries' own labels, translatable in Translate & Adapt.
- **Markup:** Dawn's collapsible-tab markup, so it looks and behaves like the tabs below it.
- **Block settings:** heading, icon, open by default.

## 4. Variant behaviour (Dawn, verified)

Changing colour or size updates, in place:
- the URL (`?variant=`)
- price, compare-at and the sale badge (recalculated, e.g. 3XL: 299 against 400 → "25% off · save 101")
- the stock line and add to cart
- the photo (the colour's own image)
- which sizes are struck through
- the Sympl amount
- the sticky bar's price, label and disabled state

A sold-out combination can't be added: the button is disabled and says "Sold out", and the sticky bar is marked disabled.

**Coming from a product card:** a link from a card's colour swatch (`?variant=…&pick=color`, Stage 4) preselects that colour. The sticky bar still asks for a size first.

## 5. Decisions

- **"Buy it now" off.** With dynamic checkout on, Dawn makes Add to cart the secondary (outlined) button. "Buy it now" skips the cart, and with it the free-shipping progress (orders ≥ 1500 EGP) and the cart's cross-sells. On this cash-on-delivery store it doesn't bring a faster wallet payment either. Add to cart is now the one solid, full-width action. Turning it back on is one checkbox: Product → Buy buttons → "Show dynamic checkout buttons".
- **Size guide as a pop-up rather than a link to a new tab:** the shopper stays on the product with her selection. The old Size Chart tab stays, because its text adds piece-specific advice.
- **Reassurance in three items, not four:** Dawn's block has three slots. "Cash on delivery" and "inspect before you pay" belong together.

## 6. Files

| File | Change |
|---|---|
| `templates/product.json` | Order (section 2). New blocks `size_guide` (popup), `dsr_size_help`, `dsr_reassurance` (icon-with-text), `dsr_facts`. `dsr_trust` disabled. Dynamic checkout off. Section order. |
| `sections/main-product.liquid` (Dawn) | Block types `dsr_size_help` and `dsr_facts` (schema plus render). Loads `dsr-product.css`. The pop-up dialog's page title is an `h2`, so the product title is the only `h1`. |
| `snippets/dsr-product-facts.liquid` (new) | Fabric and fit row |
| `snippets/dsr-size-help.liquid` (new) | WhatsApp size help link |
| `snippets/price.liquid` (Dawn, Stage 2 edit) | The sale badge's Arabic text moves to `dressar.product.sale_badge` |
| `assets/dsr-product.css` (new) | Size guide, size help, reassurance row, facts |
| `locales/*.json` | `dressar.product.sale_badge`, `size_help`, `facts.*`, `dressar.whatsapp.message_size` (English and Arabic; English copies in the unpublished languages) |

Tests: `tests/product.test.js` (new), `tests/lib/catalog.js` (Shopify-style variant selection, option-value IDs, metafields), `tests/lib/theme-harness.js` (custom-Liquid settings are rendered, HTML-safe filter output, page-picker settings, `json`/`payment_button` filters), `tests/fixtures/catalog.json` (real category facts) and `tests/fixtures/build_catalog.py` (rebuilds it).

## 7. Accessibility

- **One H1:** Dawn also used one for the size-guide dialog; that is now an `h2`.
- **Size guide:** Dawn's dialog (`role="dialog"`, focus moves in, Escape closes, focus returns).
- **Size help:** says it opens a new window (visually hidden text), `rel="noopener noreferrer"`.
- **Sizes and pickers:**
  - Unavailable sizes: Dawn's struck-through labels (and they stay selectable, so a sold-out size can be seen).
  - Swatches and pills are Dawn's radio inputs with labels.
- **Facts:** a definition list inside Dawn's `<details>` row.

## 8. Tests and results

| Suite | `en.default` | `ar` |
|---|---|---|
| `product.test.js` (new) | 176 / 176 | 176 / 176 |
| `collection.test.js` | 293 / 293 | 293 / 293 |
| `header.test.js` | 210 / 210 | 210 / 210 |
| `liquid-logic.test.js` | 15 / 15 | |
| `pdp-sticky-sympl.test.js` | 47 / 47 | |

`product.test.js` renders the real product template for the real "Linen Skirt with Front Pockets": 4 colours, one with no stock; 3XL costs 299 against 249.

It checks, at 360/390/430/768/990/1280/1440 px:
- **Layout:**
  - the information order in section 2
  - one H1
  - no horizontal overflow
  - no Buy it now
- **Price:**
  - locale sale badge with % and amount
  - selected variant's price and compare-at
  - Sympl amount
  - sizes struck through for the colour
- **Size guide:** opens the Size Chart page in a dialog with focus inside; Escape closes and restores focus.
- **Size help:**
  - `wa.me/201020676173` with the product title and URL
  - new window, `noopener`
  - text from the locale
- **Fabric and fit:** exactly Fabric = Linen and Length = Maxi; no model-size line without the metafield.
- **Colour change:** URL, photo, size availability.
- **3XL:**
  - URL, 299/400, badge 25% / 101 saved
  - Sympl 299
  - add to cart enabled
  - on phones, the sticky bar's price and label
- **Sold-out combination:**
  - add to cart disabled with "Sold out"
  - on phones, the sticky bar marked disabled
- **No JS errors.**

Plus:
- **No facts:** no row.
- **Model size:** shown from the metafield, next to the size help.
- **Card swatch link:** the colour is preselected and the bar asks for a size.
- **Template:** Complete the look before the reviews, Buy it now off, the old trust list disabled but kept.

**Theme Check:** 30 offenses, all warnings, the same as Stage 4; none new.

**Visual QA:** product page at 390 and 1280 px (including the sold-out state) in English and Arabic, **in the test harness** (placeholder photos; the Judge.me blocks are app blocks and don't render there). The real storefront could not be opened from this environment.

## 9. Manual checks and merchant actions

1. **Preview a product page:**
   - Is "جدول المقاسات | Size Chart" right under the sizes, and does it open the size chart?
   - Does the WhatsApp size help open a chat with the product named?
   - Is the reassurance row in place?
   - Does "Fabric & Fit" show the right values?
2. **Judge.me review widget:** its "Review data" setting is `sample_data` (audit F27). In Customize → product → Judge.me review widget, make sure real reviews are shown on the storefront.
3. **Model size:** fill "مقاس الموديل | Model size" on products (Products → Bulk edit). Until then the line stays hidden.
4. **Category metafields:** fit (8 products) and care (22) are rarely filled. Filling them in the product's category metafields adds them to "Fabric & Fit" automatically.
5. **Buy it now:** turn it back on in the Buy buttons block if wanted (section 5).

## 10. Risks

- **Dawn updates:** `main-product.liquid` carries marked edits (stylesheet, two block types, the dialog heading level).
- **Fact values are taxonomy labels** (English by default). Translate them in Translate & Adapt for the Arabic storefront.
- **Assumption about category metafields:** `item.label.value` reads Shopify's documented field-access path, but it hasn't been checked on the real storefront.
- **Rollback:** reorder or re-enable blocks in the theme editor; re-enable `dsr_trust` to bring back the old list; or revert this commit.

## 11. Widths tested

360, 390, 430, 768, 990, 1280, 1440 px, in `en.default` and `ar`.
