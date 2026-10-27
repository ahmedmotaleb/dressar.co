# Stage 7: homepage merchandising

## 1. Approach

The homepage keeps its content: hero, campaign, categories, editorial photos and videos, "Why Dressar", the service icons and the Judge.me testimonials. All copy, photos and collections are the merchant's, unchanged.

Stage 7 changes three things:
- the product rows run on Dawn's own featured-collection section, with the Stage 4 DRESSAR card
- the sections follow a merchandising order
- nothing on the page moves by itself

Everything stays editable in the theme editor. The AI sections that were replaced are kept, switched off, so each one can come back with one click.

## 2. Product rows

**Before:** five AI carousel blocks (`ai_gen_block_c5191df` ×4, `ai_gen_block_13d13cc` ×1):
- **Weight:** each instance printed its own copy of about 300 lines of CSS and its own carousel script and custom element, five times over.
- **Cards:** their own markup, not the theme's card. No swatches or sizes, and a sale badge separate from the Stage 2/4 logic.
- **Photos:** one 800 px image for every screen (no `srcset`), and lazy loading even for the row right under the hero.
- **Labels:** carousel buttons labelled "Previous"/"Next" in English on an Arabic page.
- **Hard-coded styling:** colours (`#121212`, `#910505`) set per block.

**Now:** five Dawn `featured-collection` sections, one per row.

| Row | Collection | Heading (as it rendered before) |
|---|---|---|
| Campaign | `white-friday-sale` | عروض الوايت فرايدي 🖤 |
| New arrivals | `new-arrivals` | New Arrivals |
| Best sellers | `best-seller` | الأكثر مبيعًا |
| Complete the look | `complete-looks` | Complete Looks \| أطقم متكاملة |
| Seasonal | `back-to-university` | Back to University \| لبس الجامعة |

