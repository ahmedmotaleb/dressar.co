# Product card rows: a colour on every card, rows aligned

**Status:** on the branch `claude/dressar-theme-audit-7xbdeb`.

## What changed

- **Every card has a colour row.**
  - A product in one colour shows that one swatch; several colours show them all, up to the limit.
  - More than 5 colours: 4 swatches and "+N", so the row never wraps.
- **Colours come only from Shopify's data**, in this order:
  1. The colour option's swatches (an option linked to the "Color" category metafield).
  2. Otherwise, the product's own Color category metafield (`shopify.color-pattern`), set by the merchant. In the store, this gives "130" its black and "sky-blue-cloche-jeans-skirt" its baby blue. Their colour options aren't linked to swatches.
  3. Otherwise, for a colour option without swatch data and several values, a colour count ("3 colours").
  4. Otherwise (for example "Floral" and "Striped", patterns with no colour or image): an empty row of the same height. No made-up swatch.
- **A single colour is a plain labelled dot**, not a button: picking the only colour would change nothing.
- **Fixed rows on every card**, so neighbouring cards line up:
  - the name takes two lines' height
  - the price is one line: the price to pay first and always whole, the struck-through price after it, cut short with "…" if a narrow card has no room
  - the colour row and the size row are each one line high, even when empty (sold out, no size option)
- **Dawn hides empty `div`s** (`div:empty { display: none }` in base.css). The empty rows override it, so they keep their height.

| File | Change |
|---|---|
| `snippets/dsr-card-swatches.liquid` | Single colours, the Color metafield as a source, the "+N" cap, always a row |
| `snippets/dsr-card-sizes.liquid` | Always a row |
| `assets/dsr-card.css` | Fixed row heights, the name's two-line height, the one-line price |
| `tests/lib/catalog.js` | Fixture products can carry a Color metafield (`colorMeta`) |
| `tests/card-rows.test.js` (new) | 193 checks |

## Tests

`tests/card-rows.test.js`: 193 checks at 360, 390, 430, 768, 990, 1280 and 1440 px (English), and 390 and 1280 px (Arabic). Fixture products cover:
- one colour; a colour from the Color metafield
- a pattern with no colour data; no colour option
- 4 colours, and 7 colours ("+3")
- a very long name with a "From" sale price; six sizes; sold out

On every card, the checks cover:
- order: photo, name, price, colours, sizes
- the same height and position for each row; cards side by side the same height
- 3:4 photos; two columns on phones; the "+" on the photo
- the right swatch colours; no made-up swatch anywhere
- colour and size rows on one line, inside the card
- no sideways page scroll, no JS errors

Every other suite passes in both languages. Theme Check is unchanged.
