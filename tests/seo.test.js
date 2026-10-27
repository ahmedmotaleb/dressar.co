// Stage 8 SEO tests on the theme's real pages (tests/lib/theme-harness.js):
// title, canonical, one H1, structured data (valid, not duplicated, matching
// the visible breadcrumbs), image attributes and crawlable navigation.
// usage: node tests/seo.test.js [themeRoot]
'use strict';

const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const locale = process.env.LOCALE || 'en.default';
const ORIGIN = 'http://dressar.test';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

// Page, the JSON-LD types it must carry (each exactly once), its breadcrumb trail.
const PAGES = [
  { path: '/', types: ['Organization', 'WebSite'], crumbs: null },
  { path: '/collections/skirts', types: ['Organization', 'BreadcrumbList'], crumbs: ['home', 'Skirts'] },
  { path: '/products/linen-maxi-skirt-with-front-pockets', types: ['Organization', 'BreadcrumbList', 'Product'], crumbs: ['home', '@product'] },
  { path: '/collections/skirts/products/linen-maxi-skirt-with-front-pockets', types: ['Organization', 'BreadcrumbList', 'Product'], crumbs: ['home', 'Skirts', '@product'] },
  { path: '/search?q=linen', types: ['Organization'], crumbs: null },
];

async function main() {
  const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale, origin: ORIGIN });
  const sf = storefront({ root, harness });
  const strings = readJson(path.join(root, 'locales', `${locale}.json`));
  const home = strings.dressar.breadcrumbs.home;
  const productTitle = sf.catalog.products.find((p) => p.handle === 'linen-maxi-skirt-with-front-pockets').title;
  const browser = await chromium.launch();

  for (const spec of PAGES) {
    const tag = `[${spec.path}]`;
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
    await routeTheme(page, { root, fontsDir, harness, globalsFor: () => sf.globalsFor(), pages: sf.pages, imageSize: sf.imageSize });
    await page.goto(`${ORIGIN}${spec.path}`);
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => {
        try {
          return JSON.parse(s.textContent);
        } catch (e) {
          return { __invalid: s.textContent.slice(0, 120) };
        }
      });
      const nav = document.querySelector('nav.dsr-breadcrumbs');
      return {
        title: document.title.trim(),
        canonical: (document.querySelector('link[rel="canonical"]') || {}).href,
        h1: [...document.querySelectorAll('h1')].filter((h) => h.getClientRects().length).map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
        ld,
        crumbs: nav
          ? [...nav.querySelectorAll('li')].map((li) => ({
              text: li.textContent.trim(),
              href: (li.querySelector('a') || {}).href || null,
              current: li.getAttribute('aria-current'),
            }))
          : null,
        navLabel: nav && nav.getAttribute('aria-label'),
        imgs: [...document.querySelectorAll('main img')].map((i) => ({ alt: i.hasAttribute('alt'), w: i.getAttribute('width'), h: i.getAttribute('height'), src: i.getAttribute('src') })),
        links: [...document.querySelectorAll('header a[href], #menu-drawer a[href]')].map((a) => new URL(a.href).pathname),
      };
    });

    check(`${tag} has a <title>`, r.title.length > 0, r.title);
    check(`${tag} canonical link is absolute`, /^https?:\/\//.test(r.canonical || ''), r.canonical);
    check(`${tag} one visible H1`, r.h1.length === 1, r.h1.join(' | '));
    const invalid = r.ld.filter((x) => x.__invalid);
    check(`${tag} every JSON-LD block is valid JSON`, invalid.length === 0, invalid.map((x) => x.__invalid).join(' | '));
    const types = r.ld.map((x) => x['@type']).filter(Boolean);
    const counts = Object.fromEntries(spec.types.map((t) => [t, types.filter((x) => x === t).length]));
    check(`${tag} JSON-LD: ${spec.types.join(', ')}, once each`, spec.types.every((t) => counts[t] === 1) && types.length === spec.types.length, types.join(', '));

    const ldCrumbs = r.ld.find((x) => x['@type'] === 'BreadcrumbList');
    if (spec.crumbs) {
      const expected = spec.crumbs.map((c) => (c === 'home' ? home : c === '@product' ? productTitle : c));
      check(`${tag} breadcrumbs: ${expected.join(' > ')}`, r.crumbs && JSON.stringify(r.crumbs.map((c) => c.text)) === JSON.stringify(expected), JSON.stringify(r.crumbs));
      check(`${tag} breadcrumbs: labelled nav, last item is the current page and not a link`, r.navLabel === strings.dressar.breadcrumbs.label && r.crumbs.at(-1).current === 'page' && !r.crumbs.at(-1).href && r.crumbs.slice(0, -1).every((c) => c.href));
      const items = (ldCrumbs && ldCrumbs.itemListElement) || [];
      check(
        `${tag} BreadcrumbList matches the visible trail (names, positions, absolute URLs)`,
        items.length === expected.length &&
          items.every((it, i) => it.position === i + 1 && it.name === expected[i] && /^https?:\/\//.test(it.item)) &&
          r.crumbs.slice(0, -1).every((c, i) => c.href === items[i].item),
        JSON.stringify(items)
      );
    } else {
      check(`${tag} no breadcrumbs`, !r.crumbs && !ldCrumbs);
    }

    const noAlt = r.imgs.filter((i) => !i.alt);
    check(`${tag} every image in <main> has an alt attribute`, noAlt.length === 0, noAlt.map((i) => i.src).join(', '));
    const noSize = r.imgs.filter((i) => !i.w || !i.h);
    check(`${tag} every image in <main> has width and height (no layout shift)`, noSize.length === 0, noSize.map((i) => i.src).join(', '));

    // Every main-menu destination is a plain link (crawlable without JavaScript), parents included.
    const menu = harness.store.menus['main-menu'].flatMap((l) => [l, ...(l.links || [])]).map((l) => l.url);
    const missing = menu.filter((u) => !r.links.includes(u));
    check(`${tag} every main-menu URL is a plain <a href>`, missing.length === 0, missing.join(', '));
    await page.close();
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
