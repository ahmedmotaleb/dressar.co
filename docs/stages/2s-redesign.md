# Product grid and product page UI upgrade (2S style)

**Status:** on the branch `claude/dressar-2s-card-pdp-redesign`, made from `claude/dressar-theme-audit-7xbdeb` at `24fd7ee`. Not merged, not published. The live theme was not touched.

The brief: a calmer, more compact product card and product page, in the style of the 2S Homewear screenshots the merchant sent. It had to keep every feature already in the theme.

## What was there before (verified on `24fd7ee`)

- **Product card** (`snippets/card-product.liquid`, Dawn's card with Dressar snippets):
  - 3:4 photo with a hover slideshow (`dsr-card-slides`) and Dawn's sale and sold-out badges.
  - Name, then price, then a colour row (`dsr-card-swatches`) and a size row (`dsr-card-sizes`).
  - The size row was a plain text list: sizes with no stock in any colour were struck through, and nothing could be chosen on the card.
  - Quick add (`dsr-card-quick-add`) was an outlined square "+" on the photo:
    - a product with one variant went straight to the cart;
    - every other product opened Dawn's quick-add dialog.
  - No rating on the card.
  - White card, photo with its own rounded corners.
- **Product page** (`templates/product.json`, Dawn's `main-product` and Dressar blocks):
  - The title was large and light: 26–38px, weight 400.
  - Block order: price, then the Judge.me badge, then the SKU, then the colour photo selector (`dsr-color-photos`).
  - Round size pills, with "Color: olive" labels.
  - Size guide, WhatsApp size help, model size, stock, quantity and add to cart, then the icons (cash on delivery, exchange, delivery), description and fabric/fit facts.
  - Sympl widget.
- **Sticky add to cart** (`sections/dsr-product-boost.liquid`): one bar on phones and tablets, with the product name, price and a button that mirrors the main one. It already scrolled to the picker when no size was chosen.
- **Grid gaps**: the theme's spacing setting (8px) everywhere.

## What changed

### Product card

- **The whole card sits on #F2EEE9** with 10px corners: photo, name, rating, price, colours and sizes.
  - No white panel, no border, no shadow.
  - New theme setting: *Product cards → Card background* (`card_background`, default #F2EEE9).
- **Order**: photo, name, rating, price, colours, sizes.
- **Typography**:

  | Text | Phones | From 990px |
  |---|---|---|
  | Name (two lines at most) | 12px | 13px |
  | Rating | 10px | 11px |
  | Price (semibold) | 14px | 16px |
  | Sizes | 10px | 11px |

  The sale price comes first; the struck-through price after it is 3px smaller and cut with "…" if a narrow card has no room.
- **Rating** (new `snippets/dsr-card-rating.liquid`):
  - Real reviews only, read from the `reviews.rating` and `reviews.rating_count` metafields that Judge.me syncs to Shopify.
  - Shows Dawn's stars and "(count)", with a screen-reader label ("4.5 out of 5 stars", "12 total reviews").
  - A product without reviews has no rating row and no empty gap.
  - New setting: *Show ratings* (`card_show_rating`, default on).
- **Colour swatches**: rounded squares (14px, 3px corners) with a thin outline on the selected one. Colours still come only from Shopify's swatch data or the Color metafield.
- **Sizes are buttons that can be chosen** (`snippets/dsr-card-sizes.liquid`, `assets/dsr-card.js`):
  - 24px high with 4px corners. The chosen size is filled black.
  - A size with no stock is struck through, can't be chosen, and is announced as sold out.
  - Stock follows the colour shown on the card: the card starts on the colour in its photo, and picking another colour updates the sizes. If the chosen size isn't in stock in the new colour, it is unchosen.
  - Only the product's real sizes, in its own order. A sold-out product lists its sizes, all struck through.
  - A product with one size in stock starts with it chosen.
- **The card's links follow the choice**:
  - colour and size chosen: the product page opens on that exact variant;
  - colour only: it opens on that colour with the size still to pick (the existing `pick=color`).
- **Quick add is a small shopping-bag button** (34×34px, white, 8px corners) on the photo's bottom corner. It is bottom-left on Arabic pages and hover-only on desktop, as before. It never adds a variant the shopper didn't choose:
  - colour and size chosen, in stock: it adds exactly that variant, and the cart drawer opens;
  - anything else (no size chosen, or an option the card doesn't show): it opens the existing quick-add dialog, and nothing is added;
  - a product with one variant: adds it, as before.
- **Grid**: two columns on phones and four from 990px. The gap is 8px on phones and 16px from 750px. Home page sliders keep the theme spacing: Dawn sizes slider cards from the gap, so 16px would have shrunk them.
- **No horizontal overflow** at 360–1440px. Six size buttons scroll inside the card's row rather than widening the card.

### Product page

- **Compact type**:
  - title 20px on phones and 24px on desktop, weight 600;
  - price 18px and 20px, weight 600;
  - option labels 13px, weight 600.
- **Labels read "Color — olive" and "Size — L"**: the name, then the chosen value.
- **Rounded gallery**: 10px corners on the main photo, 8px on thumbnails.
- **Size and other option buttons**: 8px corners, at least 40px high.
  - Chosen: white with a black frame.
  - Unavailable: struck through.
  - Dawn's swatches and the colour photo selector are unchanged.
- **Block order** (`templates/product.json`; only `block_order` changed):
  1. title, then the Judge.me badge;
  2. price and discount;
  3. colour, size, size guide, WhatsApp size help, model size;
  4. SKU, stock, quantity, add to cart;
  5. icons (cash on delivery / exchange / delivery), description, fabric and fit.

  Dawn's own rating block stays disabled, as the merchant left it.
- Kept as they were: zoom, variant photos, the colour photo selector, Sympl, Judge.me, the size guide, WhatsApp size help and the sale badge.

### Sticky add to cart (the existing bar, improved; there is still only one)

- **The bar shows**:
  - a 48×64 photo of the chosen colour, following the gallery;
  - the name (one line), the price, and the chosen colour and size;
  - a "Change" link;
  - a 48px add-to-cart button.
- **No size chosen**: the button reads "Choose your size". Pressing it, or "Change", scrolls to the size picker.
- **Synced with the form**: price, label, sold out and photo follow every variant change.
- **Layout**:
  - the bar leaves room for the iPhone home bar (safe area);
  - the page gets bottom padding equal to the bar's height, so nothing hides under it;
  - the WhatsApp button moves up above the bar.
- New text: "Change" (`dressar.product.change`), in English and Arabic, and synced to all locale files.

## Files

| File | Change |
|---|---|
| `assets/dsr-card.css` | Card background and corners, type scale, rating, square swatches, size buttons, bag button, grid gaps |
| `assets/dsr-card.js` | `dsr-card-options`: size choice, stock per colour, exact-variant links, bag button adds the exact variant or opens the dialog |
| `assets/dsr-product.css` | Compact product page: type, labels, option buttons, rounded gallery, add-to-cart button |
| `snippets/card-product.liquid` | Card background variables, rating row, one options block |
| `snippets/dsr-card-options.liquid` (new) | Colours and sizes, plus the product's variants as JSON (id, in stock, options) |
| `snippets/dsr-card-rating.liquid` (new) | Real Judge.me rating from Shopify's reviews metafields |
| `snippets/dsr-card-sizes.liquid` | Size buttons, sold-out labels |
| `snippets/dsr-card-swatches.liquid` | Option index and values for the script |
| `snippets/dsr-card-quick-add.liquid` | Bag button; one product form for every product |
| `snippets/product-variant-picker.liquid`, `snippets/dsr-color-photos.liquid` | "Name — value" labels |
| `sections/dsr-product-boost.liquid` | Sticky bar: photo, chosen options, Change, height-based padding, WhatsApp clearance |
| `templates/product.json` | Block order only |
| `layout/theme.liquid` | Loads `dsr-card.js` when sizes or quick add are on (not only swatches) |
| `config/settings_schema.json` | *Card background*, *Show ratings*; updated help text |
| `locales/*.json` | `dressar.product.change` |
| `tests/redesign-2s.test.js` (new) | 149 checks |
| `tests/*.test.js`, `tests/lib/*` | Updated for the new markup (see below) |

## Tests

| Test | English | Arabic |
|---|---|---|
| schema | 6/6 | — |
| liquid-logic | 15/15 | — |
| pdp-sticky-sympl | 67/67 | — |
| header | 210/210 | 210/210 |
| collection | 300/300 | 300/300 |
| product | 183/183 | 183/183 |
| cart | 73/73 | 73/73 |
| home | 356/356 | 356/356 |
| a11y (axe) | 78/78 | 78/78 |
| seo | 51/51 | 51/51 |
| rtl | 29/29 | — |
| perf | 18/18 | 18/18 |
| regression | 50/50 | 50/50 |
| quick-add | 280/280 | — |
| color-photos (both languages inside) | 236/236 | — |
| card-slides | 158/158 | — |
| card-rows | 193/193 | — |
| redesign-2s (both languages inside) | 149/149 | — |

Theme Check: 23 offences, the same as before this change (all in Dawn files).

**New: `tests/redesign-2s.test.js`**

- **Grid**, at 360, 390, 430, 768, 990, 1280 and 1440px in English, and at 390 and 1440px in Arabic:
  - #F2EEE9 on the whole card, 10px corners, no shadow;
  - the row order, the font sizes, and a name of two lines at most;
  - the rating only on the reviewed product;
  - square swatches;
  - 2 columns with an 8px gap, 16px from 750px, and 4 columns from 990px;
  - no overflow and no script errors.
- **Product page**, at 390 and 1440px in both languages:
  - block order and type sizes;
  - "Color — olive" and "Size — L";
  - option buttons and the rounded gallery.
- **Sticky bar**:
  - photo, name, price, colour, "Change" and "Choose your size";
  - WhatsApp clearance and the bottom padding;
  - after choosing Genzari / XL: the label, the photo and the button follow.
- **Template**: the Judge.me badge directly after the title.

**Changed existing tests**

- `quick-add`:
  - the bag button's look;
  - a new block covering stock per colour, struck sizes that can't be chosen, the dialog when no size is chosen, and exactly the chosen variant added.
- `collection`:
  - sizes follow the colour shown (beige: XL) and the colour chosen (black: M);
  - a sold-out product lists its sizes, all struck.
- `card-rows`: size buttons; the sold-out product's sizes are struck.
- `color-photos`: the label is now "Color — olive".
- `home`: the inline-script limit counts code only, not the cards' JSON data. A new check confirms every JSON block parses.
- `pdp-sticky-sympl`: the new bar markup; "Change"; padding equal to the bar's height; WhatsApp above the bar.
- Test harness:
  - fixture products can carry review metafields (`reviews: [rating, count]`);
  - `image_tag` passes `data-*` attributes through, like Shopify.

## Screenshots

`docs/stages/2s-shots/`: before (`24fd7ee`) and after, side by side on phones or stacked on desktop. The shots are:
- grid on mobile (390px) and desktop (1440px);
- product page on mobile and desktop;
- the sticky bar on mobile.

Each is in English (`-en`) and Arabic (`-ar`).

They come from the local test harness: the theme's real Liquid, CSS and JS, rendered with fixture products and plain colour blocks in place of product photos. In the full-page product shots, the sticky bar and WhatsApp button are hidden, because a full-page capture draws fixed elements in the middle of the page. The sticky bar has its own shot.

## Not done, or not verifiable here

- **No visual check on the live Shopify preview.** This environment can't open the storefront preview. The Shopify connector wasn't connected when the work was finished, so the preview theme hasn't been updated yet. All visual checks above come from the local harness, not from Shopify.
- **The Judge.me badge on the product page can't be rendered locally**: it is an app block. The test checks its position in the template. On the card, the rating comes from Shopify's reviews metafields. If Judge.me's metafield sync is off for the store, cards show no ratings: there are no fake stars.
- **The rating row takes no space when a product has no reviews** (as the brief asked). In a row where only some products have reviews, the prices therefore don't line up across cards.
- **No reference image was supplied for the grid**; it follows the written brief and the 2S product page screenshots.
- **The theme IDs in the brief are out of date.**
  - #167837270247 is now the live theme: the merchant published it on Nov 10.
  - #167717929191 is the previous live theme, unpublished.
  - The unpublished preview copy is #168303165671. This work goes there once the connector is back.
