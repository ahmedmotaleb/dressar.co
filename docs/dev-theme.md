# Dev theme and sync

| | |
|---|---|
| Live theme (never written) | `#167717929191` "Updated copy of DRESSAR — Sales Optimized (DRAFT for review)" |
| Dev theme | `#167837270247` "DRESSAR DEV (Claude) — from live 2026-10-26", unpublished, duplicated from live on 2026-10-26 |
| Last synced commit | `7da521a` (Stage 6: cart, Complete the look) |
| Sync check | The 45 Stage 6 files are byte-identical to the commit (MD5). The dev theme had not been edited since the previous sync. Live theme `updatedAt` unchanged (2026-10-26 18:16 UTC). |

Sync history:

| Commit | Files | Date |
|---|---|---|
| `33ecaf7` | Stage 2 + locale files (full-theme parity check) | 2026-10-26 |
| `8ef021d` | Stage 3: `assets/dsr-header.css`, `snippets/dsr-menu-view-all.liquid`, `sections/header.liquid`, `sections/header-group.json`, `snippets/header-dropdown-menu.liquid`, `snippets/header-drawer.liquid`, `sections/predictive-search.liquid`, `sections/dsr-product-boost.liquid`, `snippets/whatsapp-button.liquid` | 2026-10-26 |
| `049423e` | Stage 4: 21 theme files (cards, collection, swatch CSS, settings, templates) and 32 locale files | 2026-10-26 |
| `135cf8f` + `97560ae` | Stage 5: product section, template, price snippet, two new snippets, `dsr-product.css`, 32 locale files | 2026-10-27 |
| `7da521a` | Stage 6: cart drawer and footer, free-shipping snippet, related products, product section and template, card snippet and CSS, layout, settings schema, 32 locale files | 2026-10-27 |

## How changes reach the dev theme today

1. Commit and push to `claude/dressar-theme-audit-7xbdeb`.
2. Upload the changed files to the dev theme with the Admin API `themeFilesUpsert`, using `URL` bodies that point at `raw.githubusercontent.com/…/<commit>/<file>`. Shopify fetches the exact committed bytes, so nothing is retyped.
3. Re-read the dev theme's checksums and compare them with the repo. **Don't trust the job status:** the upload job reports `done` even when Shopify rejected a file. In Stage 5 a section whose schema had a 27-character block name (Shopify allows 25; Theme Check doesn't flag it) was silently refused, along with the template that used its new blocks. Only the checksum comparison caught it.

Shopify's Admin API refuses theme-file writes to the published theme, so this route can't touch live.

## Connecting the repo with Shopify's GitHub integration (one-time, in Shopify admin)

1. Online Store → Themes → **Add theme → Connect from GitHub**. Install or authorise the Shopify GitHub app for `ahmedmotaleb/dressar.co` if asked.
2. Repository `dressar.co`, branch **`claude/dressar-theme-audit-7xbdeb`**.
3. Shopify creates a new theme from that branch. From then on every push syncs automatically, and edits made in the theme editor are committed back to the branch by Shopify.

Folders outside the theme structure (`docs/`, `tests/`) are ignored by the integration.

Once connected, the connected theme becomes the dev theme and `#167837270247` can be deleted.
