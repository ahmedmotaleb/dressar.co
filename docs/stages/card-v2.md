# Product card, compact V2 (Nov 14)

Brief: "DRESSAR — Product Card Compact Redesign V2" (sections 1–8). The previous card was rejected; this one is more compact and keeps every row of a grid row aligned.

It builds on `docs/stages/card-upgrade.md`, which stays in force:
- the "38%" badge;
- the one price variant (price, compare-at price and badge from one variant, following the chosen colour and size);
- colours on every card, including single-colour products;
- the missing-colour-data flag.

**Screenshots** from the real preview theme (`#168399831271`), search results, Arabic and English, at 360, 390, 430 and 1440px: `docs/stages/card-v2-shots/before-*.png` and `after-*.png`.

## The card

`assets/dsr-card.css`, with small markup changes. The card stays #F2EEE9 with 10px corners; padding is 8px. Under the photo is one CSS grid of fixed rows. Every card in a grid row has the same height, and its photo bottom, name, price, colours, sizes and bottom line up within 1px.

1. **Name, one line.**
   - 12px (13px from 990px), 500; `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`, at the same height on every card.
   - Each name keeps its own reading direction (`unicode-bidi: plaintext`), so a mixed name such as "Turquoise Velvet Jacket | جاكيت قطيفة تركواز" reads from its own start and is cut at its own end.
   - Names sit on the page's reading side (left in English, right in Arabic).
   - The full name stays in the link text and on the product page.
2. **Price and rating on one line.**
   - **Price:** 14px semibold.
   - **Compare-at price:** 11px. It is shown **whole or not at all**. When it doesn't fit (a narrow card, a "From" price, four digits, a rating beside it), it moves to a hidden second line instead of being cut. The sale badge still states the discount, and screen readers keep both prices.
   - **Rating:** 10px. A gold star, Judge.me's score ("4.6") and the review count (`snippets/dsr-card-rating.liquid`). Only real reviews; the line keeps its height without them.
   - On narrow cards (under about 165px of content: two columns on phones up to about 390px), the count is left out so the prices fit; it stays in the rating's accessible label. Five stars plus the count would not fit beside a sale price at 360px.
3. **Colours.**
   - 16px rounded squares (4px corners), 8px apart. Each colour button is 24px wide, WCAG 2.5.8's minimum tap target. The list starts 4px into the padding, so the first square lines up with the name.
   - The selected colour has a thin dark ring; light colours keep a thin grey edge.
   - No "Colour:" label, no divider.
4. **Sizes.**
   - 24px boxes, 4px corners, 11px, on one row. M–3XL fit a 360px phone; longer runs scroll sideways inside the row.
   - Sold-out sizes are struck through and lighter. No "Size:" label, no divider.

**Quick add.** A 32px bag button on the photo's bottom-right corner:
- translucent white, 8px corners, a faint edge, Dawn's bag icon;
- a 44px touch area;
- behaviour unchanged (adds the exact colour and size, otherwise opens the dialog);
- as before, on desktop with a mouse it shows on hover and keyboard focus.

## Files

| File | Change |
|---|---|
| `assets/dsr-card.css` | The V2 card (grid rows, one-line name, price line, squares, sizes, bag) |
| `snippets/dsr-card-rating.liquid` | Compact rating: star, score, count |
| `snippets/dsr-card-swatches.liquid`, `snippets/dsr-card-sizes.liquid` | Row labels removed |
| `snippets/dsr-card-quick-add.liquid`, `assets/dsr-card.js` | Bag icon; wording |
| `tests/lib/card-layout.js` (new) | Measures every card and groups them by grid row |
| `tests/card-upgrade.test.js` | V2 checks, 320–1440px, both languages |
| `tests/preview-cards.check.js` (new) | The same checks on the real preview theme, plus a colour, a size and the bag on real cards |
| `tests/redesign-2s.test.js`, `quick-add`, `card-rows`, `collection`, `cart` | Moved to V2 |

## Tests

**`tests/card-upgrade.test.js`.** 820 checks, Arabic and English, at 320, 360, 375, 390, 430, 768, 1024 and 1440px. It runs on the collection, search and home rows with fixture products: short and long names (a long mixed English/Arabic one), ratings and none, sale and full prices, mixed size pricing, one and several colours. It checks:
- names on one line, the same height;
- in every grid row, the same card height and every row within 1px;
- the price at 14px/600; the rating at 10px, on the price's line, not overlapping;
- the compare-at price never cut;
- squares, sizes and the bag;
- no row labels or dividers; 8px padding;
- no sideways scrolling;
- all the card-upgrade behaviour (colour and size choice, exact-variant quick add, sold out, no colour data).

**`tests/preview-cards.check.js`.** 152 checks, all passing on 14 Nov, on the real preview theme with the store's products: search "skirt jacket" and `/collections/all`, Arabic and English, at 360, 390, 430 and 1440px. It runs the same layout checks. On a real card with several colours it picks another colour (selected, links to that colour, card height unchanged), then a size in stock (the links open that exact variant), then presses the bag. The add-to-cart request carries exactly that variant; the check stops it before it reaches the store.

## Not verified here
- **Touch screens:** sideways scrolling of a long size row was checked by layout (`overflow-x: auto`, one row), not by swiping.
- **The brief's attached BEFORE screenshot** didn't come through; the BEFORE shots here are taken from the preview theme before V2 was uploaded.
