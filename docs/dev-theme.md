# Dev theme and sync

| | |
|---|---|
| Live theme (never written) | `#167717929191` "Updated copy of DRESSAR — Sales Optimized (DRAFT for review)" |
| Dev theme | `#167837270247` "DRESSAR DEV (Claude) — from live 2026-10-26", unpublished, duplicated from live on 2026-10-26 |
| Last synced commit | `427724e` (Stage 9: release candidate) |
| Sync check | The 3 Stage 9 files changed in place are byte-identical to the commit (MD5). They were unedited on the dev theme since the previous syncs. **Not removed on the dev theme:** the 19 files Stage 9 deleted (13 unreferenced AI blocks, 6 `dressar-*` stubs). This connector's safety policy refuses `themeFilesDelete` on any theme. Nothing references them, so they change nothing on the storefront; the 13 blocks still appear in the editor's block picker. See "Removing the deleted files" below. Live theme `updatedAt` unchanged (2026-10-26 18:16 UTC). |

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

Once connected, the connected theme becomes the dev theme and `#167837270247` can be deleted.

## Removing the deleted files from the dev theme

Stage 9 deleted 19 unused files from the branch. The dev theme still holds them, because this environment can't delete theme files. Any of these removes them:

- **Connect the branch** with Shopify's GitHub integration (above). The connected theme contains exactly the branch, so the files are gone.
- **By hand, on `#167837270247`:** Online Store → Themes → … → Edit code. Delete:
  - **Blocks:** `ai_gen_block_20925d5`, `22187a5`, `33a376d`, `59620d2`, `5d0c3b8`, `5e179fb`, `616f91c`, `8b981a5`, `8e2a527`, `a2450c4`, `bce2c9d`, `c87a290`, `eb40921`.
  - **Assets:** `dressar-card-link-fix.css`, `dressar-card-look.css`, `dressar-price-tightening.css`, `dressar-sticky-atc-patch.js`, `dressar-swatches.css`, `dressar-type.css`.
- **Leave them:** they are referenced nowhere and load nowhere.
