// Collection section headings (docs/stages/heading-typography.md): the
// Featured collection and Collection list headings on the real home template,
// Arabic and English, at 360, 390, 430 and 1440px.
// usage: node tests/heading-typography.test.js [themeRoot] [--shots <dir>]
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
const WIDTHS = [360, 390, 430, 1440];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

async function main() {
  // ---------- Schema, statically ----------
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'config/settings_schema.json'), 'utf8'));
  const defs = Object.fromEntries(schema.flatMap((g) => g.settings || []).filter((d) => d.id).map((d) => [d.id, d]));
  check(
    'settings: heading Cairo, sizes, weight, line height, with the brief\'s defaults',
    defs.dsr_heading_cairo && defs.dsr_heading_cairo.default === true &&
      defs.dsr_heading_size_mobile && defs.dsr_heading_size_mobile.default === 26 &&
      defs.dsr_heading_size_desktop && defs.dsr_heading_size_desktop.default === 34 &&
      defs.dsr_heading_weight && defs.dsr_heading_weight.default === '600' &&
      defs.dsr_heading_line_height && defs.dsr_heading_line_height.default === 135
  );
  for (const file of ['featured-collection', 'collection-list']) {
    const src = fs.readFileSync(path.join(root, 'sections', `${file}.liquid`), 'utf8');
    const sec = JSON.parse(/{% schema %}([\s\S]*){% endschema %}/.exec(src)[1]);
    const align = sec.settings.find((s) => s.id === 'heading_alignment');
    check(`${file}: "Heading alignment" setting, left by default (the heading's current place)`, align && align.default === 'left' && align.options.length === 3);
    check(`${file}: existing setting IDs kept`, ['title', 'heading_size', 'color_scheme', 'padding_top', 'padding_bottom'].every((id) => sec.settings.some((s) => s.id === id)));
    check(`${file}: no campaign title in the code`, !/وايت فرايدي|White Friday/i.test(src));
  }

  const browser = await chromium.launch();
  for (const locale of ['ar', 'en.default']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });
    const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
    const sizes = {};
    catalog.products.forEach((p) => p.media.forEach((m, i) => (sizes[`${p.handle}-${i}.jpg`] = m)));
    Object.entries(catalog.collections).forEach(([h, c]) => c.image && (sizes[`collection-${h}.jpg`] = c.image));
    const pages = async (url) => {
      if (url.pathname !== '/') return null;
      const globals = harness.globals({ path: '/', pageType: 'index', overrides: { __collections: (h) => buildCollection(catalog, h) } });
      return harness.renderLayout(globals, await harness.renderTemplate('index', globals));
    };

    for (const width of WIDTHS) {
      const tag = `${L} [${width}]`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: shotsDir ? 2 : 1 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const fontRequests = [];
      page.on('request', (r) => /dsr-cairo-arabic\.woff2/.test(r.url()) && fontRequests.push(r.url()));
      // Layout shifts from the moment the page starts.
      await page.addInitScript(() => {
        window.__shifts = [];
        new PerformanceObserver((list) => list.getEntries().forEach((e) => !e.hadRecentInput && window.__shifts.push({ value: e.value, nodes: (e.sources || []).map((s) => (s.node && s.node.className) || '') })))
          .observe({ type: 'layout-shift', buffered: true });
      });
      await routeTheme(page, { root, fontsDir, harness, globalsFor: () => harness.globals(), pages, imageSize: (n) => sizes[n] });
      await page.goto('http://dressar.test/');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);

      const info = await page.evaluate(() => {
        const hs = [...document.querySelectorAll('.dsr-section-heading')];
        return {
          dir: document.documentElement.dir,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          preload: Boolean(document.querySelector('link[rel="preload"][href*="dsr-cairo-arabic"]')),
          cairo: [...document.fonts].filter((f) => f.family.replace(/["']/g, '') === 'DSR Cairo').map((f) => f.status),
          headings: hs.map((h) => {
            const cs = getComputedStyle(h);
            const r = h.getBoundingClientRect();
            const section = h.closest('.shopify-section');
            return {
              text: h.textContent.trim(),
              section: section && section.id,
              size: parseFloat(cs.fontSize),
              lineHeight: parseFloat(cs.lineHeight),
              weight: cs.fontWeight,
              family: cs.fontFamily,
              synthesis: cs.fontSynthesis || cs.fontSynthesisWeight,
              align: cs.textAlign,
              letterSpacing: cs.letterSpacing,
              lines: Math.round(r.height / parseFloat(cs.lineHeight)),
              fits: h.scrollWidth <= h.clientWidth + 1 && r.left >= -1 && r.right <= window.innerWidth + 1,
              arabic: /[؀-ۿ]/.test(h.textContent),
            };
          }),
          // Latin-only headings: as wide as the same text in the theme heading face itself (Poppins 200).
          latin: hs.filter((h) => !/[\u0600-\u06FF]/.test(h.textContent)).map((h) => {
            const cs = getComputedStyle(h);
            const ref = document.createElement('span');
            ref.textContent = h.textContent.trim();
            ref.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-family:Poppins;font-weight:200;font-size:${cs.fontSize};letter-spacing:${cs.letterSpacing}`;
            const probe = ref.cloneNode(true);
            probe.style.fontFamily = cs.fontFamily;
            probe.style.fontWeight = cs.fontWeight;
            probe.style.fontSynthesis = 'none';
            document.body.append(ref, probe);
            const out = [ref.getBoundingClientRect().width, probe.getBoundingClientRect().width];
            ref.remove();
            probe.remove();
            return out;
          }),
          cardTitles: [...document.querySelectorAll('.card__heading')].slice(0, 3).map((c) => c.classList.contains('dsr-section-heading')),
        };
      });
      const hs = info.headings;
      const size = width < 750 ? 26 : 34;
      check(`${tag} page direction`, info.dir === (rtl ? 'rtl' : 'ltr'), info.dir);
      check(`${tag} headings found (Featured collection rows and the Collection list)`, hs.length >= 5 && hs.some((h) => /collection_list/.test(h.section || '')), hs.map((h) => h.section).join());
      check(`${tag} size ${size}px`, hs.every((h) => h.size === size), hs.map((h) => h.size).join());
      check(`${tag} line height 1.35`, hs.every((h) => Math.abs(h.lineHeight - size * 1.35) < 0.6), hs.map((h) => h.lineHeight).join());
      check(`${tag} weight 600`, hs.every((h) => h.weight === '600'), hs.map((h) => h.weight).join());
      check(`${tag} Cairo first, then the theme heading font`, hs.every((h) => /^"?DSR Cairo"?, "?DSR Heading Latin"?, Poppins/.test(h.family)), hs[0] && hs[0].family);
      check(`${tag} no faked bold on Latin letters`, hs.every((h) => /none/.test(h.synthesis || '')), hs.map((h) => h.synthesis).join());
      if (rtl) {
        check(`${tag} Arabic: right-aligned`, hs.every((h) => h.align === 'right'), hs.map((h) => h.align).join());
        check(`${tag} Arabic: normal letter spacing`, hs.every((h) => h.letterSpacing === 'normal'), hs.map((h) => h.letterSpacing).join());
        check(`${tag} Arabic: Cairo preloaded and loaded`, info.preload && info.cairo.includes('loaded') && fontRequests.length >= 1, JSON.stringify([info.preload, info.cairo, fontRequests.length]));
      } else {
        check(`${tag} English: the section's alignment (left by default)`, hs.every((h) => h.align === 'left'), hs.map((h) => h.align).join());
        check(`${tag} English: no Cairo preload`, !info.preload);
      }
      check(`${tag} Latin letters keep the theme heading face (no bolder Poppins)`, info.latin.length > 0 && info.latin.every(([a, b]) => Math.abs(a - b) < 1), JSON.stringify(info.latin));
      check(`${tag} headings fit, at most two lines`, hs.every((h) => h.fits && h.lines <= 2), JSON.stringify(hs.map((h) => [h.text.slice(0, 24), h.lines, h.fits])));
      check(`${tag} no sideways scrolling`, !info.overflow);
      check(`${tag} product titles untouched`, info.cardTitles.length > 0 && info.cardTitles.every((x) => !x));
      const shifts = await page.evaluate(() => window.__shifts);
      const headingShift = shifts.filter((s) => s.nodes.some((n) => /dsr-section-heading|title-wrapper|collection__title/.test(String(n)))).reduce((n, s) => n + s.value, 0);
      check(`${tag} no layout shift from the headings`, headingShift < 0.01, JSON.stringify(shifts));
      check(`${tag} no JS errors`, errors.length === 0, errors.join(' | '));
      if (shotsDir) {
        await page.evaluate(() => {
          const h = document.querySelector('[id*="dsr_row_white_friday"] .dsr-section-heading') || document.querySelector('.dsr-section-heading');
          window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 140);
        });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(shotsDir, `heading-${rtl ? 'ar' : 'en'}-${width}.png`) });
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
