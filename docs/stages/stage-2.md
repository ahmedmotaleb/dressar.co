# Stage 2: P0 fixes

Applied to the dev theme `#167837270247` only. Live is untouched.

## Setup done in the store (Admin API)

| Item | Result |
|---|---|
| Dev theme | `#167837270247`, duplicated from live and unpublished |
| Metafield | `custom.model_size` on products ("مقاس الموديل \| Model size"), pinned on the product page, choices M / L / XL / XXL / 3XL |

## Changes

| Finding | Files | What changed |
|---|---|---|
| F22 broken sale badge | `snippets/card-product.liquid`, `snippets/price.liquid` | Valid markup again. The % comes from `card_product` (lowest price vs lowest compare-at, as printed on the card) and is floored. It shows only when compare-at > price and the markdown is at least 1%. The PDP badge also floors now, so card and PDP agree. |
| F24 two sticky ATC bars | `assets/product-form.js` (back to stock Dawn), `sections/dsr-product-boost.liquid` | One bar. It covers phones **and tablets** (< 990 px), hides while a drawer or modal is open (it used to sit over the full-screen photo viewer), is unfocusable while off-screen, and greys out on sold-out variants. Its label comes from locales. |
| F25 Sympl empty price | `snippets/sympl-widget.liquid` (new), `sections/main-product.liquid`, `snippets/cart-drawer.liquid`, `sections/main-cart-footer.liquid`, `layout/theme.liquid`, `templates/product.json` | One snippet with real amounts: plain decimals like `1149.0`, because this shop's money format prints "1,149". The script loads once. The PDP amount follows the selected variant. The cart and drawer re-render with the total. Settings: Theme settings → Dressar → Sympl. |
| WhatsApp number | `snippets/whatsapp-button.liquid`, `config/settings_schema.json`, locales | +201020676173 is now a theme setting (number, on/off, left/right). The copy moved to `dressar.whatsapp.*` strings. |
| F26 "model wears L" on every product | `templates/product.json`, `snippets/dsr-model-size.liquid` (new) | Reads `custom.model_size`. Renders nothing when empty. |
| F15 collection 50-product cap | `blocks/ai_gen_block_8ec498c.liquid` | Server-side `paginate` with Dawn's pagination links. Stop-gap until the Stage 4 collection page. |

New strings live under `dressar.*` in `locales/en.default.json` and `locales/ar.json`, in Arabic in both for now. The language stage moves real English into `en.default.json`.

## Tests

| Check | Result |
|---|---|
| Theme Check vs Stage 1 baseline | Resolved: `LiquidHTMLSyntaxError` (badge), `UndefinedObject` ×2 (`cartTotalAmount`), `RemoteAsset` ×2. New: one intentional `RemoteAsset` (single Sympl script), one `OrphanedSnippet` (rendered from template JSON, invisible to Theme Check), and 180 `MatchingTranslations` for the new strings in 30 unpublished languages (they fall back to the default). |
| `tests/liquid-logic.test.js` | 10/10. Sympl amount, cart/PDP attributes, off/empty/zero cases, model size set/empty, badge maths (52% floor, < 1% fallback, ignores page `product`). |
| `tests/pdp-sticky-sympl.test.js` (Chromium, 360/390/430/768/1280 px) | 45/45. The same test on the untouched live code: 25/45 (duplicate bar at every width, dialog overlap, tablet gap, sold-out state, Sympl stuck on the first variant). |
| Dev theme sync | 320 code files + 16 changed files byte-identical. 15 non-locale JSON semantically identical. |

## Not verified (needs a browser on the dev theme preview)

- The Sympl widget really renders instalments from `productprice="1149.0"` (its script is blocked in this environment). OLD DRESSAR used the same attributes with `money_without_currency`.
- Final look of the badge and sticky bar on real pages, and the Judge.me review widget's `sample_data` setting (F27).
- Whether the Whatflow app embed also shows a floating WhatsApp button. If it does, turn one off (Theme settings → Dressar, or App embeds).

## Manual steps for the merchant

- Fill **Model size** on products. Products → Bulk edit → add column "مقاس الموديل | Model size". Until filled, the line is hidden.
- **Sympl at checkout** is a payment method, not a theme feature: Settings → Payments → add Sympl (via Sympl's Shopify payment app). No recent order used Sympl; the last 50 were Cash on Delivery or Paymob.
- Collection page: this stop-gap shows 16 products per page (the block's "Products per page" setting).

## Risks

- `main-product.liquid` and `cart-drawer.liquid` are Dawn files with one-line additions. Re-apply them after a future Dawn update.
- Sympl's widget may expect another price format. If instalments look wrong on the preview, only `snippets/sympl-widget.liquid` needs changing.
