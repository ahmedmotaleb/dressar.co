# Mobile home spacing, editorial images, carousel counter (Nov 16)

**Branch and preview**
- Branch: `claude/dressar-mobile-spacing`, from `claude/dressar-integration`.
- Preview theme: `#168455471335` (unpublished).
  - Arabic: https://dnx31m-mi.myshopify.com/ar/?preview_theme_id=168455471335
  - English: https://dnx31m-mi.myshopify.com/en/?preview_theme_id=168455471335
- The live theme `#168399831271` was only viewed, for the "before" screenshots. Nothing was written to it.

## Requests covered
1. **Product carousel footer:** less space under the cards, a compact "View all" button.
2. **Editorial images:** the three-image section as a mosaic on phones.
3. **Mobile header:** review only.
4. **Carousel counter:** remove the "1 / 8" under the product rows.

## What changed

### Product rows (`sections/featured-collection.liquid`, `assets/dsr-row-footer.css`)
These are all five home-page product rows: White Friday, New Arrivals, Best Sellers, Complete Looks, Back to Uni.

**New "Compact footer" setting:** a checkbox, on by default. No existing setting ID changed.
- **On phones:**
  - 12px from the cards to the arrows;
  - 16px from the arrows to "View all";
  - 24px above the heading and below "View all".
- **At all sizes:** "View all" is a 40px outline button with a 1px edge.
  - The text still comes from the language files ("View all" / "عرض الكل").
  - It still links to the collection.

**Scope:** the styles only target the "View all" link inside these rows. Other buttons are not affected.

**Counter removed from the Liquid**, not hidden with CSS:
- The visible "1 / 8" is gone.
- The two arrows now sit together with an 8px gap.
- A screen-reader-only live status ("1 of 8" / "1 من 8") keeps the old class names, so Dawn's slider script still updates it. Screen readers hear the position when the row moves.

**Unchanged:**
- Arrows, swipe and the desktop slider.
- Cards: images, prices, colours, sizes, quick add.

**Not affected:** the slideshow, multicolumn, collection list and product image galleries keep their own counters. They are separate sections.

### Editorial images (`blocks/ai_gen_block_4a20873.liquid`, "Media grid")
- **Which section:** the home section `1783544336b861804d`, with its three images.
- **Kept as they were:** the images, the section and the block settings. The images have no links.
- **New phone layout:**
  - the first image full width at 16:9;
  - the other two side by side at 3:4;
  - 8px gaps, 6px corners, 16px side margins.
- **Images:**
  - `object-fit: cover`;
  - the image's focal point from the admin is used as `object-position`;
  - responsive `srcset` and `sizes`, lazy loading.
- **New "Mobile" settings:** mosaic on/off, gap, corner radius.
- **Desktop:** unchanged.
- **Space down to Complete Looks:** 24px, was 27px. The section is 443px tall at 390px, was 686px.

### Header
- **Measured, not changed:** 58px tall on phones (320–430px), logo 100×34.
- It is already within the 56–60px target, with the menu, search, account and cart controls in place.

## Measurements on the preview
Home page, White Friday row.

| | 390px before | 390px after | 1440px before | 1440px after |
|---|---|---|---|---|
| Cards → arrows | 17px | 12px | 11px | 11px |
| Arrows → "View all" | 11px | 16px | 11px | 11px |
| "View all" height | 52px solid | 40px outline | 52px | 40px |
| "View all" → section end | 27px | 24px | 36px | 36px |
| Visible counter | "1 / 8" | none | "1 / 5" | none |
| Editorial images | 3 stacked, 686px | mosaic, 443px | unchanged | unchanged |

- **Phone widths:** the same results at 320, 375 and 430px.
- **768px:** only the button and the counter change; the phone spacing applies below 750px.
- **Both languages:** Arabic (`/ar`) and English (`/en`) give identical numbers.
- **All widths:** no sideways scrolling.

## Tests
- **New `tests/mobile-spacing.test.js`, 222/222.** Arabic and English at 320, 375, 390, 430, 768 and 1440px. It checks:
  - spacing, the button and its link, the mosaic and the header;
  - no visible counter, no space kept for it, the status updates when "next" is pressed;
  - the slideshow keeps its counter;
  - other buttons untouched, no overflow, no script errors.
- **Related suites (English):**
  - schema 7, home 356, a11y 78, rtl 29, regression 50, perf 18;
  - quick-add 280, collection 300, card-upgrade 820;
  - heading-typography 131, editorial-mosaic 200, store-benefits 119, video-stories 262.
- **Related suites (Arabic):** home 356, a11y 78, rtl 29, regression 50.
- **Theme Check:** 25 offences, the same as the integration branch.

## Screenshots
`mobile-spacing-shots/`: before is the live theme, after is the preview. Both use the store's real images.

| Name | What it shows |
|---|---|
| `*-row-*` | White Friday row with its arrows and "View all" |
| `*-grid-context-*` | Editorial images and the start of Complete Looks |
| `*-top-*` | Top of the home page with the header |

## Notes
- **English at the store root:** `dressar.co/` now opens in Arabic and English is at `/en`. English is still the primary language in the admin, so this comes from the store's market or redirect settings, not the theme.
- **English row headings:** on `/en` the row headings show Arabic. That text is saved in the section settings; the same happens on live.
