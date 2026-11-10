# Photo slideshow on collection cards

**Status:** on the branch and the preview theme `#168303165671` (unpublished). Not on the live theme.

**Scope:** the collection page's product grid only.
- **Unchanged:** search results, homepage rows and "Complete the look" keep Dawn's cards.
- **Not touched:** the product page and its gallery, the colour photo selector, and the "+" quick add.

The reference video didn't come through with the request, so this follows its written description.

## What shoppers get

**Desktop with a mouse**
- With the pointer on a card's photo, its images play: the card's own photo first, then the next every 800ms, looping. It uses up to 5 of the product's Shopify images.
- Each image fades in over 0.3s. They fill the 3:4 photo box without stretching, and the card's size never changes.
- When the pointer leaves the photo, the card is back on its first photo at once, with no fade.
- It also stops when the card scrolls off screen, the tab is hidden, or the window loses focus.
- A product with one photo stays still: Dawn's card as before, including its small hover zoom.
- A click on the card still opens the product: Dawn's card link stays on top. The "+" stays above everything and only does quick add. Any click stops the slideshow, so nothing plays behind the quick-add dialog.

**Phones and tablets (touch)**
- No autoplay.
- The photos are a row to swipe sideways. It runs right to left in Arabic.
- Up-and-down scrolling of the page stays the browser's own, even when it starts on a photo.
- A tap on a photo opens the product, with the picked colour if there is one. A swipe never opens it, because browsers send no tap after a scroll.

**Unchanged on the card:** the title, price, sale and sold-out badges, colour swatches, sizes and stock.
- **Picking a colour:** the card shows that colour's photo. The slideshow then stays off for that card, as Stage 4 kept the picked photo. On touch, the row goes back to the first photo, which now shows the picked colour.

## Performance

- **One card at a time.** A single player, with one pointer listener for the whole page, plays only the card under the mouse.
- **Lazy images.** A card's extra images have no source until that card is first hovered (desktop) or touched (phones). Until then they cost nothing.
- **Pauses at once** when the card leaves the screen (IntersectionObserver), the tab is hidden, or the window loses focus.
- **Reduced motion** ("prefers-reduced-motion"): no autoplay at all.
- **Clean-up.** There is one timer, cleared on every stop. Per-card listeners and the observer are removed when cards are replaced, for example by filters.
- **No libraries.** One plain script (`assets/dsr-card-slides.js`, about 230 lines with comments) and a little CSS.

## Setting

Collection page → Product grid → **"Dressar: photo slideshow"** (on). It replaces "Show second image on hover" for products with more than one photo. Switch it off for Dawn's second-image hover again.

## How it's built

| File | Change |
|---|---|
| `snippets/dsr-card-slides.liquid` (new) | The slides. The first is a copy of the card's photo, filled in by the script. The other up-to-4 images carry their URLs in `data-src` and `data-srcset`. Hidden from screen readers: the card's photo, title and link already describe it. |
| `assets/dsr-card-slides.js` (new) | The player (desktop), the swipe row and taps (touch), lazy loading |
| `snippets/card-product.liquid` (Dawn) | New `image_slideshow` parameter. With it, a product with 2 or more images gets the slides instead of Dawn's second image, without `media--hover-effect`. |
| `sections/main-collection-product-grid.liquid` (Dawn) | The setting, passes it to the cards, loads the script |
| `assets/dsr-card.css` | Styles: fades on desktop, swipe row on touch |

### Layers

- **The slides sit inside Dawn's photo box,** under the sale badge and the card's full-size link.
- **Desktop:** they never take clicks.
- **Touch:** the photo box is lifted above the card link, and Dawn's badge layer lets touches through. This happens only after the script has started, so without it the card link works as before. The "+" is above both.

## Tests

`tests/card-slides.test.js` (new), 158 checks. Mouse at 990, 1280 and 1440 px; touch (emulated phone or tablet) at 360, 390, 430 and 768 px; Arabic at 1280 (mouse) and 390 (touch).

- **Desktop:**
  - 5 slides for a 6-image product, in a 3:4 box
  - nothing extra loaded before hover
  - the hover starts on the card's photo, then images 2 to 5, each about 800ms apart
  - only the hovered card plays, and the other cards load nothing
  - the card's size doesn't change, and the images fill the box (cover)
  - the badge and "+" stay on top
  - it keeps playing over the "+"; the "+" opens quick add without opening the product, and stops the slideshow
  - leaving the photo resets at once, and no timer is left
  - moving to another card plays only that one; scrolling the card off screen stops it
  - a click on the photo opens the product
- **Desktop, other cases:**
  - a one-photo product stays static
  - a picked colour keeps its photo
  - reduced motion means no slideshow and no extra loads
  - search and the homepage have no slideshow
- **Touch:**
  - no autoplay, and the photos take touches
  - a sideways swipe shows the next photo (right to left in Arabic), without navigating or moving the page; the images load on that first touch
  - an up-and-down swipe on a photo scrolls the page, not the row
  - the badge and "+" stay on top, and a swipe can start on the badge
  - picking a colour goes back to the first slide, now that colour
  - the "+" opens quick add; a tap on the photo opens the product, with the picked colour
- **Everywhere:** no JS errors.

The swipes in the tests are real touch drags through Chromium's input pipeline (`Input.dispatchTouchEvent`). Chromium's synthesized scroll gesture does nothing in headless mode, and the test says so.

### Results

| Suite | en | ar (right to left) |
|---|---|---|
| card-slides (new) | 158/158, both languages in one run | |
| schema, liquid-logic, pdp-sticky-sympl | 6/6, 15/15, 47/47 | |
| header | 210/210 | 210/210 |
| collection | 293/293 | 293/293 |
| product | 183/183 | 183/183 |
| cart | 73/73 | 73/73 |
| home | 349/349 | 349/349 |
| a11y (axe-core WCAG 2.2 AA) | 78/78 | 78/78 |
| seo | 51/51 | 51/51 |
| rtl (both languages) | 29/29 | |
| perf | 18/18 | 18/18 |
| regression | 50/50 | 50/50 |
| quick-add | 224/224, both languages | |
| color-photos | 236/236, both languages | |

- **Two Stage 4 checks updated** in `tests/collection.test.js`. They were written for Dawn's second-photo hover, which the slideshow replaces. They keep their intent:
  - A hover brings up the product's second photo; it now comes in at 800ms.
  - A picked colour keeps its photo while hovered; now no slide plays over it.
- **Theme Check:** 23 warnings, unchanged; none from this change.
- **Visual QA:** in the test harness only, with placeholder photos, not on the real store. Screenshots checked:
  - 1280px mid-slideshow: the badge and "+" on top
  - 390px after a swipe, in English and Arabic

## Manual checks on the preview

- **Desktop:** hover a few cards on a collection page; leave and re-enter; click a card while it plays; use the "+".
- **On a phone:** swipe a card's photos, scroll the page up and down starting on a photo, and tap a photo.
- **Real photos:** check the fades look right with the store's actual images.

## Rollback

- **In the editor:** switch off "Dressar: photo slideshow".
- **In code:** revert this commit.