Each row:
- **8 products from the collection, in the collection's own order**, then a "View all" button to the collection. The AI rows showed 12; eight keeps the page shorter and points shoppers to the full, filterable collection.
- **The DRESSAR card at 3:4** (Stage 4): honest % badge, colour swatches, sizes, warm photo background, hover photo on desktop.
- **Dawn's slider:**
  - **Phones and tablets:** two cards and a peek of the next, swipeable.
  - **Desktop:** four across with the next one peeking, plus previous/next buttons and a counter, labelled from the locale ("الشريحة التالية").
  - One slider script for the whole page (`slider-component` in Dawn's `global.js`).
- **Responsive photos** (`srcset`/`sizes`).
  - The campaign row loads its first four photos eagerly, since it sits right under the hero.
  - Every row below loads lazily from the first card. This is a two-line marked edit in `sections/featured-collection.liquid` (`section.index > 2`). When `section.index` is nil (theme editor, Section Rendering API), Dawn's default applies.
- **Merchant-editable:** collection, heading, product count, columns, slider, "View all" style, colour scheme, card ratio. The headings are plain text now. The AI rows showed the collection title through a dynamic source; if a collection is renamed, edit the heading too.

## 3. Order

Top to bottom (Announcement bar, header and footer are in their groups, unchanged):

1. Hero slideshow (campaign slide first)
2. **White Friday row** (live campaign, right under its hero slide)
3. **New arrivals**
4. Shop by category (collection list)
5. **Best sellers**
6. Editorial photo grid
7. **Complete the look**
8. Home wear slideshow
9. **Back to university** (seasonal)
10. "Dressar Signature" videos
11. Why Dressar (fabric, coverage, cut)
12. Service icons (delivery, cash on delivery, inspection, exchange)
13. Judge.me testimonials
14. Newsletter: in the footer, as before

This follows the brief's hierarchy. The campaign row stays directly under the campaign slide, because the sale is live; when it ends, switch that row off or point it at another collection.

**Kept, switched off** (rollback):
- `dsr_white_friday`
- `blocks_UNdXLN`
- `178380029305c1cfb4`
- `blocks_ejM6Ri`
- `178393405299cfb2a3`

The AI slideshow (`178387929947731171`) and AI product grid (`blocks_QqFNpk`) were already off and stay as they were. No AI block file was deleted; Stage 9 decides that with a usage search.

## 4. Nothing moves by itself

- **Both slideshows:** "Auto-rotate slides" off. The shopper moves them with the arrows or a swipe. Five-second rotation on a phone moved the hero's Arabic copy away while it was being read, and auto-rotation is a WCAG 2.2.2 concern.
- **"Image behavior":** set to None. The hero photos had a 30-second infinite "ambient" zoom.
  - Stage 2 had frozen it with an `!important` rule in `component-card.css`. That rule is gone: the editor setting decides again.
  - To bring the zoom back: Customize → Slideshow → Image behavior → Ambient.

## 5. Shop by category

Desktop now shows **3 columns** (was 2): six categories in two rows instead of three rows of very tall tiles (about 2,200 px of page at 1280 px wide). Phones keep 2 columns. To change it, use Customize → Collection list → Number of columns on desktop.

## 6. Brand positioning (merchant copy, not changed)

The homepage words are the merchant's, and the theme doesn't rewrite them. Against the brief:

| Message | On the homepage today |
|---|---|
| Elegant modest fashion | Implied by the photography; not said in words |
| Loose silhouettes | "Why Dressar": «قصّات واسعة مدروسة» (loose, considered cuts) |
| Coverage and opacity | "Why Dressar": «خامات مبطّنة غير شفافة» (lined, not see-through) |
| Pieces that work together | "Why Dressar": «كل قطعة تليق على التانية», plus the footer's about text |
| Hijab-friendly styling, maxi coverage | **Not mentioned anywhere** |
| Generic "luxury" wording | None found (no "luxury"/«فاخر» in the homepage or footer) |

**Suggestion:** name hijab-friendly styling and maxi lengths somewhere above the fold. For example, use the hero's second slide subheading, or a fourth "Why Dressar" column ("maxi lengths, hijab-friendly necklines").

## 7. What it weighs (test harness, homepage `<main>`)

| | Before | After |
|---|---|---|
| Inline `<script>` blocks | 8 (13.6 KB) | 3 (2.4 KB): the three kept editorial blocks |
| Inline CSS | 35.7 KB | 10.1 KB |
| Carousel implementations | 5 AI custom elements + Dawn's slider | Dawn's slider only |
| Products in rows | 60 | 40 |
| Card photos with `srcset` | 0 | all |
| Eager images | hero only (every card lazy) | hero + first 4 cards of the campaign row |

Stylesheets: each Dawn row links the card and slider CSS again, which is Dawn's standard behaviour; the browser loads each file once.

## 8. Files

| File | Change |
|---|---|
| `templates/index.json` | 5 featured-collection rows; 5 AI carousels off; new order; slideshows without auto-rotate or zoom; category list 3 columns on desktop |
| `sections/featured-collection.liquid` (Dawn) | Rows below the second section load every photo lazily |
| `assets/component-card.css` | Stage 2's `!important` ambient override removed |

## 9. Tests and results

`tests/home.test.js` (new), at 360/390/430/768/990/1280/1440 px, checks:
- **Template:** the Stage 7 order; no AI carousel renders; the replaced ones are kept off; five rows at 3:4 with 8 products, sliders and "View all"; slideshows still.
- **Page:**
  - the same order in the rendered page
  - one H1
  - no horizontal overflow
  - no AI carousel markup, and Dawn's slider in every row
  - at most 3 inline scripts in the page body
- **Each row:**
  - the merchant's heading
  - the collection's first 8 products in its order
  - every photo at 3:4
  - "View all" goes to the collection
  - DRESSAR swatches/sizes present
  - two-and-a-peek on phones and tablets; four-and-a-peek on desktop
  - eager/lazy loading as described
- **Hero:**
  - no autoplay
  - first image eager with `fetchpriority="high"`, the others lazy
  - no zoom animation
  - labelled buttons
- **Shop by category:** 6 linked collections with photos, 2 or 3 columns.
- **At 390 and 1280:**
  - the hero stays on its slide for 6 seconds; "next" shows slide 2
  - "next" scrolls the New arrivals row
- **Everywhere:** every theme asset requested exists; no JS errors; the "View all" label comes from the locale.

`tests/schema.test.js` adds a check that every section and block setting in the JSON templates holds a value its schema allows (select options, range bounds). Shopify refuses a template otherwise.

Harness additions (`tests/lib/`):
- section settings for collections, images and `shopify://` links resolve as on Shopify
- `section.index`
- `image_tag` lazy-loads from the 4th section when no `loading` is given, as Shopify does
- fixture collections carry their real photo sizes, plus an offset so rows differ

| Suite | `en.default` | `ar` |
|---|---|---|
| `home.test.js` (new) | 349 / 349 | 349 / 349 |
| `schema.test.js` (+ template values) | 6 / 6 | |
| `cart.test.js` | 73 / 73 | 73 / 73 |
| `product.test.js` | 183 / 183 | 183 / 183 |
| `collection.test.js` | 293 / 293 | 293 / 293 |
| `header.test.js` | 210 / 210 | 210 / 210 |
| `liquid-logic.test.js` (Stage 2 badge logic) | 15 / 15 | |
| `pdp-sticky-sympl.test.js` (Stage 2 sticky bar and Sympl) | 47 / 47 | |

**Theme Check:** 30 offenses, all warnings, identical to Stage 6; none new.

**Visual QA:** the full homepage at 390 and 1280 px, **in the test harness**, with placeholder colours for photos. The real photos, videos, Judge.me widget and storefront could not be loaded from this environment.

## 10. Manual checks and merchant actions

1. **On the preview:** scroll the homepage on a phone.
   - Check the real photos in the 3:4 crops, especially the campaign row.
   - Check the swipe on each row.
   - Check the hero no longer rotates.
2. **White Friday:** when the sale ends, switch off the campaign row (and the hero's first slide), or point the row at the next campaign's collection.
3. **Headings:** they are plain text now. If a collection is renamed, edit its row's heading.
4. **Judge.me testimonials:** check they still show under the service icons.

## 11. Risks and rollback

- **Rows show what the collection holds.** If a collection is sorted badly or has sold-out products first, the row shows that. Sort the collection in admin.
- **Rollback, per row:** switch the Dawn row off and the old AI section on, in the editor.
- **Rollback, everything:** revert this commit.
