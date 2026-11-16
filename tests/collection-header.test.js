// Compact mobile collection header (docs/stages/collection-header.md): the
// collection banner on the real collection template, Arabic and English, at
// 360, 390 and 430px (and 1440px for the unchanged desktop).
// usage: node tests/collection-header.test.js [themeRoot] [--shots <dir>] [--measure-only]
//   --measure-only: print the header measurements without checks (used to
//   measure the theme before this change, with an older themeRoot).
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { buildCollection } = require('./lib/catalog');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const shotsArg = process.argv.indexOf('--shots');
const shotsDir = shotsArg > -1 ? process.argv[shotsArg + 1] : null;
const measureOnly = process.argv.includes('--measure-only');
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const fixturesDir = path.join(__dirname, 'fixtures');
const WIDTHS = [360, 390, 430, 1440];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

// The store's real two-language title and description (Back to University, Nov 15).
const DESCRIPTION =
  '<p>لبس الجامعة من درسر — قطع عملية بأسعار طالبة: جيب طويلة تستحمل اليوم كله، بلوزات مريحة، وأساسيات تتلبس مع بعضها طول الأسبوع. أسبوع كامل من اللوكات بـ 3 قطع.</p>' +
  '<p>University wardrobe by Dressar — practical pieces at student prices: all-day maxi skirts, comfortable blouses, and basics that mix and match through the week. A full week of looks from 3 pieces.</p>';

