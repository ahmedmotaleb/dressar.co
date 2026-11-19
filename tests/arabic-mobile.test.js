// Arabic mobile home page (docs/stages/arabic-mobile.md): no visible slide
// counters, two whole product cards per phone screen, RTL edges and order,
// slideshow arrows over the image, the multicolumn as a list on phones.
// Real home template, Arabic and English, 320 to 1440px.
// usage: node tests/arabic-mobile.test.js [themeRoot] [--shots <dir>]
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
const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1440];
const ROWS = ['dsr_row_white_friday', 'dsr_row_new_arrivals', 'dsr_row_best_sellers', 'dsr_row_complete_looks', 'dsr_row_back_to_uni'];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

async function main() {
  // ---------- Template and schema ----------
  const tpl = JSON.parse(fs.readFileSync(path.join(root, 'templates/index.json'), 'utf8').replace(/^\/\*[\s\S]*?\*\//, ''));
  check('template: every home product row uses 2 columns on phones', ROWS.every((id) => tpl.sections[id].settings.columns_mobile === '2'), ROWS.map((id) => tpl.sections[id].settings.columns_mobile).join());
  check('template: product rows keep their collections, titles and links', ROWS.every((id) => tpl.sections[id].settings.collection && tpl.sections[id].settings.show_view_all));
  check('template: multicolumn uses the List layout on phones', tpl.sections.multicolumn_YVGgni.settings.mobile_layout === 'list');
  const mc = fs.readFileSync(path.join(root, 'sections/multicolumn.liquid'), 'utf8');
  const mcSchema = JSON.parse(/{% schema %}([\s\S]*){% endschema %}/.exec(mc)[1]);
  const ml = mcSchema.settings.find((s) => s.id === 'mobile_layout');
  check('multicolumn: "Mobile layout" setting, Carousel by default', ml && ml.default === 'carousel' && ml.options.map((o) => o.value).join() === 'carousel,list');
  for (const f of ['sections/featured-collection.liquid', 'sections/slideshow.liquid', 'sections/multicolumn.liquid']) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    check(`${f}: no visible "1 / n" counter markup left`, !/<span aria-hidden="true"> \/ <\/span>/.test(src) && src.includes("render 'dsr-slider-status'"));
  }
  check('product galleries keep their counters', fs.readFileSync(path.join(root, 'snippets/product-media-gallery.liquid'), 'utf8').includes('slider-counter--current'));

  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const sizes = {};
  catalog.products.forEach((p) => p.media.forEach((m, i) => (sizes[`${p.handle}-${i}.jpg`] = m)));
  Object.entries(catalog.collections).forEach(([h, c]) => c.image && (sizes[`collection-${h}.jpg`] = c.image));
  const browser = await chromium.launch();

  for (const locale of ['ar', 'en.default']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
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

      const m = await page.evaluate((ROWS) => {
        const r = (e) => e.getBoundingClientRect();
        const shown = (e) => { const b = r(e); const cs = getComputedStyle(e); return b.width > 1 && b.height > 1 && cs.visibility !== 'hidden' && !e.closest('.visually-hidden'); };
        // Visible text like "1 / 8", "8/1", "1 من 3", "1 of 2" anywhere on the page.
        const counters = [...document.querySelectorAll('main *')].filter((e) => shown(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && /^\s*\d+\s*(\/|من|of)\s*\d+\s*$/.test(e.textContent)).map((e) => e.textContent.trim());
        const rows = ROWS.map((id) => {
          const s = document.querySelector(`.shopify-section[id*="__${id}"]`);
          const grid = s.querySelector('.product-grid');
          const items = [...grid.children];
          const vw = innerWidth;
          // What a shopper can see: the row's own (clipped) box, within the screen.
          const g = r(grid);
          const clipL = Math.max(0, g.left), clipR = Math.min(vw, g.right);
          const boxes = items.map((li) => r(li));
          const inView = boxes.filter((b) => b.right > clipL + 0.5 && b.left < clipR - 0.5);
          const full = inView.filter((b) => b.left >= clipL - 0.5 && b.right <= clipR + 0.5);
          const li = items[0];
          // Everything visible inside the first two cards stays inside its card. (Dawn's
          // hidden duplicate of the card text sits fully outside the card, clipped.)
          const spill = items.slice(0, 2).flatMap((it) => { const c = r(it); return [...it.querySelectorAll('*')].filter((e) => shown(e) && !e.closest('.visually-hidden')).filter((e) => { const b = r(e); let L = b.left, R = b.right;
            // Apply clipping by ancestors (overflow hidden/clip) up to the card.
            for (let p = e.parentElement; p && p !== it; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.overflowX !== 'visible') { const pb = r(p); L = Math.max(L, pb.left); R = Math.min(R, pb.right); } }
            return R - L > 1 && (L < c.left - 1 || R > c.right + 1); }).map((e) => { const b = r(e); return `${(e.className || e.tagName).toString().slice(0, 30)}:${Math.round(b.left - c.left)}/${Math.round(b.right - c.right)}`; }); });
          // Size boxes: every one shown is whole inside its row ("+N" for the rest).
          const sizeCut = items.slice(0, 2).flatMap((it) => [...it.querySelectorAll('.dsr-card-sizes')].flatMap((ul) => { const u = r(ul); return [...ul.children].filter((x) => !x.hidden && r(x).width > 0).filter((x) => { const b = r(x); return b.left < u.left - 0.5 || b.right > u.right + 0.5; }).map((x) => x.textContent.trim()); }));
          const more = items.slice(0, 2).map((it) => { const m = it.querySelector('.dsr-card-sizes__more:not([hidden])'); return m ? m.textContent.replace(/\s+/g, ' ').trim() : ''; });
          // Each name starts at its own start: English-first names on the left,
          // Arabic-first names on the right; only the end may be cut ("…").
          const titleCut = items.slice(0, 4).map((it) => it.querySelector('.dsr-card-title')).filter(Boolean).filter((t) => {
            const text = t.textContent.trim(); const ltr = /^[^A-Za-z\u0600-\u06FF]*[A-Za-z]/.test(text);
            const rg = document.createRange(); rg.selectNodeContents(t); const tr = rg.getBoundingClientRect(); const box = r(t);
            return ltr ? tr.left < box.left - 0.5 : tr.right > box.right + 0.5;
          }).map((t) => t.textContent.trim().slice(0, 20));
          const media = li.querySelector('.card__media, .media');
          const status = s.querySelector('[role="status"][aria-live="polite"]');
          return {
            id,
            count: items.length,
            inView: inView.length,
            full: full.length,
            widths: full.map((b) => Math.round(b.width)),
            gap: boxes.length > 1 ? Math.round(Math.abs(boxes[1].left - boxes[0].left) - boxes[0].width) : null,
            startEdge: Math.round(document.documentElement.dir === 'rtl' ? vw - boxes[0].right : boxes[0].left),
            secondSide: boxes.length > 1 ? (boxes[1].left < boxes[0].left ? 'left' : 'right') : null,
            spill,
            sizeCut,
            titleCut,
            more,
            ratio: media ? +(r(media).height / r(media).width).toFixed(3) : null,
            status: status && status.textContent.replace(/\s+/g, ' ').trim(),
            title: s.querySelector('.collection__title h2') && s.querySelector('.collection__title h2').textContent.trim(),
          };
        });
        const shows = [...document.querySelectorAll('.shopify-section[id*="__slideshow_"]')].map((s) => {
          const sl = s.querySelector('.slideshow'), bar = s.querySelector('.slideshow__controls');
          const btns = bar ? [...bar.querySelectorAll('.slider-button')].filter(shown).map((b) => [Math.round(r(b).width), Math.round(r(b).height), b.getAttribute('aria-label')]) : [];
          const bs = bar ? [...bar.querySelectorAll('.slider-button')].filter(shown).map((b) => r(b)).sort((a, b) => a.left - b.left) : [];
          return { between: bs.length === 2 ? Math.round(bs[1].left - bs[0].right) : null, counterBox: bar ? [...bar.querySelectorAll('.slider-counter')].filter((e) => r(e).width > 0).length : null, overlay: bar ? bar.classList.contains('dsr-slideshow-arrows') : null, inside: bar && sl ? r(bar).bottom <= r(sl).bottom + 0.5 && r(bar).top >= r(sl).top : null, sectionToImage: sl ? Math.round(r(s).bottom - r(sl).bottom) : null, btns };
        });
        const mcs = document.querySelector('.shopify-section[id*="__multicolumn_"]');
        const mcItems = mcs ? [...mcs.querySelectorAll('.multicolumn-list__item')].map((it) => { const img = it.querySelector('.multicolumn-card__image-wrapper'), info = it.querySelector('.multicolumn-card__info'); return { img: img && Math.round(r(img).width), info: info && Math.round(r(info).width), imgEdge: img && Math.round(Math.min(r(img).left, innerWidth - r(img).right)), imgLeft: img && r(img).left, infoLeft: info && r(info).left, align: info && getComputedStyle(info).textAlign }; }) : [];
        return {
          dir: document.documentElement.dir,
          overflow: document.documentElement.scrollWidth > innerWidth,
          counters,
          rows,
          shows,
          mc: { items: mcItems, list: Boolean(mcs && mcs.querySelector('.dsr-mc-list')), slider: Boolean(mcs && [...mcs.querySelectorAll('.slider-buttons')].some(shown)) },
        };
      }, ROWS);

      check(`${tag} page direction ${rtl ? 'rtl' : 'ltr'}`, m.dir === (rtl ? 'rtl' : 'ltr'), m.dir);
      check(`${tag} no sideways scrolling`, !m.overflow);
      check(`${tag} no visible numeric slide counter anywhere on the page`, m.counters.length === 0, m.counters.join(' | '));
      check(`${tag} carousels still announce the position to screen readers`, m.rows.every((x) => x.status && /^1 \S+ \d+$/.test(x.status)), JSON.stringify(m.rows.map((x) => x.status)));
      check(`${tag} product names never lose their first letters (mixed Arabic/English)`, m.rows.every((x) => x.titleCut.length === 0), JSON.stringify(m.rows.map((x) => x.titleCut)));
      check(`${tag} no size box cut off at the card edge`, m.rows.every((x) => x.sizeCut.length === 0), JSON.stringify(m.rows.map((x) => x.sizeCut)));
      check(`${tag} sizes that don't fit become "+N" with a screen-reader label`, m.rows.every((x) => x.more.every((t) => t === '' || /^\+\d+\D/.test(t))), JSON.stringify(m.rows.map((x) => x.more)));
      check(`${tag} product cards keep a 3:4 image`, m.rows.every((x) => Math.abs(x.ratio - 4 / 3) < 0.02), JSON.stringify(m.rows.map((x) => x.ratio)));
      check(`${tag} nothing spills out of the first two cards`, m.rows.every((x) => x.spill.length === 0), JSON.stringify(m.rows.map((x) => x.spill.slice(0, 3))));
      if (mobile) {
        check(`${tag} every row: exactly two whole cards on screen, no third card peeking`, m.rows.every((x) => x.inView === 2 && x.full === 2), JSON.stringify(m.rows.map((x) => [x.inView, x.full])));
        check(`${tag} the two cards are the same width, 8px apart`, m.rows.every((x) => x.widths.length === 2 && Math.abs(x.widths[0] - x.widths[1]) <= 1 && Math.abs(x.gap - 8) <= 1), JSON.stringify(m.rows.map((x) => [x.widths, x.gap])));
        check(`${tag} first card 16px from the ${rtl ? 'right' : 'left'} (reading start) edge`, m.rows.every((x) => Math.abs(x.startEdge - 16) <= 1), JSON.stringify(m.rows.map((x) => x.startEdge)));
        check(`${tag} second card follows reading order (${rtl ? 'to the left' : 'to the right'})`, m.rows.every((x) => x.secondSide === (rtl ? 'left' : 'right')), JSON.stringify(m.rows.map((x) => x.secondSide)));
        check(`${tag} multicolumn: list rows, image beside text, no swipe arrows`, m.mc.list && !m.mc.slider && m.mc.items.length === 3 && m.mc.items.every((i) => i.img === 88 && i.info >= width - 32 - 88 - 14 - 2 && i.imgEdge >= 15), JSON.stringify(m.mc));
        check(`${tag} multicolumn: image at the reading start, text aligned to start`, m.mc.items.every((i) => (rtl ? i.imgLeft > i.infoLeft : i.imgLeft < i.infoLeft) && i.align === 'start'), JSON.stringify(m.mc.items.map((i) => [i.imgLeft, i.infoLeft, i.align])));
      } else {
        check(`${tag} desktop and tablet rows: more than two cards on screen, as before`, m.rows.every((x) => x.inView >= 2 && x.widths.every((w) => w > 160)), JSON.stringify(m.rows.map((x) => [x.inView, x.widths])));
      }
      check(`${tag} slideshows: arrows over the image, no bar reserved below it`, m.shows.length === 2 && m.shows.every((s) => s.overlay && s.inside && s.sectionToImage <= 1), JSON.stringify(m.shows));
      check(`${tag} slideshows: the two arrows sit together (no empty counter box between)`, m.shows.every((s) => s.counterBox === 0 && s.between !== null && s.between <= 12), JSON.stringify(m.shows.map((s) => [s.between, s.counterBox])));
      check(`${tag} slideshow arrows: 44px targets with labels`, m.shows.every((s) => s.btns.length === 2 && s.btns.every(([w, h, l]) => w >= 44 && h >= 44 && l)), JSON.stringify(m.shows.map((s) => s.btns)));

      // Swipe / arrows still move the rows in reading order.
      if (mobile) {
        const sel = '.shopify-section[id*="__dsr_row_new_arrivals"]';
        const before = await page.evaluate((s) => document.querySelector(`${s} .product-grid`).scrollLeft, sel);
        // No arrows on phones: the row moves by swipe (a horizontal scroll), card by card.
        const pagerShown = await page.evaluate((s) => { const p = document.querySelector(`${s} .slider-buttons`); return !!p && p.getBoundingClientRect().height > 0; }, sel);
        check(`${tag} no arrows under the row (swipe instead)`, !pagerShown);
        await page.evaluate((s) => { const g = document.querySelector(`${s} .product-grid`); const w = g.children[0].getBoundingClientRect().width + 8; g.scrollBy({ left: (document.documentElement.dir === 'rtl' ? -1 : 1) * w, behavior: 'instant' }); }, sel);
        await page.waitForTimeout(700);
        const after = await page.evaluate((s) => {
          const q = document.querySelector(s); const g = q.querySelector('.product-grid'); const vw = innerWidth;
          const full = [...g.children].map((li) => li.getBoundingClientRect()).filter((b) => { const gr = g.getBoundingClientRect(); const l = Math.max(0, gr.left), rr = Math.min(vw, gr.right); return b.left >= l - 0.5 && b.right <= rr + 0.5; }).length;
          return { scrollLeft: g.scrollLeft, full, status: q.querySelector('[role="status"]').textContent.replace(/\s+/g, ' ').trim() };
        }, sel);
        check(`${tag} a swipe moves the row ${rtl ? 'leftwards' : 'rightwards'} by one card, two whole cards still on screen`, (rtl ? after.scrollLeft < before : after.scrollLeft > before) && after.full === 2 && /^2 /.test(after.status), JSON.stringify({ before, ...after }));
        // A touch-style scroll (what a swipe does) snaps to whole cards too.
        await page.evaluate((s) => { const g = document.querySelector(`${s} .product-grid`); g.scrollBy({ left: (document.documentElement.dir === 'rtl' ? -1 : 1) * 60, behavior: 'instant' }); }, '.shopify-section[id*="__dsr_row_best_sellers"]');
        await page.waitForTimeout(700);
        const snapped = await page.evaluate((s) => { const g = document.querySelector(`${s} .product-grid`); const vw = innerWidth; const gr = g.getBoundingClientRect(); const l = Math.max(0, gr.left), rr = Math.min(vw, gr.right); return [...g.children].map((li) => li.getBoundingClientRect()).filter((b) => b.right > l + 0.5 && b.left < rr - 0.5).length; }, '.shopify-section[id*="__dsr_row_best_sellers"]');
        check(`${tag} a short swipe snaps back to two whole cards`, snapped === 2, String(snapped));
      }
      check(`${tag} no JS errors`, errors.length === 0, errors.join(' | '));

      if (shotsDir && [320, 390, 1440].includes(width)) {
        for (const id of ['dsr_row_new_arrivals', 'dsr_row_white_friday', 'slideshow_ATRpFY', 'multicolumn_YVGgni']) {
          await page.locator(`.shopify-section[id*="__${id}"]`).first().screenshot({ path: path.join(shotsDir, `${id}-${rtl ? 'ar' : 'en'}-${width}.png`) });
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
