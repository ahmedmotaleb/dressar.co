// Product card refresh (docs/stages/card-refresh.md): 12px photo and card
// corners, #FAF8F5 card on a 1px #E5E0DA border, exact spacing (photo→name
// 8px, name→price 6px, price→colours 8px, colours→sizes 6px, 12px at the
// bottom), and every size shown on one line, centred, with unavailable sizes
// clearly marked. Equal card heights per grid row; two cards per row on
// phones. The theme's real collection page, Arabic and English.
// usage: node tests/card-refresh.test.js [themeRoot] [--shots <dir>]
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const shotsArg = process.argv.indexOf('--shots');
const shotsDir = shotsArg > -1 ? process.argv[shotsArg + 1] : null;
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const WIDTHS = [320, 360, 390, 430, 1440];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });
const near = (a, b, t = 1) => a !== null && a !== undefined && Math.abs(a - b) <= t;

// Fixture catalog plus the size cases, first in a "refresh" collection.
function testCatalog() {
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const offset = catalog.products.length;
  const add = (p) => catalog.products.push({ type: 'Skirt', created: 1, media: [[810, 1080]], ...p });
  const six = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
  add({ handle: 'qa-six', title: 'Six Sizes Skirt', options: [{ name: 'Color', values: [['Black', '#000000']] }, { name: 'Size', values: six }], variants: six.map((s) => [['Black', s], 39900, 0, 1, 0]) });
  add({ handle: 'qa-one-size', title: 'One Size Scarf', options: [{ name: 'Color', values: [['Sand', '#C2B280']] }, { name: 'Size', values: ['One size'] }], variants: [[['Sand', 'One size'], 19900, 0, 1, 0]] });
  // Some sizes out of stock: struck through.
  add({ handle: 'qa-partial', title: 'Partly Sold Skirt', options: [{ name: 'Color', values: [['Navy', '#1F2A44']] }, { name: 'Size', values: ['M', 'L', 'XL', 'XXL'] }], variants: [[['Navy', 'M'], 39900, 49900, 1, 0], [['Navy', 'L'], 39900, 49900, 0, 0], [['Navy', 'XL'], 39900, 49900, 1, 0], [['Navy', 'XXL'], 39900, 49900, 0, 0]] });
  const seven = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  add({ handle: 'qa-seven', title: 'Seven Sizes Dress', options: [{ name: 'Color', values: [['Olive', '#556B2F'], ['Rose', '#C08081']] }, { name: 'Size', values: seven }], variants: ['Olive', 'Rose'].flatMap((c) => seven.map((s) => [[c, s], 59900, 79900, 1, 0])) });
  catalog.collections.refresh = { title: 'Refresh', size: catalog.products.length - offset + 2, offset, description: '' };
  return catalog;
}

