# Collection section headings (Nov 15)

Brief: "DRESSAR — Fix Collection Section Heading Typography". The Arabic heading "عروض الوايت فرايدي 🖤" was drawn in the shopper's device font. The theme heading font, Poppins 200, has no Arabic letters, so the result was thin. Arabic headings now use Cairo SemiBold.

## What changed

**Where:** the headings of **Featured collection** and **Collection list** sections only. Product titles, prices, variant pickers and section spacing are untouched.

| | Mobile (<750px) | Desktop |
|---|---|---|
| Size | 26px | 34px |
| Line height | 1.35 | 1.35 |
| Arabic letters | Cairo 600 | Cairo 600 |
| Latin letters | theme heading font, its own weight | same |

- **Fonts:**
  - **Arabic letters:** the theme's existing Cairo file (`assets/dsr-cairo-arabic.woff2`, variable 200–1000, Arabic subset). No new font file.
  - **Latin letters:** they keep the merchant's heading font at its own weight. A small `@font-face` ("DSR Heading Latin") maps every weight to the theme heading font's own file, the same URL Shopify already preloads, so nothing new downloads. Without it, weight 600 would pick the store's bolder Poppins face, or the browser would fake a bold.
  - `font-synthesis: none` stops faked bold.
- **Direction:**
  - **Arabic pages (RTL):** headings are right-aligned with normal letter spacing; spacing breaks the joins between Arabic letters.
  - **English pages:** the section's new "Heading alignment" setting applies (left by default, the headings' current place).
- **Layout shift:** Arabic pages preload the Cairo file, so headings don't change size when it arrives. English pages don't preload it.
- **Text:** no campaign title in the code. Headings are still the sections' own "Heading" setting.

## Theme editor

**Theme settings → Typography → Collection section headings** (new, global):
- Cairo for Arabic headings (on);
- heading size, mobile (26px);
- heading size, desktop (34px);
- Arabic heading weight (SemiBold);
- heading line height (135%).

**Featured collection, Collection list:** "Heading alignment" (left, center, right) for left-to-right pages. Existing setting IDs and merchant values are unchanged; the new settings take their defaults.

## Files

| File | |
|---|---|
| `config/settings_schema.json` | Global heading settings |
| `layout/theme.liquid` | Cairo face also for headings, Latin heading face, variables, Arabic preload |
| `assets/dsr-section-heading.css` (new) | Heading typography and alignment |
| `sections/featured-collection.liquid`, `sections/collection-list.liquid` | Heading class, stylesheet, "Heading alignment" setting |
| `tests/heading-typography.test.js` (new) | Tests |

## Tests

`tests/heading-typography.test.js`: 131 checks on the real home template, Arabic and English, at 360, 390, 430 and 1440px.
- **Typography:** size, line height and weight; Cairo first in the font stack; no faked bold.
- **Latin letters:** as wide as the same text in the theme face itself.
- **Direction:** Arabic right-aligned with normal letter spacing; English follows the setting.
- **Cairo loading:** preloaded and loaded on Arabic pages only.
- **Layout:** headings fit in at most two lines; no sideways scrolling; no layout shift from the headings.
- **Untouched:** product titles.
- **Schema:** the settings, their defaults, and the existing setting IDs.

**Screenshots:** `docs/stages/heading-typography-shots/heading-{ar,en}-{360,390,430,1440}.png` (local render with the test fixtures). Real-preview shots are in the PR.
