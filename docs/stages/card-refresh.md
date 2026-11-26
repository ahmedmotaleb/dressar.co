# Product card refresh (Nov 26)

**Brief:** "Update the existing Dressar product card design with ONLY the following five changes".

**Where:**
- **Branch:** `claude/dressar-card-refresh`, built on `claude/dressar-arabic-mobile` (PR #11).
- **Preview:** theme `#168778662119`, unpublished. It is a copy of the live theme `#168582217959`, made on Nov 26, so it includes the merchant's latest theme-editor changes.
  - Arabic: https://dnx31m-mi.myshopify.com/ar/collections/white-friday-sale?preview_theme_id=168778662119
  - English: https://dnx31m-mi.myshopify.com/en/collections/white-friday-sale?preview_theme_id=168778662119

**Safety:** the live theme was not written to. Nothing is published or merged.

## What changed

| # | Change | How |
|---|---|---|
| 1 | Photo corners 12px | The photo frame is rounded. It keeps the same 3:4 frame and `object-fit` as before: no new crop, no stretching. |
| 2 | Card background #FAF8F5 | Through Theme settings > Dressar > **Card background**, whose default is now #FAF8F5. The page background is unchanged. |
| 3 | 1px #E5E0DA border, 12px card corners, no heavy shadow | New setting **Card border** (#E5E0DA; clear it for no border). Dawn's "Card" style shadow is switched off. |
| 4 | Spacing | Photo → name 8px, name → price 6px, price → colours 8px, colours → sizes 6px, 12px bottom padding. Dawn's extra 0.7rem margins are removed. |
| 5 | Sizes | Every size is shown; no "+N". They are centred, including One Size, with 24px buttons and 6px corners. They wrap onto a second line instead of scrolling or being cut. Unavailable sizes are struck through with a dashed frame. |

**Equal heights:** cards stay the same height across each grid row, even when one card's sizes wrap. The grid cell and Shopify's `<product-component>` now fill the cell.

**Card style:** the live store uses Theme settings > Product cards > Style **"Card"**, not "Standard". The design is now identical with either style. Before this change, the "Card" style showed white, square cards on live.

**Unchanged:**
- name, price, discount badge, colour swatches, typography;
- the quick-add bag: it stays 10px from the photo's corner, because the card is now its positioning frame and the new border doesn't move it;
- two cards per row on phones;
- choosing a colour or size, and the cart.

## Files
- `assets/dsr-card.css`: the five changes, and the rules now apply to both card styles.
- `assets/dsr-card.js`: the "+N" size fitting is removed.
- `snippets/dsr-card-sizes.liquid`: the "+N" label attribute is removed.
- `snippets/card-product.liquid`: the card border colour comes from the setting.
- `config/settings_schema.json`: Card background default #FAF8F5, and the new Card border setting.
- `tests/card-refresh.test.js` (new). The older card, home and RTL tests are updated for this design and for the Nov 19 row arrows (no arrows on phones).
- `tests/lib/theme-harness.js`: optional `settingsOverrides`, used to test the live store's "Card" style.

## Tests
- **`card-refresh`, 309/309:**
  - Arabic and English at 320, 360, 390, 430 and 1440px;
  - repeated with the live store's "Card" style;
  - colours, border, corners, the four gaps and the 12px bottom padding;
  - all sizes shown, centred and inside the card; One Size centred; unavailable sizes marked;
  - equal row heights, two cards per row, badge, swatches and bag present;
  - choosing a size still selects the exact variant; no overflow; no script errors.
- **Related suites, all pass:**
  - card-upgrade 820, card-rows 193, redesign-2s 122, quick-add 280;
  - collection 300, card-slides 158, color-photos 236, home 356 (English and Arabic);
  - arabic-mobile 312, mobile-spacing 208, rtl 29 (English and Arabic), a11y 78, regression 50, perf 18, product 183, schema 7.
- **Theme Check:** 25, unchanged.

**Real preview, White Friday collection** (Arabic and English, 320, 360, 390 and 430px):

| | Before | After |
|---|---|---|
| Card | white, square | #FAF8F5, 1px #E5E0DA, 12px |
| Photo corners | 0 | 12px |
| Photo → name / name → price / price → colours / colours → sizes | 11 / 14 / 14 / 6px | 8 / 6 / 8 / 6px |
| Sizes shown at 320px / 360px | 3 of 6 / 4 of 6 ("+N") | all |
| Cards per row; equal heights; overflow; script errors | 2; yes; none; none | 2; yes; none; none |

Screenshots: `card-refresh-shots/` (before on the left, after on the right).

## Note
The "+N" strings (`dressar.card.more_sizes`) stay in the language files, unused. They are harmless, and they are kept in case the merchant wants a one-line size row again.
