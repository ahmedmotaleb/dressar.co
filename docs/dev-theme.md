# Dev theme and sync

| | |
|---|---|
| **Live since 2026-11-11** | `#168303165671` "DRESSAR PREVIEW (Claude) — quick add 2026-11-10", published in Shopify admin on 2026-11-11 at 12:16 UTC (not from this branch). Its code is commit `b7da168` (card photo slideshow), checked file by file by MD5 on 2026-11-13. **Nothing is uploaded to it,** because it is live. |
| Live 2026-11-10 to 2026-11-11 (the rollback) | `#167837270247` "DRESSAR DEV (Claude) — from live 2026-10-26", unpublished again since 2026-11-11. Its code is from 2026-10-27; its `settings_data.json` and product template match the live theme's. **Kept unchanged:** republishing it returns to the 2026-11-10 store. |
| Copy made before the 2026-11-11 publish (never written) | `#168327643367` "Updated copy of DRESSAR DEV (Claude) — from liv…", created 2026-11-11 12:16:10 UTC, outside this branch. A copy of `#167837270247` with a different `settings_schema.json`. |
| Earlier live theme (never written) | `#167717929191` "Updated copy of DRESSAR — Sales Optimized (DRAFT for review)", unpublished since 2026-11-10 |
| **Preview theme (current dev theme)** | `#168399831271` "DRESSAR PREVIEW (Claude) — 2S redesign 2026-11-13", unpublished. Duplicated from the live theme on 2026-11-13 at 19:55 UTC, on the owner's go-ahead, so it carries the live theme's settings and content. Preview: `https://dnx31m-mi.myshopify.com/?preview_theme_id=168399831271` |
| Last synced commit | The 2S redesign branch `claude/dressar-2s-card-pdp-redesign` (PR #2), to `#168399831271`. See the last row of the sync history. |
| Earlier preview theme | `#168303165671`, synced up to `b7da168`, is now the live theme (above). |
| Stage 9 sync check (on `#167837270247`, then unpublished) | The 3 Stage 9 files changed in place are byte-identical to the commit (MD5). They were unedited on the dev theme since the previous syncs. **Not removed on the dev theme:** the 19 files Stage 9 deleted (13 unreferenced AI blocks, 6 `dressar-*` stubs). This connector's safety policy refuses `themeFilesDelete` on any theme. Nothing references them, so they change nothing on the storefront; the 13 blocks still appear in the editor's block picker. See "Removing the deleted files" below. The then-live theme's `updatedAt` was unchanged at that sync (2026-10-26 18:16 UTC). |

Sync history:

| Commit | Files | Date |
|---|---|---|
| `33ecaf7` | Stage 2 + locale files (full-theme parity check) | 2026-10-26 |
| `8ef021d` | Stage 3: `assets/dsr-header.css`, `snippets/dsr-menu-view-all.liquid`, `sections/header.liquid`, `sections/header-group.json`, `snippets/header-dropdown-menu.liquid`, `snippets/header-drawer.liquid`, `sections/predictive-search.liquid`, `sections/dsr-product-boost.liquid`, `snippets/whatsapp-button.liquid` | 2026-10-26 |
| `049423e` | Stage 4: 21 theme files (cards, collection, swatch CSS, settings, templates) and 32 locale files | 2026-10-26 |
| `135cf8f` + `97560ae` | Stage 5: product section, template, price snippet, two new snippets, `dsr-product.css`, 32 locale files | 2026-10-27 |
| `7da521a` | Stage 6: cart drawer and footer, free-shipping snippet, related products, product section and template, card snippet and CSS, layout, settings schema, 32 locale files | 2026-10-27 |
| `b55b350` | Stage 7: `templates/index.json`, `sections/featured-collection.liquid`, `assets/component-card.css` | 2026-10-27 |
| `2e55206` | Stage 8: 4 new files (`dsr-direction`, `dsr-breadcrumbs` snippet and CSS, `dsr-rtl.css`), Dawn JS and Liquid edits, layouts, settings schema and data, footer group, product template, 32 locale files | 2026-10-27 |
| `427724e` | Stage 9: `assets/component-card.css`, `sections/footer-group.json`, `templates/collection.json` (19 deletions not applied, see below) | 2026-10-27 |
| `c6e59b1` | Quick add, to the **preview theme `#168303165671`** (not the live theme). Its 41 files: the new `snippets/dsr-card-quick-add.liquid`, `snippets/card-product.liquid`, `assets/dsr-card.css` and `.js`, `layout/theme.liquid`, `config/settings_schema.json`, `sections/main-product`, `main-search`, `related-products`, and 32 locale files.<br>**Checks:**<br>• Before the upload, the copy's 40 existing files matched the previous sync, so nothing edited in admin was overwritten.<br>• After it, all 41 matched the commit (MD5).<br>• Live `#167837270247` `updatedAt` stayed at 2026-11-10 12:58:34 UTC. | 2026-11-10 |
| `3678958` | Colour photo selector, to the **preview theme `#168303165671`**. Its 40 files: the new `assets/dsr-color-photos.js`, `snippets/dsr-color-photos`, `dsr-color-link` and `dsr-color-photo-tile`, plus `assets/dsr-product.css`, `sections/main-product.liquid`, `snippets/product-variant-options` and `product-variant-picker`, and 32 locale files.<br>**Checks:**<br>• Before the upload, the copy's changed files matched the previous sync, and the copy was unchanged since then.<br>• After it, all 40 matched the commit (MD5).<br>**Store data:** the product metafield definition `custom.color_products` ("ألوان أخرى \| Other colours", list of products, pinned) was created for it; no product values were set.<br>**Live theme:** not written. Its `templates/index.json` (homepage) was edited at 2026-11-10 19:29 UTC, outside this branch, after the preview copy was taken at 19:06. So that homepage edit isn't on the preview. | 2026-11-10 |
| `e38e325` + `b7da168` | Colour selector limited to the product page, and the collection cards' photo slideshow, to the **preview theme `#168303165671`**. 9 files: the new `assets/dsr-card-slides.js` and `snippets/dsr-card-slides.liquid`, plus `assets/dsr-card.css`, `assets/dsr-color-photos.js`, `assets/dsr-product.css`, `layout/theme.liquid`, `snippets/product-variant-picker.liquid`, `snippets/card-product.liquid` and `sections/main-collection-product-grid.liquid`.<br>**Checks:**<br>• Before the upload, the copy's 7 existing files matched the previous sync, and the copy was unchanged since then (19:44 UTC).<br>• After it, all 9 matched `b7da168` (MD5).<br>• The live theme's `updatedAt` stayed at 19:29 UTC. | 2026-11-10 |
| `55507c3` + `d8a182f` | 2S product grid and product page redesign (PR #2), to the **new preview theme `#168399831271`**, a copy of the live theme made on 2026-11-13 at 19:55 UTC. 49 files: the new `snippets/dsr-card-options.liquid` and `dsr-card-rating.liquid`, `assets/dsr-card.css` and `.js`, `dsr-product.css`, `dsr-collection.css`, `config/settings_schema.json`, `layout/theme.liquid`, `sections/dsr-product-boost.liquid` and `main-collection-banner.liquid`, 7 card and picker snippets, `templates/product.json`, and 32 locale files. This includes the commits between `b7da168` and the redesign (card rows `7cd92b5`, and the owner's collection banner alignment).<br>**Checks:**<br>• Before the upload, the copy's 46 existing code and locale files matched `b7da168`, so nothing edited in admin was overwritten.<br>• The product template was the merchant's own version. Compared as JSON with the repo's, it had two merchant edits (SKU block on; empty "Complete the look" fallback heading). These were carried into the repo in `d8a182f` before the upload, so only the block order changed.<br>• After the upload, all 49 files matched the commits (MD5).<br>• The live theme `#168303165671` stayed published, with `updatedAt` unchanged at 2026-11-11 12:16:46 UTC. | 2026-11-13 |
| `5e7af47` + `fb1f156` + `3119143` | Product page colour chips and size buttons, Cairo for Arabic, the card restyled after the "Collection grid product" image, and the slideshow broken-image fix. To the **preview theme `#168399831271`**. 40 files: the new `assets/dsr-cairo-arabic.woff2`, `assets/dsr-card.css`, `dsr-product.css`, `config/settings_schema.json`, `layout/theme.liquid`, `snippets/dsr-card-sizes.liquid` and `dsr-card-swatches.liquid`, `templates/product.json` (colour photos off on the variant picker, as the merchant chose), and 32 locale files.<br>**Checks:**<br>• Before the upload, the copy's 39 existing files matched the previous sync (`d8a182f`), so nothing edited in admin was overwritten.<br>• After it, all 40 matched `3119143` (MD5), the font file included.<br>• The live theme `#168303165671` stayed published, with `updatedAt` unchanged at 2026-11-11 12:16:46 UTC.<br>**Not on the live theme:** the slideshow fix (`5e7af47`). It is a commit of its own, so it can go live without the rest. | 2026-11-13 |

## How changes reach the dev theme today

1. Commit and push to `claude/dressar-theme-audit-7xbdeb`.
2. Upload the changed files to the dev theme with the Admin API `themeFilesUpsert`, using `URL` bodies that point at `raw.githubusercontent.com/…/<commit>/<file>`. Shopify fetches the exact committed bytes, so nothing is retyped.
3. Re-read the dev theme's checksums and compare them with the repo (`config/settings_data.json` by content: Shopify re-saves it). **Don't trust the job status:** the upload job reports `done` even when Shopify rejected a file. In Stage 5 a section whose schema had a 27-character block name (Shopify allows 25; Theme Check doesn't flag it) was silently refused, along with the template that used its new blocks. Only the checksum comparison caught it.

Shopify's Admin API refuses theme-file writes to the published theme, so this route can't touch live.

## Connecting the repo with Shopify's GitHub integration (one-time, in Shopify admin)

1. Online Store → Themes → **Add theme → Connect from GitHub**. Install or authorise the Shopify GitHub app for `ahmedmotaleb/dressar.co` if asked.
2. Repository `dressar.co`, branch **`claude/dressar-theme-audit-7xbdeb`**.
3. Shopify creates a new theme from that branch. From then on every push syncs automatically, and edits made in the theme editor are committed back to the branch by Shopify.

Folders outside the theme structure (`docs/`, `tests/`) are ignored by the integration.

Once connected, the connected theme becomes the dev theme. **Don't delete `#167837270247`:** it has been the live theme since 2026-11-10.

## Removing the deleted files from the dev theme

Stage 9 deleted 19 unused files from the branch. The dev theme still holds them, because this environment can't delete theme files. Any of these removes them:

- **Connect the branch** with Shopify's GitHub integration (above). The connected theme contains exactly the branch, so the files are gone.
- **By hand, on `#167837270247` (the live theme since 2026-11-10, so this edits the storefront directly; unused files, so nothing visible changes):** Online Store → Themes → … → Edit code. Delete:
  - **Blocks:** `ai_gen_block_20925d5`, `22187a5`, `33a376d`, `59620d2`, `5d0c3b8`, `5e179fb`, `616f91c`, `8b981a5`, `8e2a527`, `a2450c4`, `bce2c9d`, `c87a290`, `eb40921`.
  - **Assets:** `dressar-card-link-fix.css`, `dressar-card-look.css`, `dressar-price-tightening.css`, `dressar-sticky-atc-patch.js`, `dressar-swatches.css`, `dressar-type.css`.
- **Leave them:** they are referenced nowhere and load nowhere.
