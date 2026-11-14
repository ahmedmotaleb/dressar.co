# Product card upgrade (Nov 14)

Brief: "DRESSAR — Complete Product Card UI & Functionality Upgrade" (tasks 1–9). Applied to the development theme (this branch, the 2S card from PR #2). The card keeps its layout, background, row labels and rating row; only what the brief names changed.

## What changed

### 1. Sale badge
- **Text:** only the percentage, "38%". "OFF" is gone; screen readers still hear "38% off" / "خصم 38%".
- **Look:**
  - 11px/600 with 4px 7px padding on phones; 12px/600 with 5px 9px from 990px;
  - 5px corners, no capitals or letter-spacing;
  - the theme's sale colours (dark red, white text).
- **Position:** top-right of the photo, 10px in (12px from 990px), in both reading directions. It no longer follows Dawn's "badge position" setting, which mirrored it to the left in Arabic.
- **The figure:** `(compare-at − price) / compare-at × 100`, **rounded** (it was floored), from **one variant**: the one whose price and compare-at price the card prints.
  - No badge without a real markdown.
  - A product whose shown variant isn't reduced shows none, even if another size is.
- **Sold out:** the badge says so, in the same place.

### The card's price variant (behind tasks 1 and 3)
Before, the card printed the product's lowest price, its lowest compare-at price and a badge from both. Those could come from different variants.
- On 74 of the store's 129 products, sizes are priced differently (3XL usually +50 EGP).
- On some, the lowest compare-at belongs to another size. Smoothie Skirt: 499 against 999, where 999 is the compare-at of the 549 size.

Now (`snippets/dsr-card-variant.liquid`):
- **Colour shown:** the colour of the in-stock variant whose photo is the card's photo, else of the first in-stock variant. That colour's circle starts selected.
- **Price variant:** the cheapest in-stock variant in that colour (the cheapest of the colour when none is in stock).
  - The card prints its price and compare-at price, and the badge comes from it.
  - "From" appears only when that colour's sizes in stock (all of its sizes, when none is in stock) cost different amounts. Example: velvet skirt in olive, where only the 449 3XL is in stock, shows "449", not "From 449".
- **On a choice:** picking a colour moves all three to that colour; picking a size, to the exact variant (`assets/dsr-card.js`). The prices for this come with the card (formatted by Shopify), so there's no extra request and no reload.

`snippets/price.liquid` gains two optional parameters for this (`dsr_variant`, `dsr_from`). The product page's prices are unchanged.

### 2. Quick-add "+"
- **Look:**
  - 30px with a 16px plus on phones; 34px with an 18px plus from 990px;
  - white, a thin dark edge, 3px corners, no shadow; Dawn's plus icon.
- **Position:** bottom-right of the photo, 10px (12px) in, in both reading directions.
- **Touch area:** 44px without drawing any bigger (`::before`).
- **Behaviour unchanged:**
  - one variant: adds it;
  - colour and size chosen on the card: adds that exact variant;
  - otherwise: opens the existing quick-add dialog;
  - sold out: disabled;
  - Dawn's product form keeps loading, errors and the cart drawer working.
- On desktop with a mouse it still appears on hover and keyboard focus.

### 3. Colour circles on every card
**Root cause of the missing swatches** (Turquoise Velvet Jacket and every other single-colour product). The *live* theme's `snippets/dsr-card-swatches.liquid` skipped any option with fewer than two values: `if option.values.size < 2 … continue`; its own notes said "Products in a single colour show nothing". The jacket is a one-colour product (colour value "Navy", swatch #282099), so it got no row.
- This branch already fixed that in `8bf6df4` and `7cd92b5`; the preview showed the swatch. The fix isn't live because the preview theme hasn't been published.
- What remained, and is done now: a single colour is drawn **selected**.

**Now:**
- One circle per colour value. Values are unique, so sizes never repeat a colour.
- **One colour:** one circle, selected (a thin dark ring 2px outside it).
- **Several colours:** each is a button, with or without a photo of its own. The colour shown starts selected (`aria-pressed`). Picking one, by tap, click or keyboard:
  - shows its photo when its variant has one;
  - updates the price, compare-at price and badge;
  - updates which sizes are in stock;
  - points the card links and quick add at it (`pick=color`, so the product page asks for the size).
- **A sold-out colour** is crossed through.
- **Circles:** 16px (18px from 990px); 8px apart on phones, 7px from 990px.
  - The brief asked 7px everywhere. On phones that makes each colour button 23px wide, under WCAG 2.5.8's 24px minimum, so phones keep 8px.
- **Light colours** (brightness over 200 of 255, e.g. white, cream) get a thin grey edge; others have none.
- **Where colours come from, unchanged:** the colour option's Shopify swatches; else the product's Color category metafield; else a colour count ("2 colours") for an unlinked option with several values.
- **No reliable data:** no circle at all, and the row is marked `data-dsr-color-data="missing"`. Nothing is guessed from a name.

### 4. Type and order
- **Order:** photo, name, (rating, only with real reviews), price, colours, sizes. The rating row stays as it was.
- **Name:** 12px/500 (13px from 990px).
- **Price:** 13px/600 (14px). The struck-through price is 3px smaller.
- **Sizes:** 11px (12px); unavailable ones subtly struck through; order and stock per colour as before.

### 5. Every card
- All product cards on the theme use `snippets/card-product.liquid`:
  - home featured collections (incl. White Friday) and other collection pages;
  - search, related products, complementary products, collage.
  So one change covers them.
- There is no recently-viewed section in the theme.
- Several of the merchant's AI-generated blocks draw cards of their own ("Featured collection", "Product grid", "Recently viewed"). On the preview theme all of them are switched off (block or section disabled), so none is visible. They were left unchanged.

## For the merchant: colour data to fix in Shopify

From the Admin API, 14 Nov, 129 active products.

**1. Colour option not linked to swatches, and no Color metafield.** The card shows no circle (flagged) until the option is linked to the "Color" category metafield in the product editor:
- Wildflower Knit Sweater (Off White)
- Beige Ribbed Sweatshirt with Denim Collar (Beige)
- Full-Length Evasé Skirt – Camel (Camel)
- Grey & Black Plaid Winter Wool Skirt (Grey & Black)
- Black Striped Winter Wool Skirt (Black)
- Camel Belted Wool Coat (Camel)
- Dark Brown Belted Wool Coat (Dark Brown)

**2. Pattern values on an unlinked option, with a Color metafield.** These show the metafield's colours, where its entries have one:
- 130 ("black"), Satin Silk Maxi Skirt (Floral), Striped Cotton Shirt (Striped), Sky Blue Cloche Jeans Skirt ("Sky blue"), Beige Blouse with Orange Floral (Floral), White Linen Shirt with Blue Print (Geometric).

**3. A mismatch.** The Turquoise Velvet Jacket's colour value is "Navy" with swatch #282099, so its circle is navy on a turquoise jacket. That is the product's data, shown as it is; it is corrected in the product's colour option.

## Files

| File | Change |
|---|---|
| `snippets/dsr-card-variant.liquid` (new) | The colour shown and the one price variant |
| `snippets/card-product.liquid` | Uses it for price, badge and colours |
| `snippets/price.liquid` | Optional `dsr_variant` / `dsr_from` (cards only) |
| `snippets/dsr-card-badge.liquid` | Percentage only, rounded, from that variant; hidden placeholder for colours that are reduced |
| `snippets/dsr-card-swatches.liquid` | Every colour choosable; one colour selected; light edge; missing-data flag |
| `snippets/dsr-card-options.liquid` | Variant prices for the script; "From" and "% off" wording |
| `snippets/dsr-card-quick-add.liquid` | Plus icon |
| `assets/dsr-card.css` | Badge, "+", circles, type |
| `assets/dsr-card.js` | Price, compare-at and badge follow the colour and size |
| `tests/card-upgrade.test.js` (new) | 644 checks, both languages, 7 widths |
| `tests/lib/theme-harness.js` | `color_brightness` reads the fixtures' colour objects |
| `tests/collection.test.js`, `quick-add.test.js`, `redesign-2s.test.js`, `card-slides.test.js` | Updated to the new specs |

## Tests

`tests/card-upgrade.test.js` covers Arabic and English, at 320, 375, 390, 430, 768, 1024 and 1440px. It runs on the collection, search and home rows, with test products shaped like the store's: the Turquoise Velvet Jacket's exact data, a 38% product, Smoothie-style mixed pricing, unlinked colours, a metafield-only colour, a white colour and a one-variant product. It checks:

- **Badge:** text, size, padding, corners, colours and corner position.
- **"+":** size, icon, look, position and touch area; badge and "+" never overlap.
- **Circles:** size, round, spacing, not clipped.
- **Type, order and overflow:** name, price and size type; the row order; no sideways scrolling.
- **The brief's scenarios:**
  - A, one colour: one selected circle; Turquoise: 39% (38.5 rounded), 43% after choosing 3XL.
  - B, several colours: all, one selected; light edge.
  - C: "38%", no "OFF".
  - D, quick add: one variant adds; no size opens the dialog; exact colour and size adds that variant; sold out disabled.
  - E, colour choice: photo, price, compare-at, badge, sizes, links, and no layout shift.
  - F, no colour data: no circle, flagged; metafield colour shown.
  - Keyboard choice.
- **Every badge on the white-friday and test collections** equals the rounded markdown of its card's own prices, both from one variant.

## Checked on the preview with the store's real products

Preview theme `#168399831271`, search results in Arabic and English, 390 and 1440px. Screenshots: `docs/stages/card-upgrade-shots/` (with the live card before, for comparison).

- **Turquoise Velvet Jacket:** one selected circle (Navy), 399 against 649, "39%". Sizes M and 3XL open, the rest struck through.
- **Smoothie Skirt:** opens on Black, whose only in-stock size is L at 499 against 999: "50%". This matches the store's variants.
- **Velvet pleated skirt:**
  - Black: 399 against 699, "43%".
  - olive: its photo, 449 against 749, "40%"; only 3XL open; links on its 3XL variant.
  - Brown: the same, with the Brown photo.
  - Choosing 3XL opens the exact variant.
  - No request and no change in card height while picking.
- **The "+":** 30px on phones, 34px on desktop.
- **No problems:** no Liquid error, no sideways scrolling, no JS errors (other than the store's TikTok pixel, blocked in this sandbox).

## Not verified here
- **Desktop:** the "+" shows on hover (unchanged behaviour), so desktop screenshots don't show it. The test file checks its size and position.
- **The rating row** wasn't in the brief's order list. It stays, between name and price, and only appears for products with Judge.me reviews.
