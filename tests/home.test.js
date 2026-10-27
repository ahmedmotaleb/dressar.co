// Stage 7 homepage tests: the theme's real index template (Dawn slideshow,
// featured collections, collection list, multicolumn, the AI editorial blocks
// still in use), rendered by tests/lib/theme-harness.js from
// tests/fixtures/catalog.json and driven in Chromium.
// usage: node tests/home.test.js [themeRoot] [--shots <dir>]
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { buildCollection } = require('./lib/catalog');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const shotsArg = process.argv.indexOf('--shots');
const shotsDir = shotsArg > -1 ? process.argv[shotsArg + 1] : null;
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const locale = process.env.LOCALE || 'en.default';
const WIDTHS = [360, 390, 430, 768, 990, 1280, 1440];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

// The merchandising order Stage 7 sets (sections that render, top to bottom).
const ORDER = [
  'slideshow_xmQTbz',
  'dsr_row_white_friday',
  'dsr_row_new_arrivals',
  'collection_list_DJAc8Q',
  'dsr_row_best_sellers',
  '1783544336b861804d',
  'dsr_row_complete_looks',
  'slideshow_ATRpFY',
  'dsr_row_back_to_uni',
  '1783545576ddb21e92',
  'multicolumn_YVGgni',
  '1783546806decc8eee',
  '17855997423e962d80',
];

