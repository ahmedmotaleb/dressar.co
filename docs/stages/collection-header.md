# Compact mobile collection header (Nov 15)

Brief: "DRESSAR — Compact Mobile Collection Header". The collection page's banner (`sections/main-collection-banner.liquid`, Dawn's collection banner with Dressar styling) is made compact below 750px, so the products start higher. Desktop is unchanged.

## Mobile (below 750px)

1. **Breadcrumbs:** hidden. They are hidden with CSS, so the breadcrumb structured data (JSON-LD) stays in the page for search engines. The new "Show breadcrumbs on mobile" setting brings them back.
2. **Title:**
   - 22px, line height 1.35, from the reading side (right in Arabic, left in English).
   - Arabic pages: Cairo SemiBold 600, the theme's existing Cairo file.
   - English pages: the theme heading font at 500. Cairo has no Latin letters, and Poppins has no 600 face in this theme.
3. **One language only:** a title written in both languages, such as "Back to University | لبس الجامعة", shows only the part in the page's language.
   - Arabic parts are recognised by their letters, so nothing is hard-coded.
   - The whole title stays in the `<h1>` for search engines and desktop. Single-language titles, and titles translated in Shopify, show as they are.
4. **Description:**
   - 13px, line height 1.5.
   - Cut to 3 lines (a setting) with the existing "Read more" / "Read less" button. The button sets `aria-expanded` and `aria-controls`.
   - The whole description stays in the page, readable by screen readers, and opens fully.
   - The check for whether a description needs the button now runs again when the width changes.
5. **Spacing:**
   - 12px above the title.
   - 8px from the title to the description.
   - 20px from the description, or the button, to the filter bar.
   - The product grid's own top padding and the filter bar's top padding are removed on phones, so those 20px are the whole gap.
6. **Unchanged:** product count, filters, sorting, pagination and the filter drawer.

**Result.** At 390px the first product card starts at about **312px** from the top of the page, down from about **408–439px**, roughly 100–125px higher. Figures are from the test fixtures; the real collection's numbers depend on its description.

## Theme editor

New **Mobile** settings in the collection banner:
- show breadcrumbs on mobile (off);
- title size (22px);
- description lines before "Read more" (3);
- space above the title (12px);
- space before the filters (20px).

Existing setting IDs (`show_breadcrumbs`, alignments, `color_scheme`, ...) and the merchant's values are unchanged.

## Files

| File | |
|---|---|
| `sections/main-collection-banner.liquid` | Mobile settings, title in parts, Read more re-measured on resize |
| `assets/dsr-collection.css` | Compact mobile header styles |
| `tests/collection-header.test.js` (new) | Tests; `--measure-only` measures any theme folder |

## Tests

`tests/collection-header.test.js`: 133 checks on the real collection template, using a collection with the store's real two-language title and description, Arabic and English, at 360, 390 and 430px. It also checks 1440px for the unchanged desktop.
- **Breadcrumbs:** hidden, with their structured data kept.
- **Title:** shown once in the page's language, with the full title still in the heading. Size, line height, weight and font; aligned from the reading side.
- **Spacing:** 12px, 8px and 20px, and nothing overlapping.
- **Description:** 13px/1.5, cut to 3 lines, the whole text still in the page. "Read more" opens it fully; "Read less" closes it, with labels and `aria-expanded`.
- **Filters:** the drawer opens, with sorting.
- **Desktop:** breadcrumbs, the whole title and the 32px size are as before.

Still passing: `collection.test.js` (300, filters, sort and pagination), `rtl.test.js`, `seo.test.js`, `a11y.test.js`.

**Screenshots:** `docs/stages/collection-header-shots/`, a local render. `before-*.png` is the theme before this change, the rest is after. Real-preview before and after shots are in the PR.

## Notes

The store's collection descriptions are written in both languages (Arabic paragraph, then English). On phones the first 3 lines are the Arabic paragraph on both language versions. Showing only the page's language in descriptions would need the descriptions translated in Shopify (Translate & Adapt), or a rule for splitting them. That is not part of this change.
