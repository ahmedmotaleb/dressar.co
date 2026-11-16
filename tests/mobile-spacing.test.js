// Mobile homepage spacing (docs/stages/mobile-spacing.md): product-row
// footers, the three-image media grid and the mobile header, on the real
// home template, Arabic and English, at 320, 375, 390, 430, 768 and 1440px.
// usage: node tests/mobile-spacing.test.js [themeRoot] [--shots <dir>]
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
const WIDTHS = [320, 375, 390, 430, 768, 1440];
const GRID = '1783544336b861804d';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

async function main() {
  // ---------- Schema ----------
  const fc = fs.readFileSync(path.join(root, 'sections/featured-collection.liquid'), 'utf8');
  const fcSchema = JSON.parse(/{% schema %}([\s\S]*){% endschema %}/.exec(fc)[1]);
  const compact = fcSchema.settings.find((s) => s.id === 'compact_footer');
  check('featured collection: "Compact footer" setting, on by default; "View all style" kept', compact && compact.default === true && fcSchema.settings.some((s) => s.id === 'view_all_style'));
  const mg = fs.readFileSync(path.join(root, 'blocks/ai_gen_block_4a20873.liquid'), 'utf8');
  const mgSchema = JSON.parse(/{% schema %}([\s\S]*){% endschema %}/.exec(mg)[1]);
  const ids = mgSchema.settings.filter((s) => s.id).map((s) => s.id);
  check('media grid: existing setting IDs kept, mobile settings added', ['image_large', 'image_small_1', 'image_small_2', 'desktop_width_percent', 'grid_gap', 'border_radius', 'mobile_mosaic', 'mobile_gap', 'mobile_radius'].every((id) => ids.includes(id)));

  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const sizes = {};
  catalog.products.forEach((p) => p.media.forEach((m, i) => (sizes[`${p.handle}-${i}.jpg`] = m)));
  Object.entries(catalog.collections).forEach(([h, c]) => c.image && (sizes[`collection-${h}.jpg`] = c.image));
  const browser = await chromium.launch();

  for (const locale of ['ar', 'en.default']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    const strings = readJson(path.join(root, 'locales', `${locale}.json`));
    const viewAll = strings.sections.featured_collection.view_all;
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });
    const pages = async (url) => {
      if (url.pathname !== '/') return null;
      const g = harness.globals({ path: '/', pageType: 'index', overrides: { __collections: (h) => buildCollection(catalog, h) } });
      return harness.renderLayout(g, await harness.renderTemplate('index', g));
    };
    for (const width of WIDTHS) {
      const tag = `${L} [${width}]`;
      const mobile = width < 750;
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: shotsDir ? 2 : 1, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await routeTheme(page, { root, fontsDir, harness, globalsFor: () => harness.globals(), pages, imageSize: (n) => sizes[n] });
      await page.goto('http://dressar.test/');
      await page.addStyleTag({ content: '.scroll-trigger{opacity:1!important;transform:none!important;animation:none!important}' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);

      const m = await page.evaluate((GRID) => {
        const r = (e) => e && e.getBoundingClientRect();
        const rows = [...document.querySelectorAll('.shopify-section[id*="__dsr_row_"]')].map((s) => {
          const box = s.querySelector('.collection');
          const grid = s.querySelector('.product-grid');
          const pager = s.querySelector('.slider-buttons');
          const va = s.querySelector('.collection__view-all');
          const a = va && va.querySelector('a');
          const pagerShown = pager && r(pager).height > 0 && getComputedStyle(pager).display !== 'none';
          const cs = a && getComputedStyle(a);
          const after = a && getComputedStyle(a, '::after');
          const title = s.querySelector('.collection__title');
          return {
            id: s.id.split('__')[1],
            compact: box.classList.contains('dsr-compact-footer'),
            top: title ? Math.round(r(title).top - r(box).top) : null,
            cardsToPager: pagerShown ? Math.round(r(pager).top - r(grid).bottom) : null,
            pagerToViewAll: pagerShown && va ? Math.round(r(a).top - r(pager).bottom) : null,
            viewAllToEnd: a ? Math.round(r(box).bottom - r(a).bottom) : null,
            btn: a && { h: Math.round(r(a).height), bg: cs.backgroundColor, color: cs.color, edge: after.boxShadow, text: a.textContent.trim(), href: a.getAttribute('href') },
            // Text a sighted shopper sees: everything outside .visually-hidden.
            pagerText: pager ? [...pager.querySelectorAll('*')].filter((e) => !e.closest('.visually-hidden') && r(e).width > 1).map((e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')).join('').trim() : null,
            pagerH: pagerShown ? Math.round(r(pager).height) : null,
            visibleCounter: Boolean(pager && pager.querySelector('.slider-counter')),
            status: pager && pager.querySelector('[role="status"][aria-live="polite"]') ? pager.querySelector('[role="status"]').textContent.replace(/\s+/g, ' ').trim() : null,
            sliderButtons: pagerShown ? [...pager.querySelectorAll('button')].map((b) => [Math.round(r(b).width), Math.round(r(b).height), b.getAttribute('aria-label')]) : [],
          };
        });
        const otherButtons = [...document.querySelectorAll('.button')].filter((b) => !b.closest('.dsr-compact-footer')).slice(0, 3).map((b) => getComputedStyle(b).height);
        const g = document.querySelector(`.shopify-section[id*="__${GRID}"]`);
        const items = g ? [...g.querySelectorAll('[class*="ai-media-grid-item-"]')].filter((e) => /ai-media-grid-item-\w+--/.test(e.className)) : [];
        const imgs = items.map((it) => {
          const img = it.querySelector('img');
          const b = r(it);
          return { w: b.width, h: b.height, left: b.left, right: b.right, top: b.top, radius: getComputedStyle(it).borderTopLeftRadius, fit: img && getComputedStyle(img).objectFit, fills: img && Math.abs(r(img).width - b.width) < 1 && Math.abs(r(img).height - b.height) < 1, srcset: Boolean(img && img.getAttribute('srcset')), sizes: img && img.getAttribute('sizes'), lazy: img && img.getAttribute('loading') === 'lazy', alt: img && img.hasAttribute('alt') };
        });
        const container = g && g.querySelector('[class*="ai-media-grid-container-"]');
        const next = g && g.nextElementSibling;
        const nextTitle = next && next.querySelector('.collection__title');
        const header = document.querySelector('header.header');
        const controls = header ? [...header.querySelectorAll('a, button, summary')].filter((e) => r(e).width > 0 && getComputedStyle(e).visibility !== 'hidden').map((e) => [Math.round(r(e).width), Math.round(r(e).height), Math.round(r(e).left), Math.round(r(e).right)]) : [];
        const logo = document.querySelector('.header__heading-logo, .header__heading-link img');
        const slideshowCounters = document.querySelectorAll('.shopify-section[id*="__slideshow_"] .slider-counter').length;
        return {
          slideshowCounters,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          rows,
          otherButtons,
          grid: { imgs, gap: container && getComputedStyle(container).rowGap, height: g && r(g).height, toNextTitle: g && nextTitle ? Math.round(r(nextTitle).top - r(g).bottom) : null },
          header: header && { h: Math.round(r(header).height), controls, logo: logo && [Math.round(r(logo).width), Math.round(r(logo).height)] },
        };
      }, GRID);

      check(`${tag} no sideways scrolling`, !m.overflow);
      check(`${tag} product rows found, compact footer on`, m.rows.length >= 5 && m.rows.every((x) => x.compact), m.rows.map((x) => x.id).join());
      check(`${tag} "View all": compact 40px outline button, localized, linking to the collection`, m.rows.every((x) => !x.btn || (x.btn.h === 40 && /rgba\(0, 0, 0, 0\)|transparent/.test(x.btn.bg) && /0px 0px 0px 1px/.test(x.btn.edge) && x.btn.text === viewAll && /^\/collections\//.test(x.btn.href))), JSON.stringify(m.rows.map((x) => x.btn)));
      if (mobile) {
        check(`${tag} 12px from the cards to the arrows`, m.rows.every((x) => x.cardsToPager === null || Math.abs(x.cardsToPager - 12) <= 1), JSON.stringify(m.rows.map((x) => x.cardsToPager)));
        check(`${tag} 16px from the arrows to "View all"`, m.rows.every((x) => x.pagerToViewAll === null || Math.abs(x.pagerToViewAll - 16) <= 1), JSON.stringify(m.rows.map((x) => x.pagerToViewAll)));
        check(`${tag} 24px below "View all" (section end)`, m.rows.every((x) => x.viewAllToEnd === null || Math.abs(x.viewAllToEnd - 24) <= 1), JSON.stringify(m.rows.map((x) => x.viewAllToEnd)));
        check(`${tag} 24px above the row heading`, m.rows.every((x) => x.top === null || Math.abs(x.top - 24) <= 1), JSON.stringify(m.rows.map((x) => x.top)));
        check(`${tag} arrows keep their 44px targets and labels`, m.rows.every((x) => x.sliderButtons.every(([w, h, label]) => w >= 44 && h >= 44 && label)), JSON.stringify(m.rows[0].sliderButtons));
        const [big, s1, s2] = m.grid.imgs;
        const near = (a, b, t = 1.5) => Math.abs(a - b) <= t;
        check(`${tag} media grid: first image full width at 16:9`, big && near(big.h, (big.w * 9) / 16) && near(big.w, width - 32, 2), JSON.stringify(big));
        check(`${tag} media grid: two images side by side at 3:4, equal`, s1 && s2 && near(s1.top, s2.top) && near(s1.w, s2.w) && near(s1.h, (s1.w * 4) / 3, 2), JSON.stringify([s1, s2]));
        check(`${tag} media grid: 8px gaps, 6px corners`, m.grid.gap === '8px' && m.grid.imgs.every((i) => i.radius === '6px') && near(s1.top - (big.top + big.h), 8), JSON.stringify([m.grid.gap, m.grid.imgs.map((i) => i.radius)]));
        check(`${tag} media grid: about 24px down to Complete Looks' heading`, m.grid.toNextTitle !== null && Math.abs(m.grid.toNextTitle - 24) <= 2, String(m.grid.toNextTitle));
        check(`${tag} header: 56-60px, every control at least 44px`, m.header && m.header.h >= 56 && m.header.h <= 60 && m.header.controls.every(([w, h]) => h >= 44 || w >= 100), JSON.stringify(m.header));
        check(`${tag} header: controls inside the screen`, m.header.controls.every(([, , l, r]) => l >= 0 && r <= width), JSON.stringify(m.header.controls));
      }
      check(`${tag} media grid: images cover their frame, responsive and lazy, with alt`, m.grid.imgs.length === 3 && m.grid.imgs.every((i) => i.fit === 'cover' && i.fills && i.srcset && i.sizes && i.lazy && i.alt), JSON.stringify(m.grid.imgs.map((i) => [i.fit, i.fills, i.srcset, i.lazy])));
      check(`${tag} no visible "1 / 8" counter under the product rows`, m.rows.every((x) => !x.visibleCounter && !x.pagerText), JSON.stringify(m.rows.map((x) => x.pagerText)));
      check(`${tag} arrows only: no space kept for the counter`, m.rows.every((x) => x.pagerH === null || x.pagerH <= 45), JSON.stringify(m.rows.map((x) => x.pagerH)));
      check(`${tag} screen readers still get the position`, m.rows.every((x) => x.status && /^1 \S+ \d+$/.test(x.status)), JSON.stringify(m.rows.map((x) => x.status)));
      check(`${tag} slideshow keeps its own counter`, m.slideshowCounters > 0, String(m.slideshowCounters));
      {
        const sel = '.shopify-section[id*="__dsr_row_new_arrivals"]';
        const next = page.locator(`${sel} .slider-button--next`);
        if (await next.isVisible() && await next.isEnabled()) {
          await next.click();
          await page.waitForTimeout(700);
          const after = await page.evaluate((s) => { const q = document.querySelector(s); return { status: q.querySelector('[role="status"]').textContent.replace(/\s+/g, ' ').trim(), prevOn: !q.querySelector('.slider-button--prev').disabled }; }, sel);
          check(`${tag} "next" moves the row and updates the status`, /^2 /.test(after.status) && after.prevOn, JSON.stringify(after));
        }
      }
      check(`${tag} other buttons untouched`, m.otherButtons.every((h) => h !== '40px'), m.otherButtons.join());
      check(`${tag} no JS errors`, errors.length === 0, errors.join(' | '));

      if (shotsDir && [390, 1440].includes(width)) {
        for (const [name, sel] of [['row', '.shopify-section[id*="__dsr_row_white_friday"]'], ['grid', `.shopify-section[id*="__${GRID}"]`]]) {
          await page.locator(sel).first().screenshot({ path: path.join(shotsDir, `${name}-${rtl ? 'ar' : 'en'}-${width}.png`) });
        }
      }
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
