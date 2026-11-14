// Stage 8 runtime performance checks on the theme's real pages, rendered by
// tests/lib/theme-harness.js and loaded in Chromium at phone size with the CPU
// slowed 4x. Photos are placeholders and no app or third-party script runs, so
// the timings describe the theme's own HTML, CSS and JavaScript only; they are
// not a Lighthouse score for the store. Prints a metrics table and checks:
// the LCP element is never lazy-loaded, layout shift stays under 0.1, no script
// or stylesheet is included twice, and the head holds no unexpected blocking CSS.
// usage: node tests/perf.test.js [themeRoot]
'use strict';

const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const locale = process.env.LOCALE || 'en.default';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

const PAGES = ['/', '/collections/skirts', '/products/linen-maxi-skirt-with-front-pockets'];
// Stylesheets the layout links in <head> that block rendering: Dawn's base,
// the cart drawer's (the drawer is on every page), the localization form's
// (preloaded), and the right-to-left layer on Arabic pages. Others in <head>
// load with media="print" and switch on load, so they don't block.
const HEAD_CSS = /\/(base|component-cart-drawer|component-cart|component-totals|component-price|component-discounts|dsr-cart|dsr-rtl|component-localization-form)\.css/;

// A detailed placeholder photo. Flat-colour placeholders are "low-content"
// images that Chromium leaves out of LCP, which would hide the real LCP image.
function detailedPhoto(w, h, seed) {
  let x = seed || 1;
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  let rects = '';
  for (let i = 0; i < 600; i++) {
    const c = Math.floor(rnd() * 200 + 40);
    rects += `<rect x="${(rnd() * w).toFixed(0)}" y="${(rnd() * h).toFixed(0)}" width="${(rnd() * w * 0.2).toFixed(0)}" height="${(rnd() * h * 0.2).toFixed(0)}" fill="rgb(${c},${c - 20},${c - 35})"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#c9bba9"/>${rects}</svg>`;
}

async function main() {
  const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });
  const sf = storefront({ root, harness });
  const browser = await chromium.launch();
  const rows = [];

  for (const pagePath of PAGES) {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(() => {
      window.__perf = { lcp: null, cls: 0, longTasks: [] };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__perf.lcp = e;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__perf.longTasks.push(e.duration);
      }).observe({ type: 'longtask', buffered: true });
    });
    const requests = [];
    page.on('response', async (res) => {
      const url = new URL(res.url());
      if (url.pathname.startsWith('/assets/')) {
        const body = await res.body().catch(() => Buffer.alloc(0));
        requests.push({ path: url.pathname, bytes: body.length, type: url.pathname.split('.').pop() });
      }
    });
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    await routeTheme(page, { root, fontsDir, harness, globalsFor: () => sf.globalsFor(), pages: sf.pages, imageSize: sf.imageSize });
    // Registered last, so it answers photo requests before routeTheme does.
    await page.route(/\/img\/(?!Full_Lookup)/, (route) => {
      const name = new URL(route.request().url()).pathname.split('/').pop();
      const [w, h] = sf.imageSize(name) || [1600, 1000];
      let seed = 0;
      for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: detailedPhoto(w, h, seed || 7) });
    });
    // The page's own HTML, as the server sends it, for the <head> checks.
    const serverHtml = await sf.pages(new URL(`http://dressar.test${pagePath}`));
    const head = serverHtml.slice(0, serverHtml.indexOf('</head>'));
    const blockingCss = [...head.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)]
      .map((t) => t[0])
      .filter((t) => !/media="print"/.test(t))
      .map((t) => (/href="([^"]+)"/.exec(t) || [])[1]);
    await page.goto(`http://dressar.test${pagePath}`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => {
      const lcp = window.__perf.lcp;
      const el = lcp && lcp.element;
      const nav = performance.getEntriesByType('navigation')[0];
      const scripts = [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'));
      return {
        lcpTime: lcp ? Math.round(lcp.startTime) : null,
        lcpTag: el ? `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}` : null,
        lcpLazy: el && el.tagName === 'IMG' ? el.getAttribute('loading') === 'lazy' : false,
        lcpPriority: el && el.tagName === 'IMG' ? el.getAttribute('fetchpriority') : null,
        cls: Math.round(window.__perf.cls * 1000) / 1000,
        tbt: Math.round(window.__perf.longTasks.reduce((a, d) => a + Math.max(0, d - 50), 0)),
        dcl: Math.round(nav.domContentLoadedEventEnd),
        dom: document.querySelectorAll('*').length,
        scripts,
        dupScripts: scripts.filter((s, i) => scripts.indexOf(s) !== i),
        inlineScripts: document.querySelectorAll('main script:not([src]):not([type="application/ld+json"])').length,
        aiBlocks: document.querySelectorAll('main [class*="aigenblock"], main [class*="ai-"]').length,
      };
    });
    const js = requests.filter((r) => r.type === 'js');
    const css = requests.filter((r) => r.type === 'css');
    rows.push({ page: pagePath, ...m, jsFiles: js.length, jsKB: Math.round(js.reduce((a, r) => a + r.bytes, 0) / 1024), cssFiles: css.length, cssKB: Math.round(css.reduce((a, r) => a + r.bytes, 0) / 1024) });

    const tag = `[390, CPU 4x] ${pagePath}`;
    check(`${tag} LCP element is not lazy-loaded`, !m.lcpLazy, `${m.lcpTag} loading=lazy`);
    check(`${tag} cumulative layout shift under 0.1`, m.cls < 0.1, String(m.cls));
    check(`${tag} no script included twice`, m.dupScripts.length === 0, m.dupScripts.join(', '));
    const unexpected = blockingCss.filter((h) => !HEAD_CSS.test(h));
    check(`${tag} no unexpected render-blocking stylesheet in <head>`, unexpected.length === 0, unexpected.join(', '));
    check(`${tag} no JS errors`, page.errors.length === 0, page.errors.join(' | '));
    if (pagePath !== '/collections/skirts') check(`${tag} the LCP element is the main photo, fetched with high priority`, m.lcpTag && m.lcpTag.startsWith('img') && m.lcpPriority === 'high', `${m.lcpTag} ${m.lcpPriority}`);
    else check(`${tag} the LCP element is a product photo`, m.lcpTag && m.lcpTag.startsWith('img'), m.lcpTag);
    await context.close();
  }

  await browser.close();
  console.log('\npage | LCP element | LCP ms | CLS | TBT ms | DCL ms | DOM elements | JS files / KB | CSS files / KB | inline scripts in main');
  for (const r of rows) {
    console.log(`${r.page} | ${r.lcpTag}${r.lcpPriority ? ` (fetchpriority=${r.lcpPriority})` : ''} | ${r.lcpTime} | ${r.cls} | ${r.tbt} | ${r.dcl} | ${r.dom} | ${r.jsFiles} / ${r.jsKB} | ${r.cssFiles} / ${r.cssKB} | ${r.inlineScripts}`);
  }
  console.log('');
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
