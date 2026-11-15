# Editorial mosaic categories (Nov 15)

Brief: "DRESSAR — Premium Editorial Mosaic Categories". The home page's collection categories ("تسوّقي حسب احتياجك", the Dawn **Collection list** section `collection_list_DJAc8Q`) are redesigned in place as an asymmetric editorial mosaic. No section was added. The store's collections, images and links are unchanged.

## Layout

The section gets a **Layout** setting: *Editorial mosaic* (the default, so the existing section switches with no template change) or *Classic grid* (Dawn's original list, unchanged).

**Phones (below 750px), "Featured, two beside it"**
- The **featured** collection: 50% of the width, two rows tall, a tall portrait.
- The **next two** stack beside it as squares.
- The **rest** follow two to a row (squares); an odd last one spans the row (2:1).
- **Spacing:** 8px gaps and the page's 16px side gutter.
- **Height:** at 390px the six collections take 792px (about 2 screen widths).

**Desktop (from 750px), "Featured, asymmetric"**
- A 4-column grid: the featured collection 2×2, a tall card beside it, two squares.
- The rest as wide pairs; an odd last one spans the row.

**"Even" options:** plain two columns on phones (4:5) and "Number of columns on desktop" columns on desktop.

**Reading order:**
- The featured card comes first in the markup. The others follow in the editor's order.
- The grid follows the reading direction: the featured card sits on the left in English and on the right in Arabic.

## Cards

- The whole card is one link to the collection: image, title and a small arrow (mirrored in Arabic). The corners are 6px (a setting).
- **Title:**
  - on the image over a soft shade, or below it (a setting);
  - 14px medium on phones, 16px from 750px;
  - Cairo for Arabic letters, the theme body font for Latin;
  - one line, with an ellipsis for long names.
- **Image:**
  - The collection's own image (or the block's image override), `object-fit: cover`.
  - Positioned at the image's focal point, which Shopify's image editor sets, or top, center or bottom.
  - Responsive `srcset`, with `sizes` for each card's place in the grid; lazy loading.
  - The grid cells have fixed proportions, so nothing moves while images load.
- **Motion:** a subtle zoom on hover (pointer devices only, off with reduced motion).

## Theme editor

**Section**
- Layout (mosaic / classic).
- Mosaic on mobile (featured / even).
- Mosaic on desktop (featured / even).
- Space between cards.
- Card corner radius.
- Card title (on the image / below it).
- Show heading.
- Unchanged: color scheme (background) and top/bottom padding (section spacing).

**Each collection block**
- Feature this collection: shown large and first. Without one, the first block is featured.
- Image (an override; set its focal point in Shopify).
- Image position (focal point / top / center / bottom).

**Setting IDs:** every existing ID is kept. The classic grid still uses image ratio, columns and swipe.

**No hard-coding:** no collection, image or text of the store is in the code.

## Files

| File | |
|---|---|
| `sections/collection-list.liquid` | Mosaic layout and settings (Dawn's list kept as "Classic grid") |
| `snippets/dsr-mosaic-card.liquid` (new) | Category card |
| `assets/dsr-mosaic.css` (new) | Mosaic grid and cards |
| `tests/lib/theme-harness.js` | `image_tag` prints `srcset` for `widths`, as Shopify does |
| `tests/editorial-mosaic.test.js` (new) | Tests |

## Tests

`tests/editorial-mosaic.test.js`: 200 checks on the real home template, Arabic and English, at 360, 390, 430, 768, 990 and 1440px.
- **Collections:** every collection once, each opening its own page.
- **Grid geometry, measured:**
  - **Phones:** the featured card at half width and two rows tall; two squares beside it; then a pair and a full-width card.
  - **Desktop:** featured 2×2, a tall card, two squares, a wide pair.
  - **Direction:** the featured card on the reading side in each language.
- **Cards:** the whole card is the link, with 6px corners.
- **Images:** they cover and fill their frame, load lazily, and have a `srcset` and `sizes`.
- **Titles:** 14px or 16px, medium, Cairo for Arabic, with an arrow.
- **Spacing and stability:** 8px gaps, 16px side gutters, no sideways scrolling, no layout shift while images load. Phone height is at most 2.1 screen widths.
- **Settings:**
  - a chosen featured collection leads while the others keep their order;
  - the heading can be hidden;
  - the title can go below the image;
  - the even mobile layout works;
  - "Classic grid" brings back Dawn's list.

**Screenshots:** `docs/stages/editorial-mosaic-shots/` is a local render with placeholder images. Real-preview before and after shots, with the store's own category images, are in the PR.
