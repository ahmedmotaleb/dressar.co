# Arabic mobile home page, product carousels and product description (Nov 17)

**What this covers:** three briefs:
- **Arabic Mobile RTL & Homepage UX Fix:** counters, RTL, carousels, localization, editorial sections, "View all".
- **Fix Mobile Product Carousel:** two whole cards per phone screen.
- **Premium Product Description Redesign.**

**Where:**
- Branch: `claude/dressar-arabic-mobile`, built on `claude/dressar-mobile-spacing` (PR #10).
- Preview theme `#168455471335`, unpublished:
  - Arabic: https://dnx31m-mi.myshopify.com/ar/?preview_theme_id=168455471335
  - English: https://dnx31m-mi.myshopify.com/en/?preview_theme_id=168455471335
  - Product: https://dnx31m-mi.myshopify.com/ar/products/off-white-tiered-joubert-skirt?preview_theme_id=168455471335

**Safety:** the live theme `#168399831271` was not written to. Nothing is published or merged.

**Screenshots:** the brief mentions three screenshots, but none came with it. The "before" state was captured from the preview itself (`arabic-mobile-shots/`).

## Root causes

### 1. "2/1", "7/1", "1/8" under carousels
- **What it was:** Dawn's numeric counter, "1 / 8".
- **Why it read wrong:** in Arabic the bidirectional algorithm reorders it, so it reads "8/1". Several sections used it:
  - the five product rows;
  - both slideshows (navigation set to "Counter");
  - the "Why Dressar" multicolumn.
- **Space:** each counter sat in a 44px bar under the content.

### 2. A third product card peeking, uneven edges in RTL
- **Physical values:** Dawn's mobile slider spaces cards with physical left/right values:
  - `margin-right` on every slide;
  - `scroll-padding` on one side only;
  - an `::after` spacer.
- **In RTL:** the theme's overrides mirror only part of this. The visible area therefore always included part of a third card.
- **One card per screen:** three home rows (White Friday, Best Sellers, Complete Looks) were set to one card per screen on phones.

### 3. English on the Arabic store
**The store's setup:**
- Its main language is English, but the home content was written in Arabic in that main slot.
- The "Arabic translations" saved for it were machine translations *into English*. Examples:
  - "ليه دِرسَر؟" became "Why Dürr Assembly Products?"
  - "دِرسَر في بيتك" became "Study at home"
  - "اكتشفي دِرسَر هوم" became "Discover Dirser Home"

**Result:** `/ar` showed English and `/en` showed Arabic.

### 4. Clipped card content in narrow cards
- **Size row:** a scrolling strip, so at about 120px some size boxes were cut in half.
- **Mixed names:** an English-first name ("Long Linen Shirt Dress | قميص…") in an Arabic card was right-aligned, so its overflow lost the *first* letters.
- **"+N":** read as "1+" in Arabic.

### 5. Narrow editorial text
The "Why Dressar" columns were about 150px wide in a swipe row, so the text wrapped every two or three words.

### 6. Product description
**Typography:** 16.5px text with 28px gaps between paragraphs.

**The text itself:** the store's descriptions follow one pattern:
- introduction;
- styling;
- "Sized for heights 155–170 cm";
- "WhatsApp us on 01020676173".

The raw phone number therefore showed in every product's text.

## What changed

### Carousels (all home product rows)
**Layout:**
- **Two whole cards:** with 2 columns on phones, each row shows exactly two whole cards.
- **Spacing:** 8px between cards, 16px from each edge.
- **Snapping:** a swipe snaps to whole cards.

**Images:** 3:4, as before.

**RTL:**
- **Logical properties:** `gap`, `margin-inline` and `scroll-padding-inline` throughout.
- **Start edge:** the first card starts 16px from the right in Arabic and from the left in English.
- **Arrows:** "next" moves in reading order in both.

**Template:** the three single-card rows are now set to 2 columns on phones, through the existing Dawn setting.

**Unchanged:**
- 768px and up;
- swipe, the arrows, quick add, colours, sizes and links.

### Slide counters
**Removed in the Liquid,** not hidden with CSS. A new snippet, `snippets/dsr-slider-status.liquid`, replaces them with a screen-reader-only live status ("1 من 8" / "1 of 8") that Dawn's script keeps up to date. Used in:
- product rows;
- slideshows in Counter mode;
- the multicolumn carousel.

**Slideshows:**
- **Arrows:** 44px round buttons over the bottom of the image, so no bar is reserved below it.
- **Dots / Numbers modes:** unchanged.

**Not affected:** product image galleries.

### Cards
- **Sizes:** as many whole size boxes as fit, then "+N". The hidden sizes are on the product page, and screen readers are told so. The chosen size is never hidden.
- **Names:** an inner span takes each name's own direction and cuts only its end.
  - "Long Linen Shirt Dr…": English-first names keep their first letters.
  - Arabic-first names are cut on the left, as before.
  - Short names still sit on the page's reading side.

### Localization (preview theme's translations only)
**Arabic translations corrected.** For 26 text fields on the home page, the Arabic translation was set back to the merchant's own Arabic: slides, buttons, "Why Dressar" titles and text, benefits and the category heading. Three row headings that were in English got Arabic:
- "New Arrivals" → "وصل حديثًا";
- "Complete Looks | أطقم متكاملة" → "أطقم متكاملة";
- "Back to University | لبس الجامعة" → "لبس الجامعة".

**Not changed:**
- the main-language content;
- the live theme's translations (each theme has its own).

**Interface strings:** in the language files; "عرض الكل" is unchanged.

### Editorial sections
- **"Why Dressar":** a new **Mobile layout** setting (Carousel, the default; or List). The home section uses List:
  - each item is a row, with an 88px image beside full-width text;
  - Arabic line height 1.75;
  - no swipe and no counter.
- **Spacing:** row footers keep the compact 12/16/24px spacing from PR #10.

### Product description (`snippets/dsr-product-description.liquid`)
**Text:** the merchant's paragraphs, word for word, grouped:
- **Introduction:** the first paragraph, 15.5px.
- **Details:** the other paragraphs.
- **Size guidance:** paragraphs with a measurement ("155–170 سم", "150 cm"), under a small ruler label "إرشادات المقاس" / "Size guidance".

**WhatsApp:**
- When the theme's WhatsApp number is set, the "WhatsApp us on 0102…" paragraph becomes a compact outline button: "اسألي على مقاسك واتساب" / "Ask about your size on WhatsApp".
- The button is 44px tall and opens WhatsApp with the product named.
- No raw number is shown in the text.

**Typography:**
- 14.5px on phones, 15.5px from 750px.
- Line height 1.8 in Arabic, 1.65 in English.
- 12px between paragraphs.
- Aligned to the reading start, never centred.
- Hairline separators between groups; no boxes.

**Safety:**
- Descriptions with lists, tables, headings or images are shown exactly as written.
- Nothing is invented.
- Product data in the admin is unchanged.

**Theme editor:** the description block has two new settings, *Structured layout* and *WhatsApp line as a button*, both on. Turning them off shows the description as written.

## Files
| File | Change |
|---|---|
| `sections/featured-collection.liquid` | `dsr-two-up` class; counter → status snippet |
| `sections/slideshow.liquid` | Counter mode: status snippet, arrows over the image; setting info |
| `sections/multicolumn.liquid` | Mobile layout setting (Carousel / List); counter → status snippet |
| `sections/main-product.liquid` | Description block renders the new snippet; two block settings |
| `snippets/dsr-slider-status.liquid` | New: screen-reader-only slide position |
| `snippets/dsr-product-description.liquid` | New: description layout |
| `snippets/dsr-card-sizes.liquid` | "+N" label attribute |
| `snippets/card-product.liquid` | Name in a `span.dsr-card-title` |
| `snippets/dsr-size-help.liquid` | Optional `label` |
| `assets/dsr-row-footer.css` | Two whole cards per screen, logical properties |
| `assets/dsr-slideshow.css` | New: arrows over the image |
| `assets/dsr-multicolumn.css` | New: List layout |
| `assets/dsr-card.css` | Name truncation, "+N" |
| `assets/dsr-card.js` | Fit sizes, "+N" |
| `assets/dsr-product.css` | Description typography and button |
| `locales/*.json` (32) | `more_sizes`, `description_fit`, `size_help_short` |
| `templates/index.json` | Rebuilt from the preview's newer copy (a theme-editor save on Nov 16); 3 rows to 2 columns on phones; multicolumn List |
| `tests/arabic-mobile.test.js`, `tests/pdp-description.test.js` | New |
| `tests/lib/card-layout.js`, `tests/collection.test.js` | Read the name from its new span; skip sizes behind "+N" |

## Tests

### Automated (local renders of the real theme)
- **`arabic-mobile`, 302/302** (Arabic and English, 8 widths):
  - no visible numeric counter anywhere on the page;
  - two whole cards per row on phones, equal widths, 8px gap, 16px start edge, reading-order direction;
  - "next" and a short swipe both land on two whole cards;
  - no clipped size box or name start; 3:4 images;
  - slideshow arrows over the image, 44px, together;
  - multicolumn List on phones; no overflow; no script errors.
- **`pdp-description`, 164/164:**
  - grouping and nothing lost;
  - no number in the text; button 44px;
  - 14.5/15.5px, line height 1.8/1.65, 12px gaps, start alignment;
  - table descriptions shown as written; settings off shows the description as written.
- **Full suite:** 6,759/6,759, all 29 test files in English plus the 11 suites that run per language in Arabic.
  - Two older tests were updated for the new behaviour:
    - `card-rows` now ignores size boxes hidden behind "+N";
    - `mobile-spacing` now expects no visible slideshow counter (this brief removes it).
- **Theme Check:** 25 offences, the same as the base branch.

### Real preview (`#168455471335`): 198/198
- **Coverage:** home and a product page, Arabic and English, at 320, 360, 375, 390, 430, 768, 1024 and 1440px.
- **Home:**
  - no visible counters; two whole cards in all five rows on phones; 16px start edge;
  - "next" moves in reading order; no clipped sizes; "View all" / "عرض الكل";
  - no English text left in Arabic headings, buttons or editorial copy;
  - no sideways scrolling; no theme script errors.
- **Product page:**
  - structured description; sizes and line heights as above;
  - no raw number; 44px WhatsApp button; no overflow; no theme script errors.
- **Ignored:** third-party script errors (TikTok pixel, analytics fetches), which come from apps.

### Not checked
- real phones (Chromium with phone emulation only);
- the theme editor UI itself.

## For the merchant (store data, not changed)
1. **Main language.**
   - The main language is English but the home content is written in Arabic, so `/en` shows Arabic headings.
   - The clean fix is in Settings → Languages: make Arabic the default and English a translation, then add the English text in Translate & Adapt.
   - Until then, English visitors see Arabic home headings.
2. **Product option names and values** show in English on `/ar`: "Color", "Size", "Fabric", "Off white".
   - They are product data and need Arabic translations in Translate & Adapt.
3. **Repeated WhatsApp number.**
   - The size chart accordion's own text says the measurements are "in the description above" and repeats the WhatsApp number.
   - It is merchant text in the product template; consider shortening it.
4. **One Arabic translation reads like machine translation:** "Why Dressar" column 1 shows "سيلويت مريح مصمم للحركة اليومية - واسع من دون أن يكون مهملًا". The original is "…متصمم للحركة اليومية — واسع من غير ما يبقى مبهدل". It was left as is; the merchant can replace it in Translate & Adapt.
5. **Live theme.**
   - The translation fixes were made on the preview theme only.
   - Publishing the preview carries them over.
   - Fixing the live theme separately needs the same change there.
