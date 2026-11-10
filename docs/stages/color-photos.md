# Colour photo selector on the product page

**Status:** on the branch and the preview theme `#168303165671` (unpublished). Not on the live theme.

## What changed

On the product page, each colour is now shown as its own product photo instead of a colour circle. This follows the H&M pattern the owner asked for. (The reference image itself did not come through with the request, so this follows its written description.)

| | |
|---|---|
| Look | 3:4 photos: 68px wide on phones, 76px from 750px. The selected colour has a thin black frame; the others have a faint one. |
| Name | The selected colour's name is above the photos ("Color: Black"). It changes as soon as a colour is chosen. |
| Phones and tablets (below 990px) | One row that scrolls sideways when the colours don't fit. The page itself never scrolls sideways. |
| Desktop (990px and up) | The photos wrap onto more rows. |
| Sold out | Faded and struck through, but still selectable (or still a link), so the colour's photos and page stay reachable. |
| Arabic | The row runs right to left and starts at the right. |

## Where the photos come from

Only real Shopify data. Nothing is invented, and nothing is guessed from product titles.

- **This product's colours:** each colour's own variant photo, from the variant for that colour and the size already chosen, else any variant of that colour that has one.
- **A colour without a photo:** its colour tile from Shopify's colour data (the swatch the circles used), or its name if it has neither.
- **A product whose variants have no photos and no linked colours:** keeps Dawn's colour circles.

## Colours sold as separate products

Many DRESSAR styles are separate products per colour. For example, the black, wine, navy, beige, dark green, brown and baby blue "pocket maxi skirt" are seven products. The theme can't tell which products belong together, so the merchant links them.

**Admin → Products → (a product) → Metafields → "ألوان أخرى | Other colours"** (`custom.color_products`, a list of products). It was created for this change and is pinned on the product page. It is empty until products are added.

- **Add the same list, in the same order, on each product of the group.** The product's own entry may be in the list; its colours then keep that place. If it isn't listed, its own colours come first.
- **Linked products show as links** with their own photo:
  - A linked product with one colour links to its page.
  - A linked product with several colours gives one link per colour. Each link goes to that colour's first in-stock variant, with `pick=color`, so its page still asks for a size.
  - A linked product with no colour option shows its main photo, named by its Color category metafield, or else its title.
- **Sold-out linked products** are faded and struck through, and stay links.
- **A product with no colour option but with linked colours** gets the row on its own: "Colour" / "اللون", its own photo selected, and the linked products.

## How it works

The product's own colours are still Dawn's radio inputs, inside Dawn's `variant-selects`. Choosing one runs Dawn's normal variant change (`product-info.js`), so all of these follow as before:
- the variant
- price and the sale badge
- the sizes in stock for that colour
- the add-to-cart button (sold out or not)
- the main photo
- the URL (`?variant=`)
- the sticky add-to-cart bar
- the Sympl instalment widget

Nothing of Dawn's is replaced. Only the colour labels look different. The same selector shows in the quick-add dialog, which uses the product page's section.

| File | Change |
|---|---|
| `snippets/product-variant-picker.liquid` (Dawn) | Finds the colour option: the one Dawn shows as swatches, or, when other colours are linked, the option those products use for colour. Shows the photo row there, or on its own when there is no colour option. |
| `snippets/product-variant-options.liquid` (Dawn) | New picker type `dsr_photo`: Dawn's own radio input (same IDs, names and data), with the colour's photo as its label |
| `snippets/dsr-color-photos.liquid` (new) | The row: heading with the selected name, this product's colours and the linked products in the metafield's order |
| `snippets/dsr-color-link.liquid` (new) | One linked product's colour links |
| `snippets/dsr-color-photo-tile.liquid` (new) | The picture: photo, colour tile or name |
| `assets/dsr-color-photos.js` (new) | Keeps the row's scroll position, and the selected colour in view, when Dawn redraws the picker after a choice |
| `assets/dsr-product.css` | Styles |
| `sections/main-product.liquid` (Dawn) | Loads the script. New variant picker setting **"Dressar: colour photos"** (on); switch it off to get Dawn's circles back. |
| `locales/*.json` | `dressar.product.colour` ("Colour" / "اللون") for the row without a colour option |

## Found on the way

**The hidden radio inputs scrolled the row back to its start.** Dawn hides each option's radio input with `position: absolute`. In a scrolling row, that put every radio at the row's start. Dawn focuses the chosen radio after each change, so the row jumped back to its first photo and the chosen colour could be out of sight. Each radio now sits inside its own photo's box.

## Tests

`tests/color-photos.test.js` (new), 232 checks: English at 360, 390, 430, 768, 1280 and 1440 px, Arabic at 390 and 1280.

- **Several colours:**
  - one selector, no circles, the colour row first
  - one photo per colour, each that colour's own variant photo
  - 68 or 76px wide, 3:4
  - the name above, the frames
  - the sold-out colour faded and struck through
  - row scrolls (below 990) or wraps (990 and up); no sideways page scroll; direction follows the language
- **Seven colours:** the row scrolls, not the page. After choosing the last colour, it is selected and fully in view.
- **Choosing a colour:**
  - the URL names the variant (same size as before), the main photo, price and Sympl follow, and the sizes in stock follow
  - a sold-out colour is still selectable, and add to cart then says sold out
- **Keyboard:** Tab reaches the colours with a focus ring; arrow keys choose the next colour and focus stays on it.
- **Linked products:**
  - the metafield's order with this product in its place
  - links to one-colour products, one link per colour (with `pick=color`) for several-colour products
  - sold-out linked products marked, and the row scrolls
  - following a link opens that product on that colour, and the sticky bar still asks for a size
- **Edge cases:**
  - one colour
  - missing photos (colour tile, or the name)
  - no variant photos (Dawn's circles stay)
  - no colour option with linked products (row on its own)
- **Accessibility:** axe finds nothing in the picker on three product pages, and every photo is named by its colour.
- **Quick-add dialog:** shows the photos, and choosing one works.

Existing suites are unchanged and pass in both languages.

### Results

| Suite | en | ar (right to left) |
|---|---|---|
| color-photos (new) | 232/232, both languages in one run | |
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

- **Theme Check:** 23 warnings, unchanged; none from this change.
- **Visual QA:** in the test harness only, with placeholder photos, not on the real store. Screenshots checked:
  - 390px in English and Arabic: several colours, and linked colours
  - 390px with missing photos
  - 1280px in English (linked colours) and Arabic

## Manual checks on the preview

- **Real photos:** on a product with several colours (e.g. "Linen Skirt with Front Pockets"), check that each photo shows its colour.
- **Linking:** link one group, e.g. the pocket skirts, in the "Other colours" metafield, then open one of them.
- **On a phone:** swipe the row, choose colours, then check the sizes, price, Sympl and the sticky bar.
- **In Arabic (`/ar/`):** the row starts at the right.

## Rollback

- **In the editor:** Product page → Variant picker → switch off "Dressar: colour photos".
- **In code:** revert this commit. The metafield definition can stay, or be deleted in Settings → Custom data → Products.
