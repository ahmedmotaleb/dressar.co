# Dev theme and sync

| | |
|---|---|
| Live theme (never written) | `#167717929191` "Updated copy of DRESSAR — Sales Optimized (DRAFT for review)" |
| Dev theme | `#167837270247` "DRESSAR DEV (Claude) — from live 2026-10-26", unpublished, duplicated from live on 2026-10-26 |
| Last synced commit | `049423e` (Stage 4: collection page and product cards) |
| Sync check | The 53 Stage 4 files are byte-identical to the commit (MD5), except `config/settings_data.json`, which Shopify re-serialises; its changed values (sale badge colour scheme, badge radius) were checked in the dev theme's copy. The dev theme had not been edited since the previous sync. Live theme `updatedAt` unchanged (2026-10-26 18:16 UTC). |

Sync history:

| Commit | Files | Date |
|---|---|---|
| `33ecaf7` | Stage 2 + locale files (full-theme parity check) | 2026-10-26 |
| `8ef021d` | Stage 3: `assets/dsr-header.css`, `snippets/dsr-menu-view-all.liquid`, `sections/header.liquid`, `sections/header-group.json`, `snippets/header-dropdown-menu.liquid`, `snippets/header-drawer.liquid`, `sections/predictive-search.liquid`, `sections/dsr-product-boost.liquid`, `snippets/whatsapp-button.liquid` | 2026-10-26 |
| `049423e` | Stage 4: 21 theme files (cards, collection, swatch CSS, settings, templates) and 32 locale files | 2026-10-26 |

## How changes reach the dev theme today

1. Commit and push to `claude/dressar-theme-audit-7xbdeb`.
2. Upload the changed files to the dev theme with the Admin API `themeFilesUpsert`, using `URL` bodies that point at `raw.githubusercontent.com/…/<commit>/<file>`. Shopify fetches the exact committed bytes, so nothing is retyped.
3. Re-read the dev theme's checksums and compare them with the repo.

Shopify's Admin API refuses theme-file writes to the published theme, so this route can't touch live.

## Connecting the repo with Shopify's GitHub integration (one-time, in Shopify admin)

1. Online Store → Themes → **Add theme → Connect from GitHub**. Install or authorise the Shopify GitHub app for `ahmedmotaleb/dressar.co` if asked.
2. Repository `dressar.co`, branch **`claude/dressar-theme-audit-7xbdeb`**.
3. Shopify creates a new theme from that branch. From then on every push syncs automatically, and edits made in the theme editor are committed back to the branch by Shopify.

Folders outside the theme structure (`docs/`, `tests/`) are ignored by the integration.

Once connected, the connected theme becomes the dev theme and `#167837270247` can be deleted.