async function main() {
  const catalog = readJson(path.join(fixturesDir, 'catalog.json'));
  catalog.collections['back-to-university'].description = DESCRIPTION;
  const sizes = {};
  catalog.products.forEach((p) => p.media.forEach((m, i) => (sizes[`${p.handle}-${i}.jpg`] = m)));

  const browser = await chromium.launch();
  const measurements = [];
  for (const locale of ['ar', 'en.default']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    const strings = readJson(path.join(root, 'locales', `${locale}.json`));
    const harness = createHarness({ root, fixtures: path.join(fixturesDir, 'store.json'), locale });
    const pages = async (url) => {
      const m = /^\/collections\/([\w-]+)$/.exec(url.pathname);
      if (!m) return null;
      const collection = buildCollection(catalog, m[1], url.searchParams);
      const globals = harness.globals({ path: url.pathname, pageType: 'collection', overrides: { collection, __query: url.search.slice(1), __path: url.pathname } });
      const sid = url.searchParams.get('section_id');
      if (sid) return harness.renderTemplate('collection', globals, { only: sid });
      return harness.renderLayout(globals, await harness.renderTemplate('collection', globals));
    };

    for (const width of WIDTHS) {
      const tag = `${L} [${width}]`;
      const mobile = width < 750;
      const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: shotsDir ? 2 : 1, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await routeTheme(page, { root, fontsDir, harness, globalsFor: () => harness.globals(), pages, imageSize: (n) => sizes[n] });
      await page.goto('http://dressar.test/collections/back-to-university');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);

      const m = await page.evaluate(() => {
        const r = (el) => el && el.getBoundingClientRect();
        const cs = (el) => getComputedStyle(el);
        const visible = (el) => el && r(el).height > 0 && cs(el).display !== 'none' && cs(el).visibility !== 'hidden';
        const hero = document.querySelector('.collection-hero');
        const section = hero.closest('.shopify-section');
        const title = hero.querySelector('.collection-hero__title');
        const desc = hero.querySelector('.collection-hero__description');
        const toggle = hero.querySelector('.dsr-read-more__toggle');
        const crumbs = hero.querySelector('.dsr-breadcrumbs');
        // The title's visible words, as drawn (hidden parts left out).
        const range = document.createRange();
        range.selectNodeContents(title);
        const textRects = [...range.getClientRects()].filter((x) => x.width > 0);
        const textLeft = Math.min(...textRects.map((x) => x.left));
        const textRight = Math.max(...textRects.map((x) => x.right));
        const grid = section.nextElementSibling;
        const filters = [...grid.querySelectorAll('.mobile-facets__wrapper, .facets-container, facet-filters-form, .product-count')].filter(visible);
        const filterTop = filters.length ? Math.min(...filters.map((f) => r(f).top)) : null;
        const firstCard = grid.querySelector('#product-grid > li');
        const lastHeaderBottom = Math.max(...[title, desc, visible(toggle) ? toggle : null].filter(visible).map((el) => r(el).bottom));
        return {
          dir: document.documentElement.dir,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          crumbsVisible: visible(crumbs),
          crumbsJsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].some((s) => /BreadcrumbList/.test(s.textContent)),
          titleVisibleText: (() => {
            const parts = [...title.querySelectorAll('.dsr-title-part, .dsr-title-sep')];
            if (!parts.length) {
              const c = title.cloneNode(true);
              c.querySelectorAll('.visually-hidden').forEach((x) => x.remove());
              return c.textContent.replace(/\s+/g, ' ').trim();
            }
            return parts.filter((x) => cs(x).display !== 'none').map((x) => x.textContent).join('').replace(/\s+/g, ' ').trim();
          })(),
          titleFullText: title.textContent.replace(/\s+/g, ' ').trim(),
          titleSize: parseFloat(cs(title).fontSize),
          titleLineHeight: parseFloat(cs(title).lineHeight),
          titleWeight: cs(title).fontWeight,
          titleFamily: cs(title).fontFamily,
          titleLeftGap: textLeft - r(title).left,
          titleRightGap: r(title).right - textRight,
          heroTop: r(section).top,
          titleTop: r(title).top,
          titleBottom: r(title).bottom,
          descTop: desc && r(desc).top,
          descSize: desc && parseFloat(cs(desc).fontSize),
          descLineHeight: desc && parseFloat(cs(desc).lineHeight),
          descHeight: desc && r(desc).height,
          descText: desc && desc.textContent.trim(),
          toggleVisible: visible(toggle),
          toggleExpanded: toggle && toggle.getAttribute('aria-expanded'),
          toggleControls: toggle && document.getElementById(toggle.getAttribute('aria-controls')) === desc,
          headerBottom: lastHeaderBottom,
          filterTop,
          firstCardTop: firstCard && r(firstCard).top + window.scrollY,
        };
      });
      measurements.push({ locale, width, ...m });
      if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `collection-header-${rtl ? 'ar' : 'en'}-${width}.png`) });

      if (!measureOnly) {
        const parts = ['Back to University', 'لبس الجامعة'];
        check(`${tag} page direction`, m.dir === (rtl ? 'rtl' : 'ltr'));
        check(`${tag} the whole title stays in the heading (search engines)`, m.titleFullText.includes(parts[0]) && m.titleFullText.includes(parts[1]), m.titleFullText);
        check(`${tag} breadcrumb structured data kept`, m.crumbsJsonLd);
        check(`${tag} no sideways scrolling`, !m.overflow);
        check(`${tag} no JS errors`, errors.length === 0, errors.join(' | '));
        if (mobile) {
          check(`${tag} breadcrumbs hidden`, !m.crumbsVisible);
          check(`${tag} title shown once, in the page's language`, m.titleVisibleText === (rtl ? parts[1] : parts[0]), m.titleVisibleText);
          check(`${tag} title 22px, line height 1.35`, m.titleSize === 22 && Math.abs(m.titleLineHeight - 29.7) < 0.5, `${m.titleSize} ${m.titleLineHeight}`);
          if (rtl) {
            check(`${tag} title in Cairo SemiBold`, m.titleWeight === '600' && /^"?DSR Cairo/.test(m.titleFamily), `${m.titleWeight} ${m.titleFamily}`);
            check(`${tag} title from the right`, m.titleRightGap < 1, String(m.titleRightGap));
          } else {
            check(`${tag} title from the left`, m.titleLeftGap < 1, String(m.titleLeftGap));
          }
          check(`${tag} 12px above the title`, Math.abs(m.titleTop - m.heroTop - 12) < 1, String(m.titleTop - m.heroTop));
          check(`${tag} 8px from title to description`, Math.abs(m.descTop - m.titleBottom - 8) < 1, String(m.descTop - m.titleBottom));
          check(`${tag} description 13px, line height 1.5`, m.descSize === 13 && Math.abs(m.descLineHeight - 19.5) < 0.5, `${m.descSize} ${m.descLineHeight}`);
          check(`${tag} description cut to 3 lines, "Read more" shown`, m.descHeight <= 3 * 19.5 + 1 && m.toggleVisible && m.toggleExpanded === 'false' && m.toggleControls, `${m.descHeight} ${m.toggleVisible}`);
          check(`${tag} the whole description stays in the page`, m.descText.includes('University wardrobe') && m.descText.includes('لبس الجامعة من درسر'));
          check(`${tag} 20px down to the filters`, m.filterTop != null && Math.abs(m.filterTop - m.headerBottom - 20) <= 1, String(m.filterTop - m.headerBottom));
          check(`${tag} nothing overlaps`, m.descTop >= m.titleBottom && m.filterTop >= m.headerBottom);

          // Read more / Read less.
          await page.click('.dsr-read-more__toggle');
          await page.waitForTimeout(150);
          const open = await page.evaluate(() => {
            const t = document.querySelector('.dsr-read-more__toggle');
            const d = document.querySelector('.collection-hero__description');
            return { expanded: t.getAttribute('aria-expanded'), label: t.textContent.trim(), height: d.getBoundingClientRect().height, clipped: d.scrollHeight > d.clientHeight + 1 };
          });
          check(`${tag} "Read more" opens the whole description`, open.expanded === 'true' && open.height > m.descHeight && !open.clipped && open.label === strings.dressar.collection.read_less, JSON.stringify(open));
          await page.click('.dsr-read-more__toggle');
          await page.waitForTimeout(150);
          const closed = await page.evaluate(() => {
            const t = document.querySelector('.dsr-read-more__toggle');
            return { expanded: t.getAttribute('aria-expanded'), label: t.textContent.trim(), height: document.querySelector('.collection-hero__description').getBoundingClientRect().height };
          });
          check(`${tag} "Read less" closes it again`, closed.expanded === 'false' && Math.abs(closed.height - m.descHeight) < 1 && closed.label === strings.dressar.collection.read_more, JSON.stringify(closed));

          // Filters and sorting still open.
          await page.click('.mobile-facets__open-wrapper');
          await page.waitForTimeout(400);
          const drawer = await page.evaluate(() => ({
            open: Boolean(document.querySelector('menu-drawer details[open], .mobile-facets__disclosure[open]')),
            sort: Boolean(document.querySelector('.mobile-facets__sort select, #SortBy-mobile')),
          }));
          check(`${tag} the filter drawer opens, with sorting`, drawer.open && drawer.sort, JSON.stringify(drawer));
        } else {
          check(`${tag} desktop: breadcrumbs shown`, m.crumbsVisible);
          check(`${tag} desktop: the whole title shown`, m.titleVisibleText.replace(/\s+/g, ' ') === 'Back to University | لبس الجامعة', m.titleVisibleText);
          check(`${tag} desktop: title size as before (32px)`, m.titleSize === 32, String(m.titleSize));
        }
      }

      await context.close();
    }
  }
  await browser.close();

  if (measureOnly) {
    for (const m of measurements) console.log(JSON.stringify({ locale: m.locale, width: m.width, firstCardTop: Math.round(m.firstCardTop), titleTop: Math.round(m.titleTop - m.heroTop), filterTop: Math.round(m.filterTop), headerBottom: Math.round(m.headerBottom) }));
    return;
  }
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok || !r.detail ? '' : `  -> ${r.detail}`}`);
  }
  for (const m of measurements.filter((x) => x.width < 750)) console.log(`first product card at ${Math.round(m.firstCardTop)}px (${m.locale}, ${m.width}px)`);
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
