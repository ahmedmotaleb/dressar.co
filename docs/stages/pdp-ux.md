# Product page UX refinement (Nov 14)

Product page only. Brief: "DRESSAR — Product Page UX Refinement" (sections 1–7). It follows the 2S redesign (`docs/stages/2s-redesign.md`).

## What changed

After the colour and size selectors the product page now reads:

1. **اعرف مقاسك / Find Your Size**: a button that opens a size dialog.
2. **جدول المقاسات / Size Guide**: the existing size-chart pop-up, now drawn as a button.
3. **رمز المنتج / Product Code**: the SKU of the chosen variant.
4. **أضف إلى السلة / Add to cart**.

**The two buttons**
- Full width, white, 8px corners and a #D9D9D9 edge, at least 48px high, 14px/500 text.
- A light grey (#F2F2F2) icon area on the reading side: a hanger for "Find your size", a ruler for the size guide.
- In Arabic they start on the right; in English, on the left.

**Removed from this area**
- The quantity selector. Each "Add to cart" adds one unit: the form sends no quantity, so Shopify adds 1. Quantities can still change in the cart drawer.
- The stock line ("Low stock", "Only X left"). Sold-out variants still can't be bought: the add button is disabled, and Shopify still checks stock in the cart.
- The WhatsApp "send us your height and weight" link. It now sits inside the size dialog, as its fallback.

**What's kept**
- The quantity, stock and size-help blocks are switched off in the template, not deleted, so their settings stay and the editor can turn them back on.
- Shipping, returns, description, fabric & fit and the tabs are unchanged below.
- The model-size line (`custom.model_size`, filled on no product today) now follows "Add to cart".

## Size Guide

- It is the existing **Pop-up** block (`size_guide`, page `size-chart`): same dialog, same content. No second size-guide system.
- New block setting **Dressar: style**:
  - "Link", the default, keeps Dawn's text link;
  - "Size guide button" draws the button with the translated label "جدول المقاسات" / "Size Guide".
- The block's own text ("جدول المقاسات | Size Chart") still names the dialog for screen readers.

## Find Your Size

New block **Dressar: find your size** (`snippets/dsr-find-size.liquid`, `assets/dsr-find-size.js`).

**The dialog**
- Height (cm) and weight (kg), both required.
- The body measurements this product's sizes are set by.
- The button "اعرف مقاسي" / "Find my size".
- It is phone-sized, uses Dawn's own modal (focus kept inside, Escape and the close button work), and has no sideways scrolling at 360px.

### Where the answer comes from

The store has **no data linking height or weight to a size**:
- The Dressar size chart (the image on `/pages/size-chart`) gives bust, waist and hips per size. Its only height information is "for an average height of 155–170 cm".
- Products only mention weight in "send us your height and weight on WhatsApp".

So height and weight never pick a size. The size comes from body measurements, in this order:

1. **The product's own size table**, in its description.
   - Read: the columns that say what body size each size fits, e.g. "يناسب محيط وسط حتى" / "Fits waist up to", for bust, waist and hips.
   - On 14 Nov, 110 of the 129 products on the storefront had one.
   - Flat garment widths ("الوسط مسطّح", "عرض الصدر مسطّح") are **not** used. Turning them into body sizes would need an ease allowance the store has never stated.
2. **Otherwise, the Dressar size chart**: the block's "Size chart (body, cm)" setting. It is copied from the chart image:

   | Size | Bust | Waist | Hips |
   |---|---|---|---|
   | 36 / S | 98 | 72 | 102 |
   | 38 / M | 102 | 76 | 106 |
   | 40 / L | 106 | 80 | 110 |
   | 42 / XL | 110 | 84 | 114 |
   | 44 / 2XL | 114 | 88 | 118 |
   | 46 / 3XL | 118 | 92 | 122 |

   The product tables' limits match this chart (for example, M fits waist up to 76 and hips up to 106).
3. **Neither applies** (one size, sizes such as "175 X 70 cm", or a table with only flat widths): the dialog gives no size.
   - One size: it says so.
   - Otherwise: "we can't calculate a reliable size for this piece yet", with the size guide and WhatsApp.

### The rule

- Only the product's own sizes are considered, in the order of their limits. "XXL" and "2XL" count as the same size.
- A size fits when **every measurement entered is at most that size's limit**.
- The answer is the smallest such size. This is the chart page's rule: "between two sizes, choose the larger".
- If no size fits, the dialog says the measurements are above the piece's largest size and points to WhatsApp.

### What the dialog shows

- **With height and weight only**: no size. It names the measurements needed (e.g. "waist or hips").
- **With at least one measurement**:
  - the size, the limits it was checked against, and whether these came from the piece's table or the Dressar chart;
  - whether that size is **in stock with the colour (and other options) chosen on the page**;
  - when it is in stock, a "Choose size X" button. It picks the size in the page's own picker and **never adds to the cart**.
- **Notes**:
  - a height outside 155–170 cm adds the chart's note that the length may fit differently;
  - every result says that weight isn't part of the size chart.
- **Validation**:
  - height must be 100–230 cm, weight 30–250 kg, measurements 50–200 cm;
  - these are input sanity limits, not fit rules.

### Privacy

- Everything happens in the page. The script makes no request and uses no storage (cookies, localStorage, sessionStorage, IndexedDB).
- The inputs have `autocomplete="off"`.
- The dialog says: "Your measurements stay on your device. We don't send or save them."

## Product Code

- Dawn's SKU block, with a visible label "رمز المنتج:" / "Product Code:" in place of the screen-reader-only "SKU:".
- Dawn's variant change replaces its contents, so it follows the chosen variant.

## Files

| File | Change |
|---|---|
| `snippets/dsr-find-size.liquid` (new), `assets/dsr-find-size.js` (new) | Find your size |
| `sections/main-product.liquid` | New block `dsr_find_size`; Pop-up block setting `dsr_style`; visible SKU label |
| `templates/product.json` | Block order; size guide as a button; quantity, stock and size-help blocks switched off |
| `assets/dsr-product.css` | Buttons, product code, dialog |
| `locales/*.json` | `dressar.find_size.*`, `dressar.product.size_guide`, `dressar.product.product_code` (Arabic by hand; other languages get the English) |
| `tests/pdp-ux.test.js` (new), `tests/fixtures/descriptions.json` (new), `tests/fixtures/build_catalog.py`, `catalog.json` | Tests on three products with the store's real description tables |
| `tests/product.test.js`, `tests/redesign-2s.test.js` | New block order |

## Tests

`tests/pdp-ux.test.js`, in Arabic and English, at 360, 390 and 430px:

**Layout**
- The order after the selectors.
- The two buttons' look, and their icon on the reading side.
- The product code under them, showing the variant's SKU.
- No quantity selector and no stock text.
- No sideways scrolling on the page or in the dialog.

**The dialogs**
- Each button opens its own dialog. Escape closes it and returns focus.
- There is a single size-guide pop-up.

**Recommendations, on the store's real tables**
- The skirt's table has waist and hips; another product has bust only; a third has waist only. For a product with no table, the chart is used.
- Limits are checked exactly, e.g. waist 76 gives M and 76.5 gives L.
- Every measurement entered must fit.
- Too large for the piece: no size.
- Weight never changes the result. Height only adds a note.
- Bad input gives an error and no size.
- The cases the fixtures lack are run on the script directly:
  - one size;
  - sizes no table or chart covers;
  - a flat-width-only table;
  - an emptied chart.

**Stock and the cart**
- Stock per colour: olive L is available; olive XL is sold out, so there is nothing to choose.
- "Choose size" picks the size, updates the URL and the product code, and adds nothing.
- Add to cart sends one request for one unit.
- A sold-out variant stays disabled.
- The sticky bar adds one unit of the chosen variant.

**Privacy**
- No request and no storage while a size is worked out.

## Not verified here

- **Local harness only.** The checks use the theme's real Liquid, CSS and JS with fixture products. The Shopify preview can't be opened from this environment, so the live preview hasn't been looked at.
- **The 2S and Dressar reference screenshots** named in the brief didn't come through with it. The buttons follow the written description.
