// Product card rows (snippets/card-product.liquid with dsr-card-swatches and
// dsr-card-sizes): a colour row on every card, and the name, price, colour and
// size rows at the same heights and positions on every card, so cards line up
// across the grid. The theme's real collection page, rendered by
// tests/lib/theme-harness.js and measured in Chromium.
// usage: node tests/card-rows.test.js [themeRoot]
'use strict';

const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const WIDTHS = [360, 390, 430, 768, 990, 1280, 1440];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

// The fixture catalog plus one product per case, first in a "rows" collection
// (then the four-colour linen skirt, the fixture's first product).
function testCatalog() {
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const offset = catalog.products.length;
  const sizes = ['M', 'L', 'XL'];
  const add = (p) => catalog.products.push({ type: 'Skirt', created: 1, media: [[810, 1080]], ...p });
  const plain = (colour, price = 39900, compare = 0, available = 1) => sizes.map((s) => [[colour, s], price, compare, available, 0]);
  add({ handle: 'qa-row-one-colour', title: 'Navy Skirt', options: [{ name: 'Color', values: [['Navy', '#1F2A44']] }, { name: 'Size', values: sizes }], variants: plain('Navy') });
  // A colour option not linked to Shopify's swatches, with the colour in the product's Color metafield (the store's "130").
  add({ handle: 'qa-row-meta-colour', title: 'Black Skirt', options: [{ name: 'Color', values: ['black'] }, { name: 'Size', values: sizes }], colorMeta: [['Black', '#000000']], variants: plain('black') });
  // A pattern with no colour or image anywhere (the store's "Floral", "Striped").
  add({ handle: 'qa-row-pattern', title: 'Floral Skirt', options: [{ name: 'Color', values: ['Floral'] }, { name: 'Size', values: sizes }], colorMeta: [['Floral', null]], variants: plain('Floral') });
  add({ handle: 'qa-row-no-colour', title: 'Wrap Skirt', options: [{ name: 'Size', values: sizes }], variants: sizes.map((s) => [[s], 39900, 0, 1, 0]) });
  const many = [['Black', '#000000'], ['Navy', '#1F2A44'], ['Olive', '#556B2F'], ['Sand', '#C2B280'], ['Rose', '#C08081'], ['Grey', '#808080'], ['Teal', '#0E7F8B']];
  add({ handle: 'qa-row-many', title: 'Seven Colours Skirt', options: [{ name: 'Color', values: many }, { name: 'Size', values: sizes }], variants: many.flatMap(([c]) => plain(c)) });
  add({
    handle: 'qa-row-long-name',
    title: 'Extra Long Pleated Chiffon Maxi Skirt With Front Pockets | جيبة شيفون طويلة جداً مكسرة بجيوب أمامية',
    options: [{ name: 'Color', values: [['Beige', '#EAD8AB']] }, { name: 'Size', values: sizes }],
    variants: [[['Beige', 'M'], 124900, 159900, 1, 0], [['Beige', 'L'], 129900, 159900, 1, 0], [['Beige', 'XL'], 134900, 169900, 1, 0]],
  });
  add({ handle: 'qa-row-sold-out', title: 'Sold Out Skirt', options: [{ name: 'Color', values: [['Brown', '#9A5630']] }, { name: 'Size', values: sizes }], variants: plain('Brown', 39900, 0, 0) });
  const six = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
  add({ handle: 'qa-row-six-sizes', title: 'Six Sizes Skirt', options: [{ name: 'Color', values: [['Black', '#000000']] }, { name: 'Size', values: six }], variants: six.map((s) => [['Black', s], 39900, 0, 1, 0]) });
  catalog.collections.rows = { title: 'Rows', size: catalog.products.length - offset + 1, offset, description: '' };
  return catalog;
}

