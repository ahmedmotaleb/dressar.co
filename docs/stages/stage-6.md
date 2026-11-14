# Stage 6: cart, Complete the Look, WhatsApp

## 1. Approach

Dawn's cart stays as it is: drawer and page, line items, quantity, remove, discounts, totals, note, checkout, focus trap. Stage 2's Sympl widget in the drawer and on the cart page is unchanged.

Stage 6 replaces the custom free-shipping bar with a settings-driven one rendered in Liquid. It turns "Complete the look" into complementary-first recommendations with an honest fallback, and confirms there is only one floating WhatsApp button.

## 2. Free-shipping progress

**Before** (`assets/cart-drawer.js`, a DRESSAR block appended to Dawn's file):
- **Hard-coded:** a 1500 EGP threshold and Arabic copy with emojis inside the JavaScript.
- **Extra request:** `/cart.js` was fetched on every page load, drawer closed or not (audit F32).
- **Bug:** changing a quantity inside the drawer re-renders its contents, which wiped the bar until the drawer was reopened.
- **No `aria-live`.**

**Now** (`snippets/dsr-free-shipping.liquid`):
- **Rendered from the cart in Liquid.** It is part of every drawer and cart-page re-render Dawn already does (add, quantity, remove) and needs no request of its own. `cart-drawer.js` is stock Dawn again.
- **Threshold and on/off** come from Theme settings → Dressar → Free shipping ("Free shipping from (EGP)", default 1500).
- **The same setting drives the line under the product price:** "Free shipping on orders from 1,500 ج.م. Shipping details". The Arabic locale used to hard-code "شحن مجاني للطلبات من 1500 جنيه" there (audit F07). That string is now a neutral translation of Dawn's "Shipping calculated at checkout", used when the offer is off.
- **What it measures:** the subtotal after product discounts (`cart.items_subtotal_price`), the amount Shopify's free-shipping discounts check.
- **Copy:** from locale strings.
  - "You're **1,251 ج.م** away from free shipping" / "فاضلك **1,251 ج.م** والشحن يبقى مجاني"
  - "Your order ships free" / "تمام! الشحن مجاني على طلبك"
- **Accessibility:** a `role="status"` region, so the change is announced. The track is decorative; the sentence says it.
- **Empty cart, or offer off:** nothing.

**The bar repeats an offer; it doesn't create one.** The live offer is the automatic discount "شحن مجاني White Friday" (≥ 1500 EGP, no end date). When that discount changes or ends, change or switch off the setting. Base shipping is a flat 85 / 100 EGP.

## 3. Complete the look

`sections/related-products.liquid` (Dawn) gets a "Products shown" setting:

| Option | Behaviour |
|---|---|
| **Complementary, then related** (set on the product template) | Asks for complementary products (Search & Discovery → Recommendations → Complementary). If the product has none, asks for Shopify's related products and shows them under their own heading, "You may also like" / "ممكن يعجبك كمان" (editable). Related items are never presented as "completing the look". |
| Complementary only | Shows nothing when there are none (Dawn's behaviour for empty recommendations) |
| Related only | Dawn's original behaviour (the section default, so other templates are unchanged) |

- **Fallback mechanism:** `assets/dsr-recommendations.js` (1.5 KB) extends Dawn's `ProductRecommendations` element (from `global.js`, unchanged) with this one fallback.
- **No hard-coded product IDs:** the products come from Shopify's recommendation API.
- **Cards** are the Stage 4 DRESSAR card at 3:4.
- **Data today:** only 2 products have complementary products filled in, so most product pages will show the related fallback until the merchant fills them in. That is the main merchant action for this stage.

## 4. WhatsApp

Two candidates for a floating button:
- `snippets/whatsapp-button.liquid`: the theme's own, number in Theme settings → Dressar.
- The Whatflow "WhatsApp chat button" app embed.

The Whatflow embed is enabled, but its settings hide it on both desktop and mobile (`hide_on_desktop: true`, `hide_on_mobile: true` in `config/settings_data.json`). So the storefront shows **one** floating WhatsApp entry point, the theme's. Nothing was changed.

If the merchant prefers Whatflow's button, turn off "Show floating WhatsApp button" in Theme settings → Dressar, then switch Whatflow's visibility on in its embed settings.

## 5. Fixes found while testing

- **Swatches unstyled outside collection and search pages.** Dawn loads `component-swatch.css` only with the filters or the product form, so the Stage 4 swatches in Complete the look (and any featured-collection grid) had no colour. The card now loads it with its own styles.
- **Card prices at 26 px on product pages.** A DRESSAR rule in `component-card.css` styled every price under `main[data-template='product']`, recommendation cards included. It now targets only the product's own price (`.product__info-container .price--large`).
- **Schema name limit.** `tests/schema.test.js` (new) checks schema names (≤ 25 characters, Shopify's upload limit), unique setting IDs, select defaults, and that template blocks exist in their sections. Stage 5's upload problem would now be caught locally.

## 6. Files

| File | Change |
|---|---|
| `snippets/dsr-free-shipping.liquid` (new) | The progress bar |
| `assets/dsr-cart.css` (new) | Its styles (loaded with the drawer's CSS and on the cart page) |
| `snippets/cart-drawer.liquid` (Dawn) | Renders the bar under the drawer header |
| `sections/main-cart-footer.liquid` (Dawn) | Renders the bar in the totals; loads `dsr-cart.css` |
| `assets/cart-drawer.js` | Back to stock Dawn (the DRESSAR bar code removed) |
| `layout/theme.liquid` | Loads `dsr-cart.css` with the drawer's styles |
| `sections/main-product.liquid` (Dawn) | Free-shipping line under the price from the settings |
| `sections/related-products.liquid` (Dawn) | "Products shown" and fallback-heading settings; complementary URL with related fallback; `dsr-recommendations` element |
| `assets/dsr-recommendations.js` (new) | The fallback |
| `templates/product.json` | Complete the look: "Complementary, then related", 3:4 cards |
| `snippets/card-product.liquid` | Loads `component-swatch.css` with the card |
| `assets/component-card.css` | PDP price rule scoped to the product's own price |
| `config/settings_schema.json` | Theme settings → Dressar → Free shipping |
| `locales/*.json` | `dressar.free_shipping.*`, `dressar.recommendations.fallback_heading`; Arabic `shipping_policy_html` neutral again |

## 7. Tests and results

| Suite | `en.default` | `ar` |
|---|---|---|
| `cart.test.js` (new) | 73 / 73 | 73 / 73 |
| `schema.test.js` (new, static) | 5 / 5 | |
| `product.test.js` (+ product price size) | 183 / 183 | 183 / 183 |
| `collection.test.js` | 293 / 293 | 293 / 293 |
| `header.test.js` | 210 / 210 | 210 / 210 |
| `liquid-logic.test.js` | 15 / 15 | |
| `pdp-sticky-sympl.test.js` | 47 / 47 | |

`cart.test.js` checks, at 360/390/430/768/990/1280/1440 px:
- **Page load:** no cart request.
- **Drawer:**
  - the bar reads "1,251 ج.م away" at 16%, as a status region, inside the viewport
  - Sympl gets the cart total
- **Quantity 7 through Dawn's own `cart.js`:** the bar stays, now "ships free" at 100%. This was the old bug.
- **Removing the last line:** no bar.
- **No JS errors.**

Plus:
- **Add to cart from a product form:** the drawer opens with the updated bar (1,038 → "462 away", 69%).
- **Setting off:** no bar.
- **Cart page:** the same bar inside the re-rendered totals.
- **Product page line:** from the settings, with a link to the shipping policy; with the offer off, Dawn's neutral line; the Arabic locale no longer hard-codes 1500.
- **Complete the look (390 and 1280 px):**
  - a product with complementary products shows exactly those under the merchant's heading
  - a product without asks complementary, then related, and shows 4 related products (not itself) under "You may also like"
  - 3:4 cards, card-sized prices, styled swatches, no JS errors
- **WhatsApp:** the app button is hidden on both devices and the theme button is on.

**Theme Check:** 30 offenses, all warnings, identical to Stage 5; none new.

**Visual QA:** the cart drawer at 390 px and Complete the look at 1280 px, **in the test harness**. The real storefront, the Sympl script and Judge.me's cart widget could not be loaded from this environment.

## 8. Manual checks and merchant actions

1. **Search & Discovery → Recommendations:** add complementary products ("Complete the look") to the main products. Until then, most product pages show "You may also like".
2. **Free shipping:** keep Theme settings → Dressar → Free shipping in step with the automatic discount. If the White Friday discount ends, switch the setting off. The announcement bar's "1500" text is merchant content: edit it in the header group.
3. **On the preview:**
   - add a product, change the quantity in the drawer, remove it, and watch the bar
   - check the Sympl widget and Judge.me's cart widget in the drawer
   - check that only one WhatsApp button shows

## 9. Risks

- **The bar is a promise in the theme.** If the discount and the setting disagree, the cart says something checkout won't honour. The setting's help text says so.
- **Currency:** the threshold is in EGP. With another market currency the bar would compare against the converted subtotal (today the store sells to Egypt only).
- **Dawn updates:** `cart-drawer.liquid`, `main-cart-footer.liquid`, `related-products.liquid` and `main-product.liquid` carry small, marked edits. `cart-drawer.js` is stock again, which makes updates easier.
- **Rollback:** switch the bar off in settings; set Complete the look to "Related only"; or revert this commit.

## 10. Widths tested

360, 390, 430, 768, 990, 1280, 1440 px (Complete the look at 390 and 1280), in `en.default` and `ar`.
