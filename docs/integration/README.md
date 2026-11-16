# Integration and preview: recovery report (Nov 16)

Task: "Dressar.co — Claude Recovery & Preview Deployment Task". All storefront work is brought into one branch and one unpublished preview theme, ready for merchant review.

**Nothing is merged or published. The live theme was only read, never written.**

## Where to look

| | |
|---|---|
| Repository | `ahmedmotaleb/dressar.co` |
| Integration branch | `claude/dressar-integration` (base: `claude/dressar-2s-card-pdp-redesign`, PR #3) |
| Live theme | `#168399831271` "DRESSAR PREVIEW (Claude) — 2S redesign 2026-11-13", published by the store on Nov 15. Read only. |
| **Preview theme** | **`#168455471335` "DRESSAR PREVIEW (Claude) — Nov 15 design briefs"**, unpublished |
| Preview, Arabic | https://dnx31m-mi.myshopify.com/ar/?preview_theme_id=168455471335 |
| Preview, English | https://dnx31m-mi.myshopify.com/?preview_theme_id=168455471335 |
| Collection | https://dnx31m-mi.myshopify.com/ar/collections/white-friday-sale?preview_theme_id=168455471335 |
| Product | https://dnx31m-mi.myshopify.com/ar/products/joubert-skirt-with-lining?preview_theme_id=168455471335 |

### Other themes
- `#168454979815` (Video Stories only) is superseded by `#168455471335`.
- `#167837270247` and `#168303165671` are older previews.
- None of them is used here. Shopify's connector can't delete themes, so they are left in place.

## Audit (Phase A)

### Branches (Nov 16)
- **History is linear:**
  - `main` (`cefb810`)
  - → `claude/dressar-theme-audit-7xbdeb` (`d835d09`, PR #1)
  - → `claude/dressar-2s-card-pdp-redesign` (`2398cd9`, PR #3)
  - → five feature branches, each started from `2398cd9`.
- **Nothing is merged into `main`.**
- **Feature branches and PRs:**
  - `claude/dressar-heading-typography` (PR #6)
  - `claude/dressar-store-benefits` (PR #7)
  - `claude/dressar-collection-header` (PR #8)
  - `claude/dressar-editorial-mosaic` (PR #5)
  - `claude/dressar-video-stories` (PR #4)

### Live theme
- **Code:** layout, snippets and language files are identical to PR #3's code (`2398cd9`).
- **Store-owned JSON differs:**
  - home template: hero slide, row settings, Complete Looks on the winter collection, reviews moved up, six switched-off AI sections removed;
  - collection template;
  - footer About text;
  - two theme settings: sale badge top right, sizes on cards.

### Unused leftovers
19 unused files remain on both themes:
- 6 `assets/dressar-*` files;
- 13 old AI blocks.

They were removed in Stage 9, but Shopify's connector can't delete files. Nothing references them.

## Integration (Phase C.1)

**Merges:** the five feature branches, in this order: headings, benefits, collection header, mosaic, video stories.

### Conflicts resolved
| File | Conflict | Resolution |
|---|---|---|
| `tests/package.json` | each branch appends its test | all 26 test files kept |
| `sections/collection-list.liquid` | headings and mosaic both add settings after "Heading size" | both kept: heading alignment, then the mosaic settings |

### Reconciled with the live store
**Not overwriting newer work:** the repo's copies of the store's own settings were older than live. They now match live exactly:
- `templates/index.json`
- `templates/collection.json`
- `sections/footer-group.json`
- `config/settings_data.json`

**The only intended template change:** in the home template, Video Stories replaces the AI "Dressar Signature" video block (same four videos, same heading). The old block stays in the template, switched off.

### Fixes found during integration
- **Duplicate scripts:** `quick-add.js` and `product-form.js` loaded twice on the home and collection pages. This happens with the store's settings, and also on live today. The sections now skip them when the layout already loads them.
- **Stray symlink:** a stray `tests/node_modules` symlink was removed from four feature branches. The ignore rule now covers links.

**Theme files changed against PR #3:**
- 22 theme files, plus 32 language files (Video Stories text).
- The integration branch is the source of truth for the preview. Every code file on the preview matches it exactly, and the JSON files match by content.

## Feature matrix

| Feature | Branch | Code | On the preview | QA |
|---|---|---|---|---|
| Product card V2: one-line title, `38%` badge, colours, sizes, bag quick add | #3 (already live) | ✓ | ✓ | `card-upgrade` 820, `quick-add` 280, real preview `preview-cards.check` 152/152 |
| Product page: "اعرف مقاسك", SKU, no quantity selector, one sticky add-to-cart | #3 (already live) | ✓ | ✓ | `pdp-ux` 175, `pdp-selectors` 153, real preview ✓ |
| Collection section headings (Cairo 600, 26/34px) | #6 | ✓ | ✓ | 131 tests, real preview ✓ |
| Store benefits, 2×2 mobile cards | #7 | ✓ | ✓ | 119 tests, real preview ✓ |
| Compact mobile collection header | #8 | ✓ | ✓ | 133 tests, real preview ✓ (first product at 310px, was 437px) |
| Editorial mosaic categories | #5 | ✓ | ✓ (home, 4th section) | 200 tests, real preview ✓ |
| Video Stories (2S layout) on the home page | #4 | ✓ | ✓ (in place of "Dressar Signature") | 262 tests, real preview ✓ (one muted video plays when in view) |

## Tests

**Automated:**
- **English:** 26 test files, 4,421/4,421 checks.
- **Arabic:** the 9 suites that run per language (header, collection, product, cart, home, a11y, seo, perf, regression): 1,319/1,319.

**Coverage includes:**
- single-colour, multi-colour and missing-colour products;
- sold out, varying discounts, quick add, cart drawer, search, collection pagination;
- product variants, sticky cart, videos, and theme-editor settings (as template data).

**Theme Check:** 25 offences.
- 23 are the old baseline.
- 2 are "OrphanedSnippet" suggestions for the benefits snippets, which are used from `blocks/`; that check doesn't scan there.

**On the real preview:**
- **Card and variant checks:** `tests/preview-cards.check.js` 152/152.
- **Page check:** a browser check on the home, White Friday collection and product pages, Arabic and English, at 320, 360, 375, 390, 430, 768, 1024 and 1440px: 232/234.
- **The two failures:** both are one script error, "reading 'offsetLeft'" in Dawn's slider (`global.js`). It appears on Arabic pages when screenshots scroll sections into view. **The same error happens on the live theme**, so it predates this work (follow-up below).

## Screenshots

Before (live theme) and after (preview), using the store's real images, at 390 and 1440px in Arabic and English: `docs/integration/shots/`.

| Shot | What it shows |
|---|---|
| `*-home-top-*` | Top of the home page |
| `*-heading-*` | White Friday row heading |
| `*-mosaic-*` | Categories |
| `*-videos-*` | "Dressar Signature" videos, then Video Stories |
| `*-benefits-*` | Store benefits |
| `*-collection-*` | White Friday collection |
| `*-product-*` | Product page (unchanged; it is already live) |

## Open decisions and follow-ups

1. **Quick-add button.** The recovery brief asks for a `+` at 30px on mobile and 34px on desktop. The Compact V2 brief of Nov 14 asked for a 32px bag icon, which is built and live. Kept as is; please choose.
2. **Translation.** On the Arabic page the new Video Stories heading shows "Dressar Signature" in English. Its translation ("توقيع دريسار" on the old block) needs adding for the new section in Translate & Adapt.
3. **Arabic copy.** Some Arabic-page copy comes through in English from the store's saved translations (benefit cards, category heading). This was already the case before.
4. **Slider error.** The Dawn slider error on Arabic pages ("offsetLeft") is pre-existing and needs its own fix.
5. **Not verified here:**
   - real phones (only Chromium with phone emulation);
   - the real theme editor (add, remove and reorder tested as template data);
   - checkout.
6. **Publishing:** only with your approval. Publishing `#168455471335` makes all of the above live at once. Theme `#168399831271` stays as the rollback.