async function main() {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'config/settings_schema.json'), 'utf8'));
  const set = (id) => schema.flatMap((g) => g.settings || []).find((s) => s.id === id);
  check('settings: "Card background" defaults to #FAF8F5', set('card_background') && set('card_background').default.toUpperCase() === '#FAF8F5');
  check('settings: "Card border" colour setting, #E5E0DA', set('card_border') && set('card_border').type === 'color' && set('card_border').default.toUpperCase() === '#E5E0DA');
  const js = fs.readFileSync(path.join(root, 'assets/dsr-card.js'), 'utf8');
  check('sizes are no longer hidden behind "+N"', !/dsrFitSizes|sizes__more/.test(js));

  const browser = await chromium.launch();
  const catalog = testCatalog();
  // The repo's settings ("Standard" card style) and the live store's (Nov 26):
  // Theme settings > Product cards > Style "Card", white colour scheme, square.
  const STYLES = [
    ['standard', null],
    ['card style', { card_style: 'card', card_color_scheme: 'scheme-1', card_corner_radius: 0, card_border_thickness: 0, card_shadow_opacity: 0 }],
  ];
  for (const [styleName, overrides] of STYLES)
  for (const locale of ['ar', 'en.default']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale, settingsOverrides: overrides });
    for (const width of WIDTHS) {
      if (overrides && ![320, 390, 1440].includes(width)) continue;
      const tag = `${L} [${width}]${overrides ? ` [${styleName}]` : ''}`;
      const mobile = width < 750;
      const sf = storefront({ root, harness, catalog });
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: shotsDir ? 2 : 1, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
      await routeTheme(page, { root, fontsDir, harness, imageSize: sf.imageSize, globalsFor: () => sf.globalsFor(), cartSection: sf.cartSection, cartJson: sf.cartJson, pages: (url) => sf.pages(url) });
      await page.goto('http://dressar.test/collections/refresh');
      await page.addStyleTag({ content: '.scroll-trigger{opacity:1!important;transform:none!important;animation:none!important}' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);

      const m = await page.evaluate(() => {
        const r = (e) => e.getBoundingClientRect();
        const cards = [...document.querySelectorAll('#product-grid > li .product-card-wrapper')].slice(0, 6).map((w) => {
          const card = w.querySelector('.card');
          const cs = getComputedStyle(card);
          const inner = w.querySelector('.card__inner');
          const heading = w.querySelector('.card__heading.h5');
          const price = w.querySelector('.card-information > .price');
          const colors = w.querySelector('.dsr-card-colors-row');
          const sizesRow = w.querySelector('.dsr-card-sizes-row');
          const list = w.querySelector('.dsr-card-sizes');
          const items = list ? [...list.children] : [];
          const shown = items.filter((li) => li.getBoundingClientRect().width > 0);
          const content = w.querySelector('.card > .card__content');
          const lastRow = sizesRow && r(sizesRow).height > 0 ? sizesRow : colors;
          // Centring: on each line of sizes, the space on the left equals the space on the right.
          const lines = {};
          shown.forEach((li) => { const b = r(li); const k = Math.round(b.top); (lines[k] = lines[k] || []).push(b); });
          const lb = list && r(list);
          const centred = Object.values(lines).every((ln) => { const L0 = Math.min(...ln.map((b) => b.left)), R0 = Math.max(...ln.map((b) => b.right)); return Math.abs((L0 - lb.left) - (lb.right - R0)) <= 1.5; });
          const inside = shown.every((li) => { const b = r(li); const c = r(card); return b.left >= c.left - 0.5 && b.right <= c.right + 0.5; });
          const disabled = [...w.querySelectorAll('.dsr-card-size[aria-disabled="true"]')].map((b) => { const s = getComputedStyle(b); return { line: s.textDecorationLine, border: s.borderTopStyle }; });
          const btn = w.querySelector('.dsr-card-size');
          return {
            title: heading.textContent.trim().slice(0, 24),
            top: Math.round(r(card).top),
            height: Math.round(r(card).height),
            width: Math.round(r(card).width),
            bg: cs.backgroundColor,
            border: [cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor].join(' '),
            radius: cs.borderTopLeftRadius,
            shadow: cs.boxShadow,
            imgRadius: getComputedStyle(inner).borderTopLeftRadius,
            imgRatio: +(r(inner).height / r(inner).width).toFixed(3),
            imgToTitle: Math.round(r(heading).top - r(inner).bottom),
            titleToPrice: Math.round(r(price).top - r(heading).bottom),
            priceToColors: Math.round(r(colors).top - r(price).bottom),
            colorsToSizes: sizesRow ? Math.round(r(sizesRow).top - r(colors).bottom) : null,
            bottomPad: parseFloat(getComputedStyle(content).paddingBottom),
            lastToBottom: Math.round(r(card).bottom - r(lastRow).bottom),
            sizes: items.length,
            sizesShown: shown.length,
            hidden: items.filter((li) => li.hidden).length,
            more: !!w.querySelector('.dsr-card-sizes__more'),
            lines: Object.keys(lines).length,
            centred,
            inside,
            disabled,
            minFont: Math.min(...[...w.querySelectorAll('.dsr-card-size')].map((b) => parseFloat(getComputedStyle(b).fontSize))),
            // Each label fits its box (nothing clipped).
            textFits: [...w.querySelectorAll('.dsr-card-size')].every((b) => b.scrollWidth <= b.clientWidth + 0.5),
            btn: btn && { h: Math.round(r(btn).height), radius: getComputedStyle(btn).borderTopLeftRadius },
            badge: !!w.querySelector('.card__badge .badge:not([hidden])'),
            bag: !!w.querySelector('.dsr-quick-add__button'),
            swatches: w.querySelectorAll('.dsr-card-swatch').length,
          };
        });
        const pageBg = getComputedStyle(document.body).backgroundColor;
        return { cards, pageBg, overflow: document.documentElement.scrollWidth > innerWidth };
      });

      const c = m.cards;
      const by = (t) => c.find((x) => x.title.startsWith(t));
      check(`${tag} card: #FAF8F5 background, 1px #E5E0DA border, 12px corners, no shadow`, c.every((x) => x.bg === 'rgb(250, 248, 245)' && x.border === '1px solid rgb(229, 224, 218)' && x.radius === '12px' && x.shadow === 'none'), JSON.stringify(c.slice(0, 2).map((x) => [x.bg, x.border, x.radius, x.shadow])));
      check(`${tag} page background unchanged (not the card colour)`, m.pageBg !== 'rgb(250, 248, 245)', m.pageBg);
      check(`${tag} photo: 12px corners, the same frame ratio on every card`, c.every((x) => x.imgRadius === '12px') && new Set(c.map((x) => x.imgRatio)).size === 1, JSON.stringify(c.map((x) => [x.imgRadius, x.imgRatio])));
      check(`${tag} spacing: photo→name 8px`, c.every((x) => near(x.imgToTitle, 8)), JSON.stringify(c.map((x) => x.imgToTitle)));
      check(`${tag} spacing: name→price 6px`, c.every((x) => near(x.titleToPrice, 6)), JSON.stringify(c.map((x) => x.titleToPrice)));
      check(`${tag} spacing: price→colours 8px`, c.every((x) => near(x.priceToColors, 8)), JSON.stringify(c.map((x) => x.priceToColors)));
      check(`${tag} spacing: colours→sizes 6px`, c.every((x) => x.colorsToSizes === null || near(x.colorsToSizes, 6)), JSON.stringify(c.map((x) => x.colorsToSizes)));
      check(`${tag} spacing: 12px bottom padding (exactly 12px under the tallest card's sizes)`, c.every((x) => x.bottomPad === 12 && x.lastToBottom >= 11) && c.some((x) => near(x.lastToBottom, 12)), JSON.stringify(c.map((x) => x.lastToBottom)));
      // Equal heights for cards on the same grid row.
      const rows = {};
      c.forEach((x) => (rows[x.top] = rows[x.top] || []).push(x.height));
      check(`${tag} equal card heights on each grid row`, Object.values(rows).every((h) => Math.max(...h) - Math.min(...h) <= 1), JSON.stringify(rows));
      if (mobile) check(`${tag} two cards per row`, Object.values(rows).every((h) => h.length === 2), JSON.stringify(Object.values(rows).map((h) => h.length)));
      check(`${tag} every size shown, none behind "+N"`, c.every((x) => x.sizesShown === x.sizes && x.hidden === 0 && !x.more) && by('Six') && by('Six').sizesShown === 6 && by('Seven') && by('Seven').sizesShown === 7, JSON.stringify(c.map((x) => [x.title, x.sizes, x.sizesShown])));
      check(`${tag} sizes on one line, centred, each box inside the card`, c.every((x) => x.lines <= 1 && x.centred && x.inside), JSON.stringify(c.map((x) => [x.title, x.centred, x.inside, x.lines])));
      check(`${tag} One Size centred`, by('One Size') && by('One Size').sizes === 1 && by('One Size').centred, JSON.stringify(by('One Size')));
      check(`${tag} size buttons: 24px, 6px corners`, c.every((x) => !x.btn || (x.btn.h === 24 && x.btn.radius === '6px')), JSON.stringify(c.map((x) => x.btn)));
      check(`${tag} unavailable sizes: struck through and dashed`, by('Partly') && by('Partly').disabled.length === 2 && by('Partly').disabled.every((d) => d.line.includes('line-through') && d.border === 'dashed'), JSON.stringify(by('Partly') && by('Partly').disabled));
      // The store's own five sizes, M L XL XXL 3XL, at the full 11px on one line.
      const five = c.filter((x) => x.sizes === 5);
      check(`${tag} five sizes (M–3XL): one line at 11px, nothing cut`, five.length > 0 && five.every((x) => x.lines === 1 && x.minFont === 11 && x.textFits && x.inside), JSON.stringify(five.map((x) => [x.title, x.lines, x.minFont, x.textFits])));
      check(`${tag} 6 and 7 sizes still on one line, text at least 8px and not cut`, ['Six', 'Seven'].every((t) => by(t) && by(t).lines === 1 && by(t).minFont >= 8 && by(t).textFits), JSON.stringify(['Six', 'Seven'].map((t) => by(t) && [by(t).lines, by(t).minFont, by(t).textFits])));
      check(`${tag} badge, swatches and quick-add bag still there`, by('Partly').badge && c.every((x) => x.bag && x.swatches >= 1), JSON.stringify(c.map((x) => [x.badge, x.bag, x.swatches])));
      check(`${tag} no sideways scrolling`, !m.overflow);

      // Choosing a size still works (exact variant on the card's links).
      const pick = await page.evaluate(async () => {
        const w = [...document.querySelectorAll('#product-grid > li .product-card-wrapper')].find((x) => /Six Sizes/.test(x.textContent));
        const b = [...w.querySelectorAll('.dsr-card-size')].find((x) => x.dataset.value === 'XL');
        b.click();
        await new Promise((r) => setTimeout(r, 200));
        return { pressed: b.getAttribute('aria-pressed'), href: w.querySelector('a.full-unstyled-link').getAttribute('href') };
      });
      check(`${tag} choosing a size still selects the exact variant`, pick.pressed === 'true' && /variant=\d+/.test(pick.href), JSON.stringify(pick));
      check(`${tag} no JS errors`, errors.length === 0, errors.join(' | '));
      if (shotsDir && [320, 390].includes(width)) await page.locator('#product-grid').screenshot({ path: path.join(shotsDir, `grid-${overrides ? 'cardstyle-' : ''}${rtl ? 'ar' : 'en'}-${width}.png`) });
      await context.close();
    }
  }
  await browser.close();

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok || !r.detail ? '' : `  -> ${r.detail}`}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
