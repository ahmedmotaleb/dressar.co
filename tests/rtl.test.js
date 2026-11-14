// Stage 8 right-to-left tests: the Arabic storefront laid out right to left
// (snippets/dsr-direction.liquid, assets/dsr-rtl.css, the direction-aware
// sliders in assets/global.js), compared with English, on the theme's real
// pages rendered by tests/lib/theme-harness.js.
// usage: node tests/rtl.test.js [themeRoot]
'use strict';

const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

async function main() {
  const browser = await chromium.launch();
  const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

  for (const locale of ['ar', 'en.default']) {
    const rtl = locale === 'ar';
    const L = `[${locale}]`;
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });
    const sf = storefront({ root, harness, cartLines: [{ handle: 'linen-maxi-skirt-with-front-pockets', title: 'Linen Skirt', price: 24900, quantity: 1 }] });
    const open = async (width, pagePath) => {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      page.errors = [];
      page.on('pageerror', (e) => page.errors.push(e.message));
      await routeTheme(page, { root, fontsDir, harness, globalsFor: () => sf.globalsFor(), pages: sf.pages, imageSize: sf.imageSize, cartSection: sf.cartSection, cartJson: sf.cartJson });
      await page.goto(`http://dressar.test${pagePath}`);
      await page.waitForTimeout(600);
      page.closeAll = () => context.close();
      return page;
    };

    // Document direction and the RTL stylesheet.
    {
      const page = await open(390, '/');
      const doc = await page.evaluate(() => ({
        dir: document.documentElement.dir,
        rtlCss: Boolean(document.querySelector('link[href*="dsr-rtl.css"]')),
        arrow: getComputedStyle(document.querySelector('.icon-arrow')).transform,
      }));
      check(`${L} <html dir="${rtl ? 'rtl' : 'ltr'}">`, doc.dir === (rtl ? 'rtl' : 'ltr'), doc.dir);
      check(`${L} dsr-rtl.css ${rtl ? 'loaded' : 'not loaded'}`, doc.rtlCss === rtl);
      check(`${L} forward arrows point ${rtl ? 'left' : 'right'}`, rtl ? /^matrix\(-1,/.test(doc.arrow) : doc.arrow === 'none', doc.arrow);

      // A product row: starts at the reading-start edge; "next" moves on in reading order.
      const sel = '#shopify-section-template--1__dsr_row_new_arrivals';
      await page.locator(sel).scrollIntoViewIfNeeded();
      const row = await page.evaluate((s) => {
        const sec = document.querySelector(s);
        const first = sec.querySelector('.product-grid > li').getBoundingClientRect();
        const prev = sec.querySelector('.slider-button--prev').getBoundingClientRect();
        const next = sec.querySelector('.slider-button--next').getBoundingClientRect();
        return { firstLeft: first.left, firstRight: first.right, prevX: prev.left, nextX: next.left, vw: window.innerWidth, counter: sec.querySelector('.slider-counter--current').textContent.trim() };
      }, sel);
      check(
        `${L} [390] product row starts at the ${rtl ? 'right' : 'left'} page margin`,
        rtl ? near(row.vw - row.firstRight, 15, 3) : near(row.firstLeft, 15, 3),
        JSON.stringify(row)
      );
      check(`${L} [390] "next" button sits ${rtl ? 'left' : 'right'} of "previous"`, rtl ? row.nextX < row.prevX : row.nextX > row.prevX, JSON.stringify(row));
      await page.click(`${sel} .slider-button--next`);
      await page.waitForTimeout(800);
      const after = await page.evaluate((s) => {
        const sec = document.querySelector(s);
        return { scrollLeft: sec.querySelector('.slider').scrollLeft, counter: sec.querySelector('.slider-counter--current').textContent.trim(), prevDisabled: sec.querySelector('.slider-button--prev').hasAttribute('disabled') };
      }, sel);
      check(
        `${L} [390] "next" scrolls the row ${rtl ? 'leftwards (negative scrollLeft)' : 'rightwards'}, counter 1 -> 2, "previous" enabled`,
        (rtl ? after.scrollLeft < 0 : after.scrollLeft > 0) && row.counter === '1' && after.counter === '2' && !after.prevDisabled,
        JSON.stringify(after)
      );
      await page.click(`${sel} .slider-button--prev`);
      await page.waitForTimeout(800);
      const back = await page.evaluate((s) => document.querySelector(`${s} .slider-counter--current`).textContent.trim(), sel);
      check(`${L} [390] "previous" returns to 1`, back === '1', back);

      // Menu drawer opens from the reading-start side.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.click('header-drawer summary');
      await page.waitForTimeout(500);
      const drawer = await page.evaluate(() => {
        const r = document.querySelector('#menu-drawer').getBoundingClientRect();
        return { left: r.left, right: r.right, vw: window.innerWidth };
      });
      check(`${L} [390] menu drawer fills the screen from the ${rtl ? 'right' : 'left'}`, near(drawer.left, 0) && near(drawer.right, drawer.vw), JSON.stringify(drawer));
      check(`${L} no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.closeAll();
    }

    // Cart drawer: from the left on rtl pages, the right on ltr; close button at the far end.
    {
      const page = await open(1280, '/');
      await page.click('#cart-icon-bubble');
      await page.waitForTimeout(700);
      const d = await page.evaluate(() => {
        const inner = document.querySelector('.drawer__inner').getBoundingClientRect();
        const close = document.querySelector('.drawer__close').getBoundingClientRect();
        const title = document.querySelector('.drawer__heading').getBoundingClientRect();
        return { left: inner.left, right: inner.right, vw: window.innerWidth, closeX: close.left, titleX: title.left, overlap: !(close.right <= title.left || close.left >= title.right) };
      });
      check(`${L} [1280] cart drawer opens on the ${rtl ? 'left' : 'right'}`, rtl ? near(d.left, 0) : near(d.right, d.vw), JSON.stringify(d));
      check(`${L} [1280] drawer close button doesn't cover the title`, !d.overlap, JSON.stringify(d));
      await page.closeAll();
    }

    // Search field: the submit button at the end of the field, text from the start.
    {
      const page = await open(1280, '/');
      await page.click('details-modal.header__search summary');
      await page.waitForTimeout(400);
      const s = await page.evaluate(() => {
        const input = document.querySelector('.search-modal input[type="search"]');
        const field = input.getBoundingClientRect();
        const button = document.querySelector('.search-modal .search__button').getBoundingClientRect();
        const cs = getComputedStyle(input);
        return { buttonCentre: (button.left + button.right) / 2, fieldCentre: (field.left + field.right) / 2, padStart: parseFloat(cs.paddingInlineStart), padEnd: parseFloat(cs.paddingInlineEnd) };
      });
      check(`${L} [1280] search button on the ${rtl ? 'left' : 'right'} of the field`, rtl ? s.buttonCentre < s.fieldCentre : s.buttonCentre > s.fieldCentre, JSON.stringify(s));
      check(`${L} [1280] search text keeps clear of the buttons (more padding at the end)`, s.padEnd > s.padStart, JSON.stringify(s));
      await page.closeAll();
    }

    // Breadcrumbs read from the start edge.
    {
      const page = await open(390, '/products/linen-maxi-skirt-with-front-pockets');
      const b = await page.evaluate(() => {
        const items = [...document.querySelectorAll('.dsr-breadcrumbs li')].map((li) => li.getBoundingClientRect());
        const last = document.querySelector('.dsr-breadcrumbs li:last-child');
        return { firstX: items[0].left, lastX: items[items.length - 1].left, oneLine: items.every((r) => Math.abs(r.top + r.height / 2 - (items[0].top + items[0].height / 2)) < 2), clipped: last.scrollWidth > last.clientWidth };
      });
      check(`${L} [390] breadcrumbs: one line, "Home" first on the ${rtl ? 'right' : 'left'}, long title shortened`, b.oneLine && b.clipped && (rtl ? b.firstX > b.lastX : b.firstX < b.lastX), JSON.stringify(b));
      await page.closeAll();
    }
  }

  // The setting switched off: Arabic stays left to right.
  {
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale: 'ar' });
    harness.settings.rtl_enabled = false;
    const html = await harness.renderLayout(harness.globals(), '<p>page</p>');
    check('[ar] "Right-to-left layout" off: dir="ltr" and no dsr-rtl.css', /<html[^>]*dir="ltr"/.test(html) && !html.includes('dsr-rtl.css'));
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