async function main() {
  const browser = await chromium.launch();
  const catalog = testCatalog();

  for (const locale of ['en.default', 'ar']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });
    const strings = readJson(path.join(root, 'locales', `${locale}.json`));

    for (const width of WIDTHS) {
      if (rtl && ![390, 1280].includes(width)) continue;
      const tag = `${L} [${width}]`;
      const sf = storefront({ root, harness, catalog });
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
      await routeTheme(page, { root, fontsDir, harness, imageSize: sf.imageSize, globalsFor: () => sf.globalsFor(), cartSection: sf.cartSection, cartJson: sf.cartJson, pages: (url) => sf.pages(url) });
      await page.goto('http://dressar.test/collections/rows');
      await page.waitForTimeout(600);
      // Scroll once through: Dawn's scroll reveals settle.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 40));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(400);

      const cards = await page.evaluate(() =>
        [...document.querySelectorAll('#product-grid > li')].map((li) => {
          const box = (el) => (el ? el.getBoundingClientRect() : null);
          const card = li.querySelector('.card-wrapper').getBoundingClientRect();
          const media = box(li.querySelector('.card__media'));
          const title = box(li.querySelector('.card > .card__content .card__heading'));
          const price = box(li.querySelector('.card > .card__content .price'));
          const colours = box(li.querySelector('.dsr-card-colors-row'));
          const sizes = box(li.querySelector('.dsr-card-sizes-row'));
          const plus = box(li.querySelector('.dsr-quick-add__button'));
          const rel = (b) => (b ? Math.round((b.top - card.top) * 10) / 10 : null);
          const items = [...li.querySelectorAll('.dsr-card-colors-row li')].map((x) => x.getBoundingClientRect());
          const sizeItems = [...li.querySelectorAll('.dsr-card-sizes li')].map((x) => x.getBoundingClientRect());
          const handle = (li.querySelector('a.full-unstyled-link').getAttribute('href') || '').split('/').pop().split('?')[0];
          return {
            handle,
            top: Math.round(card.top),
            height: Math.round(card.height),
            left: card.left,
            right: card.right,
            ratio: media ? media.height / media.width : null,
            title: title && [rel(title), Math.round(title.height)],
            price: price && [rel(price), Math.round(price.height)],
            colours: colours && [rel(colours), Math.round(colours.height)],
            sizes: sizes && [rel(sizes), Math.round(sizes.height)],
            order: title && price && colours && sizes ? title.top < price.top && price.top < colours.top && colours.top < sizes.top : false,
            swatches: [...li.querySelectorAll('.dsr-card-colors-row .swatch')].map((s) => getComputedStyle(s).getPropertyValue('--swatch--background').trim()),
            fake: li.querySelectorAll('.dsr-card-colors-row .swatch--unavailable').length,
            more: (li.querySelector('.dsr-card-swatches__more [aria-hidden]') || {}).textContent || null,
            count: (li.querySelector('.dsr-card-colors') || {}).textContent || null,
            // One line: every item centred on the same line (swatches and "+N" differ in height).
            colourLine: items.length ? Math.max(...items.map((r) => r.top + r.height / 2)) - Math.min(...items.map((r) => r.top + r.height / 2)) < 2 : true,
            // The list starts 0.5rem out (its first swatch's dot lines up with the text), on the reading-start side.
            colourInside: items.every((r) => r.left >= card.left - 6 && r.right <= card.right + 6) && (getComputedStyle(li).direction === 'rtl' ? items.every((r) => r.left >= card.left - 1) : items.every((r) => r.right <= card.right + 1)),
            sizeLine: sizeItems.length ? new Set(sizeItems.map((r) => Math.round(r.top))).size === 1 : true,
            // The size row stays inside the card; more sizes than fit scroll sideways inside it.
            sizeInside: (() => { const list = li.querySelector('.dsr-card-sizes'); if (!list) return true; const r = list.getBoundingClientRect(); return r.left >= card.left - 1 && r.right <= card.right + 1; })(),
            sizesStruck: [...li.querySelectorAll('.dsr-card-size')].every((b) => b.getAttribute('aria-disabled') === 'true'),
            sizeCount: sizeItems.length,
            plusInside: plus && media ? plus.left >= media.left && plus.right <= media.right && plus.top >= media.top && plus.bottom <= media.bottom : null,
          };
        })
      );
      // Collections number their repeat copies (handle-1): look a product up either way.
      const by = new Proxy(Object.fromEntries(cards.map((c) => [c.handle, c])), {
        get: (t, k) => t[k] || Object.entries(t).find(([h]) => h.replace(/-\d+$/, '') === k)?.[1],
      });
      // The same within half a pixel (sale prices land on fractional pixels).
      const same = (key) => cards.every((c) => c[key] && c[key].every((v, i) => Math.abs(v - cards[0][key][i]) <= 0.5));
      const detail = (key) => JSON.stringify(cards.map((c) => [c.handle.replace('qa-row-', ''), c[key]]));

      check(`${tag} every card has a colour row and a size row`, cards.length === 9 && cards.every((c) => c.colours && c.sizes), `${cards.length} ${detail('colours')}`);
      check(`${tag} order: photo, name, price, colours, sizes`, cards.every((c) => c.order), detail('order'));
      check(`${tag} names take the same height (two lines) and place on every card`, same('title') && cards[0].title[1] >= 30, detail('title'));
      check(`${tag} prices at the same height and place on every card`, same('price'), detail('price'));
      check(`${tag} colour rows at the same height and place on every card`, same('colours'), detail('colours'));
      check(`${tag} size rows at the same height and place on every card`, same('sizes'), detail('sizes'));
      const rows = {};
      cards.forEach((c) => (rows[c.top] = rows[c.top] || []).push(c.height));
      check(`${tag} cards side by side have the same height`, Object.values(rows).every((h) => new Set(h).size === 1), JSON.stringify(rows));
      if (width < 750) check(`${tag} two columns`, Object.values(rows)[0].length === 2, JSON.stringify(Object.values(rows).map((r) => r.length)));
      check(`${tag} 3:4 photos`, cards.every((c) => Math.abs(c.ratio - 4 / 3) < 0.01), detail('ratio'));
      check(`${tag} the "+" stays on the photo`, cards.every((c) => c.plusInside !== false), detail('plusInside'));

      // Colours: real data only.
      check(`${tag} one colour: its swatch`, JSON.stringify(by['qa-row-one-colour'].swatches) === JSON.stringify(['rgb(31 42 68)']), JSON.stringify(by['qa-row-one-colour'].swatches));
      check(`${tag} colour from the product's Color metafield (option not linked): its swatch`, JSON.stringify(by['qa-row-meta-colour'].swatches) === JSON.stringify(['rgb(0 0 0)']), JSON.stringify(by['qa-row-meta-colour'].swatches));
      check(`${tag} pattern with no colour data: empty row, no made-up swatch`, by['qa-row-pattern'].swatches.length === 0 && by['qa-row-pattern'].fake === 0 && !by['qa-row-pattern'].count, JSON.stringify(by['qa-row-pattern']));
      check(`${tag} no colour option: empty row`, by['qa-row-no-colour'].swatches.length === 0 && by['qa-row-no-colour'].fake === 0, JSON.stringify(by['qa-row-no-colour'].swatches));
      check(`${tag} several colours: all shown (linen skirt, 4)`, by['linen-maxi-skirt-with-front-pockets'].swatches.length === 4, JSON.stringify(by['linen-maxi-skirt-with-front-pockets'].swatches));
      check(`${tag} 7 colours: 4 swatches and "+3" (5 items at most)`, by['qa-row-many'].swatches.length === 4 && by['qa-row-many'].more === '+3', `${by['qa-row-many'].swatches.length} ${by['qa-row-many'].more}`);
      check(`${tag} no made-up swatch anywhere`, cards.every((c) => c.fake === 0), detail('fake'));
      check(`${tag} colour rows on one line, inside the card`, cards.every((c) => c.colourLine && c.colourInside), JSON.stringify(cards.filter((c) => !c.colourLine || !c.colourInside).map((c) => c.handle)));
      check(`${tag} size rows on one line, inside the card (6 sizes too)`, cards.every((c) => c.sizeLine && c.sizeInside) && by['qa-row-six-sizes'].sizeCount === 6, JSON.stringify(cards.filter((c) => !c.sizeLine || !c.sizeInside).map((c) => c.handle)));
      check(`${tag} sold out: its sizes shown, all struck through`, by['qa-row-sold-out'].sizeCount === 3 && by['qa-row-sold-out'].sizesStruck, JSON.stringify(by['qa-row-sold-out'].sizes));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`${tag} no sideways page scroll`, overflow <= 0, overflow);
      check(`${tag} no JS errors`, errors.length === 0, errors.join(' | '));
      await context.close();
    }
  }

  await browser.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) {
      failed++;
      console.log(`FAIL  ${r.name}  -> ${r.detail}`);
    }
  }
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
