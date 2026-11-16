# Store benefits, compact mobile cards (Nov 15)

Brief: "DRESSAR — Mobile Store Benefits Redesign". The home page's benefits row is the existing "Icons with text" theme block, `blocks/ai_gen_block_c719b9a.liquid` in section `1783546806decc8eee`. It was upgraded in place; no section was added.

## Mobile (below 750px)

| | |
|---|---|
| Grid | 2 columns, equal heights in each row, 10px gap |
| Section | #F7F5F2 background, 16px padding |
| Cards | #FFFFFF, 10px corners, 12px padding, no shadow |
| Icon | 24px, centred, 8px above the title |
| Title | 13px semibold, 5px above the description |
| Description | 11px regular |
| Arabic | Cairo, like the product cards (theme setting "Cairo for Arabic") |

- **Spacing:** the block's 40px top and bottom padding is replaced by 12px margins. With the neighbouring sections' own padding, that leaves about 24px around the band.
- **Overflow:** long words wrap inside the card.

**Desktop:** unchanged. It uses the same settings as before; the selectors moved to shared class names with identical values.

## Cards: number and order

The block now accepts nested **Benefit** blocks (`blocks/_dsr-benefit.liquid`: icon, title, description), which can be added, removed and reordered in the theme editor.

- **No Benefit blocks:** the block shows its six item slots exactly as before. The live store is in this state, so the merchant's copy and icons appear unchanged.
- **Taking over:** as soon as one Benefit block is added, the Benefit blocks are shown instead, in their order.
- **New instances:** a newly added "Icons with text" block starts with four demo cards, the brief's copy:
  - truck: شحن لكل مصر;
  - wallet: الدفع عند الاستلام;
  - inspection: معاينة قبل الاستلام;
  - exchange: استبدال سهل.
- **Icons:** wallet, inspection and exchange are new choices, also available for the existing item slots. The live store keeps its chosen icons (truck, lock, support, quality badge) until the merchant changes them.

## Theme editor

New settings under **Mobile cards**:
- compact cards on mobile (on);
- section background;
- card background;
- card corner radius;
- space between cards;
- section padding;
- card padding;
- space above and below.

Every existing setting ID is kept.

## Files

| File | |
|---|---|
| `blocks/ai_gen_block_c719b9a.liquid` | Mobile card styles and settings; nested Benefit blocks; the item slots render through the shared snippet |
| `blocks/_dsr-benefit.liquid` (new) | Benefit card block |
| `snippets/dsr-benefit.liquid`, `snippets/dsr-benefit-icon.liquid` (new) | Card markup and icons, shared by both |
| `tests/lib/theme-harness.js` | `{% content_for 'blocks' %}` (nested theme blocks) |
| `tests/store-benefits.test.js` (new) | Tests |

## Tests

`tests/store-benefits.test.js`: 111 checks on the real home template, Arabic and English, at 360, 390, 430 and 1440px.
- **Mobile:** every measurement in the table above, measured in the browser:
  - two rows of two, with equal heights;
  - text inside its card;
  - a compact band (cards at most 116px, section at most 280px);
  - about 24px from the section above.
- **Desktop:** the block's configured values.
- **Content:** the merchant's cards, in order.
- **Benefit blocks:** their order, their number (three cards), and that they replace the item slots.
- **Schema:** existing setting IDs and the new defaults.

`tests/home.test.js` still passes (356).

**Screenshots:** `docs/stages/store-benefits-shots/benefits-{ar,en}-{360,390,430,1440}.png`, a local render. Before and after shots from the Shopify preview are in the PR.

## Notes

- Theme Check flags the two new snippets as "OrphanedSnippet" (a suggestion). Both are rendered, from `blocks/`, which that check doesn't scan.
- The block now declares 54 settings, against Theme Check's suggested 40. It already declared 46, and other live blocks declare up to 80.
- The section below on the live page is the Judge.me testimonials app block. The test harness can't render it; spacing below is checked on the real preview.

## Real preview

Unpublished theme `#168455471335`, "DRESSAR PREVIEW (Claude) — Nov 15 design briefs", a copy of the live theme. Screenshots are in `docs/stages/store-benefits-preview-shots/before-benefits-*` and `after-benefits-*` (Arabic `/ar` and English, 360, 390, 430, 1440px).

- **Phones:** the band is 255–304px tall, down from 438–500px; 12px margins plus the neighbours' own spacing above and below.
- **Desktop:** unchanged.
- **Store copy:** the Arabic page shows some English benefit copy. That comes from the store's saved translations of this block and was there before; it is not changed here.
- **Full stop:** an English line used to show its full stop on the wrong side on the Arabic page. Each line now keeps its own direction.