async function main() {
  const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const template = readJson(path.join(root, 'templates/index.json'));
  const sizes = {};
  catalog.products.forEach((p) => p.media.forEach((m, i) => (sizes[`${p.handle}-${i}.jpg`] = m)));
  Object.entries(catalog.collections).forEach(([h, c]) => c.image && (sizes[`collection-${h}.jpg`] = c.image));
  const collections = (handle) => buildCollection(catalog, handle);
  const t = (key) => String(key.split('.').reduce((o, k) => (o == null ? o : o[k]), readJson(path.join(root, 'locales', `${locale}.json`))));

  const rows = Object.entries(template.sections)
    .filter(([id, s]) => s.type === 'featured-collection' && !s.disabled)
    .map(([id, s]) => ({ id, ...s.settings }));

  // ---------- Template, statically ----------
  {
    const rendered = template.order.filter((id) => !template.sections[id].disabled);
    const nonEmpty = rendered.filter((id) => {
      const s = template.sections[id];
      return s.type !== '_blocks' || Object.values(s.blocks || {}).some((b) => !b.disabled);
    });
    check('template: sections in the Stage 7 merchandising order', JSON.stringify(nonEmpty) === JSON.stringify(ORDER), nonEmpty.join(', '));
    const aiCarousels = rendered.filter((id) =>
      Object.values(template.sections[id].blocks || {}).some((b) => !b.disabled && /ai_gen_block_(c5191df|13d13cc|24adf50|3cce436)/.test(b.type))
    );
    check('template: no AI product carousel or AI slideshow renders', aiCarousels.length === 0, aiCarousels.join(', '));
    check(
      'template: the replaced AI carousels are kept, switched off (rollback)',
      ['dsr_white_friday', 'blocks_UNdXLN', '178380029305c1cfb4', 'blocks_ejM6Ri', '178393405299cfb2a3'].every((id) => template.sections[id] && template.sections[id].disabled)
    );
    check(
      'template: five product rows, 3:4 cards, 8 products, swipeable, with "View all"',
      rows.length === 5 &&
        rows.every((r) => r.image_ratio === 'tall' && r.products_to_show === 8 && r.swipe_on_mobile && r.enable_desktop_slider && r.show_view_all && r.collection),
      JSON.stringify(rows.map((r) => [r.id, r.collection, r.image_ratio, r.products_to_show]))
    );
    const slideshows = Object.values(template.sections).filter((s) => s.type === 'slideshow' && !s.disabled);
    check(
      'template: slideshows hold still (no auto-rotate, no ambient zoom)',
      slideshows.length === 2 && slideshows.every((s) => s.settings.auto_rotate === false && s.settings.image_behavior === 'none')
    );
    const css = fs.readFileSync(path.join(root, 'assets/component-card.css'), 'utf8');
    check('component-card.css: the !important ambient override is gone (the setting decides)', !/animate--ambient/.test(css));
  }

  const pages = async (url) => {
    if (url.pathname !== '/') return null;
    const globals = harness.globals({ path: '/', pageType: 'index', overrides: { __collections: collections } });
    return harness.renderLayout(globals, await harness.renderTemplate('index', globals));
  };

  const browser = await chromium.launch();
  const open = async (width) => {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    page.on('console', (msg) => msg.type() === 'error' && !/Failed to load resource/.test(msg.text()) && page.errors.push(msg.text()));
    await routeTheme(page, { root, fontsDir, harness, globalsFor: () => harness.globals(), pages, imageSize: (n) => sizes[n] });
    await page.goto('http://dressar.test/');
    await page.waitForTimeout(600);
    page.closeAll = () => context.close();
    return page;
  };
  const shot = async (page, name, opts = {}) => shotsDir && page.screenshot({ path: path.join(shotsDir, `${name}.png`), ...opts });
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

  for (const width of WIDTHS) {
    const tag = `[${width}]`;
    const desktop = width >= 990;
    const page = await open(width);
    if (shotsDir) {
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(800);
      await shot(page, `home-${width}`, { fullPage: true });
      await shot(page, `home-${width}-fold`);
    }

    const basics = await page.evaluate(() => ({
      order: [...document.querySelectorAll('main > .shopify-section')].filter((s) => s.children.length && s.textContent.trim() + s.querySelectorAll('img, video').length).map((s) => s.id.replace('shopify-section-template--1__', '')),
      h1: document.querySelectorAll('h1').length,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      ai: document.querySelectorAll('[class*="ai-featured-collection"], [class*="ai-product-card"], [class*="ai-slideshow"]').length,
      aiElements: [...document.querySelectorAll('main *')].filter((e) => /^featured-collection-aigen|^product-grid-aigen/.test(e.localName)).length,
      inlineScripts: [...document.querySelectorAll('main script:not([src])')].length,
      sliders: document.querySelectorAll('main slider-component').length,
    }));
    check(`${tag} sections render in the Stage 7 order`, JSON.stringify(basics.order.filter((id) => ORDER.includes(id))) === JSON.stringify(ORDER), basics.order.join(', '));
    check(`${tag} one H1 on the page`, basics.h1 === 1, String(basics.h1));
    check(`${tag} no horizontal overflow`, !basics.overflow);
    check(`${tag} no AI carousel markup; the rows use Dawn's one slider`, basics.ai === 0 && basics.aiElements === 0 && basics.sliders >= 5, JSON.stringify(basics));
    // The editorial AI blocks kept (media grid, videos, icons) carry one inline script each; the carousels added five more.
    check(`${tag} inline scripts in the page body: at most the 3 kept editorial blocks`, basics.inlineScripts <= 3, String(basics.inlineScripts));

    // Product rows.
    for (const row of rows) {
      const data = collections(row.collection);
      const r = await page.evaluate((id) => {
        const sec = document.getElementById(`shopify-section-template--1__${id}`);
        const items = [...sec.querySelectorAll('.product-grid > li')];
        const inner = items.map((li) => li.querySelector('.card__inner').getBoundingClientRect());
        const imgs = items.map((li) => li.querySelector('.card__media img'));
        const viewAll = sec.querySelector('.collection__view-all a');
        return {
          heading: (sec.querySelector('h2') || {}).textContent?.trim(),
          hrefs: items.map((li) => li.querySelector('a.full-unstyled-link').getAttribute('href')),
          ratios: inner.map((b) => b.height / b.width),
          widths: inner.map((b) => b.width),
          eager: imgs.filter((i) => i && i.getAttribute('loading') !== 'lazy').length,
          imgs: imgs.filter(Boolean).length,
          viewAll: viewAll && viewAll.getAttribute('href'),
          dsrCard: sec.querySelectorAll('.card-wrapper .dsr-card-swatches, .card-wrapper .dsr-card-sizes').length,
          slider: sec.querySelector('.product-grid').className,
          sectionWidth: sec.querySelector('slider-component').getBoundingClientRect().width,
        };
      }, row.id);
      const expected = data.products.slice(0, 8).map((p) => p.url);
      check(`${tag} ${row.id}: heading is the merchant's title`, r.heading === row.title, r.heading);
      check(`${tag} ${row.id}: the collection's first 8 products, in its order`, JSON.stringify(r.hrefs) === JSON.stringify(expected), r.hrefs.join(','));
      check(`${tag} ${row.id}: every card photo is 3:4`, r.ratios.length && r.ratios.every((x) => Math.abs(x - 4 / 3) < 0.01), r.ratios.map((x) => x.toFixed(3)).join(','));
      check(`${tag} ${row.id}: "View all" goes to the collection`, r.viewAll === `/collections/${row.collection}`, r.viewAll);
      check(`${tag} ${row.id}: the DRESSAR card (swatches or sizes)`, r.dsrCard > 0, String(r.dsrCard));
      // Dawn's sliders: two cards and a peek on phones and tablets; on desktop,
      // four cards across the page width with the next one peeking at the edge.
      const perView = r.sectionWidth / r.widths[0];
      check(
        `${tag} ${row.id}: ${desktop ? 'desktop slider, 4 cards and a peek' : 'swipeable, 2 cards and a peek'}`,
        desktop ? perView > 4 && perView < 5 && /slider--desktop/.test(r.slider) : perView > 1.9 && perView < 2.6 && /slider--tablet/.test(r.slider),
        `${perView.toFixed(2)} ${r.slider}`
      );
      const index = ORDER.indexOf(row.id) + 1;
      check(
        `${tag} ${row.id}: ${index > 2 ? 'every photo lazy (below the fold)' : 'first 4 photos eager'}`,
        index > 2 ? r.eager === 0 : r.eager === 4,
        `${r.eager} eager of ${r.imgs}`
      );
    }

    // Hero.
    const hero = await page.evaluate(() => {
      const sec = document.getElementById('shopify-section-template--1__slideshow_xmQTbz');
      const imgs = [...sec.querySelectorAll('.slideshow__media img')];
      return {
        autoplay: sec.querySelector('.slideshow').dataset.autoplay,
        first: { loading: imgs[0].getAttribute('loading'), priority: imgs[0].getAttribute('fetchpriority') },
        restLazy: imgs.slice(1).every((i) => i.getAttribute('loading') === 'lazy'),
        animated: [...document.querySelectorAll('.slideshow__media, .slideshow__media img')].filter((e) => getComputedStyle(e).animationName !== 'none').length,
        ambient: document.querySelectorAll('.animate--ambient').length,
        top: sec.getBoundingClientRect().top,
        buttons: [...sec.querySelectorAll('.slider-button')].map((b) => b.getAttribute('aria-label')),
      };
    });
    check(`${tag} hero: no autoplay`, hero.autoplay === 'false', hero.autoplay);
    check(`${tag} hero: first image eager with fetchpriority high, the others lazy`, hero.first.loading !== 'lazy' && hero.first.priority === 'high' && hero.restLazy, JSON.stringify(hero.first));
    check(`${tag} no zoom animation on any slideshow image`, hero.animated === 0 && hero.ambient === 0, `${hero.animated} ${hero.ambient}`);
    check(`${tag} hero: previous/next buttons are labelled`, hero.buttons.length >= 2 && hero.buttons.every(Boolean), hero.buttons.join(' | '));

    // Shop by category.
    const cats = await page.evaluate(() => {
      const items = [...document.querySelectorAll('#shopify-section-template--1__collection_list_DJAc8Q .collection-list > li')];
      const tops = items.map((li) => li.offsetTop);
      return {
        hrefs: [...new Set(items.flatMap((li) => [...li.querySelectorAll('a')].map((a) => a.getAttribute('href'))))],
        columns: tops.filter((top) => top === tops[0]).length,
        photos: items.every((li) => li.querySelector('img')),
      };
    });
    check(`${tag} shop by category: 6 collections linked, with photos`, cats.hrefs.length === 6 && cats.hrefs.every((h) => /^\/collections\/[\w-]+$/.test(h)) && cats.photos, cats.hrefs.join(','));
    check(`${tag} shop by category: ${desktop ? 3 : 2} columns`, cats.columns === (desktop ? 3 : 2), String(cats.columns));

    if (width === 390 || width === 1280) {
      // Nothing moves on its own.
      const before = await page.evaluate(() => document.querySelector('#shopify-section-template--1__slideshow_xmQTbz .slider').scrollLeft);
      await page.waitForTimeout(6000);
      const after = await page.evaluate(() => document.querySelector('#shopify-section-template--1__slideshow_xmQTbz .slider').scrollLeft);
      check(`${tag} hero stays on its slide for 6 s`, before === after, `${before} -> ${after}`);
      // The shopper moves it: next slide, then a product row.
      await page.click('#shopify-section-template--1__slideshow_xmQTbz .slider-button--next');
      await page.waitForTimeout(700);
      const moved = await page.evaluate(() => document.querySelector('#shopify-section-template--1__slideshow_xmQTbz .slider-counter--current').textContent.trim());
      check(`${tag} hero: "next" shows slide 2`, moved === '2', moved);
      const rowSel = '#shopify-section-template--1__dsr_row_new_arrivals';
      await page.locator(rowSel).scrollIntoViewIfNeeded();
      const r0 = await page.evaluate((s) => document.querySelector(`${s} .slider`).scrollLeft, rowSel);
      await page.click(`${rowSel} .slider-button--next`);
      await page.waitForTimeout(700);
      const r1 = await page.evaluate((s) => document.querySelector(`${s} .slider`).scrollLeft, rowSel);
      check(`${tag} new arrivals: "next" scrolls the row`, r1 !== r0, `${r0} -> ${r1}`);
    }

    const missing = (page.missing || []).filter((p) => p.startsWith('/assets/'));
    check(`${tag} every theme asset the page asks for exists`, missing.length === 0, missing.join(', '));
    check(`${tag} no JS errors`, page.errors.length === 0, page.errors.join(' | '));
    await page.closeAll();
  }

  // The "View all" label comes from the locale.
  {
    const page = await open(390);
    const label = await page.evaluate(() => document.querySelector('#shopify-section-template--1__dsr_row_new_arrivals .collection__view-all a').textContent.trim());
    check('[390] "View all" label from the locale', label === t('sections.featured_collection.view_all'), label);
    await page.closeAll();
  }

  await browser.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`);
  console.error(e);
  process.exit(1);
});
