// Stage 9 regression matrix, on the theme's real pages rendered by
// tests/lib/theme-harness.js: every page type at seven widths, for the
// release quality gates (no overflow, no JS errors, no missing theme assets,
// one header / announcement bar / cart drawer / WhatsApp button), plus the
// global flows the other suites don't cover: search without results, 404,
// contact and newsletter forms, language switch, account link, cart count
// and the checkout handoff.
// usage: node tests/regression.test.js [themeRoot]
'use strict';

const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const locale = process.env.LOCALE || 'en.default';
const WIDTHS = [360, 390, 430, 768, 990, 1280, 1440];
const PAGES = [
  '/',
  '/collections/skirts',
  '/collections/empty',
  '/products/linen-maxi-skirt-with-front-pockets',
  '/products/linen-suit',
  '/search?q=linen',
  '/search?q=zzzz',
  '/cart',
  '/pages/contact',
  '/404',
];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

async function main() {
  const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });
  const lines = [{ handle: 'linen-maxi-skirt-with-front-pockets', title: 'Linen Skirt', price: 24900, quantity: 2 }];
  const sf = storefront({ root, harness, cartLines: lines });
  const strings = readJson(path.join(root, 'locales', `${locale}.json`));
  const t = (key, vars = {}) => String(key.split('.').reduce((o, k) => (o == null ? o : o[k]), strings)).replace(/{{\s*(\w+)\s*}}/g, (_, k) => vars[k] ?? '');
  const browser = await chromium.launch();

  // Quality gates, every page at every width.
  for (const pagePath of PAGES) {
    const failures = { overflow: [], errors: [], missing: [], dupes: [] };
    for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
      await routeTheme(page, { root, fontsDir, harness, globalsFor: () => sf.globalsFor(), pages: sf.pages, imageSize: sf.imageSize, cartSection: sf.cartSection, cartJson: sf.cartJson });
      await page.goto(`http://dressar.test${pagePath}`);
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => {
        const visible = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length;
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          headers: document.querySelectorAll('.section-header').length,
          announcements: document.querySelectorAll('.announcement-bar-section').length,
          drawers: document.querySelectorAll('cart-drawer').length,
          whatsapp: visible('.dsr-wa'),
          mains: document.querySelectorAll('main').length,
          footers: document.querySelectorAll('footer.footer').length,
        };
      });
      if (r.overflow > 0) failures.overflow.push(`${width}:${r.overflow}px`);
      if (errors.length) failures.errors.push(`${width}: ${errors.join(' ; ')}`);
      const missing = (page.missing || []).filter((p) => p.startsWith('/assets/'));
      if (missing.length) failures.missing.push(`${width}: ${missing.join(', ')}`);
      const one = ['headers', 'announcements', 'drawers', 'mains', 'footers'].filter((k) => r[k] !== 1);
      if (one.length || r.whatsapp > 1) failures.dupes.push(`${width}: ${JSON.stringify(r)}`);
      await context.close();
    }
    check(`${pagePath}: no horizontal overflow at 360-1440`, failures.overflow.length === 0, failures.overflow.join(' '));
    check(`${pagePath}: no JS errors`, failures.errors.length === 0, failures.errors.join(' | '));
    check(`${pagePath}: every theme asset requested exists`, failures.missing.length === 0, failures.missing.join(' | '));
    check(`${pagePath}: one header, announcement bar, main, footer and cart drawer; at most one WhatsApp button`, failures.dupes.length === 0, failures.dupes.join(' | '));
  }

  const open = async (width, pagePath) => {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    await routeTheme(page, { root, fontsDir, harness, globalsFor: () => sf.globalsFor(), pages: sf.pages, imageSize: sf.imageSize, cartSection: sf.cartSection, cartJson: sf.cartJson });
    await page.goto(`http://dressar.test${pagePath}`);
    await page.waitForTimeout(500);
    page.closeAll = () => context.close();
    return page;
  };

  // Header: account link, cart count, announcement.
  {
    const page = await open(390, '/');
    const h = await page.evaluate(() => ({
      // Dawn 16 with new customer accounts: Shopify's <shopify-account> element, with the account menu.
      account: (document.querySelector('shopify-account.header__icon--account') || {}).getAttribute?.('menu'),
      count: (document.querySelector('#cart-icon-bubble .cart-count-bubble span[aria-hidden]') || {}).textContent,
      announcement: (document.querySelector('.announcement-bar__message') || {}).textContent?.trim(),
      announcementLink: (document.querySelector('.announcement-bar__link') || {}).getAttribute?.('href'),
    }));
    check('[390] header has the customer account entry (shopify-account, account menu)', h.account === 'customer-account-main-menu', h.account);
    check('[390] cart count bubble shows the cart quantity (2)', (h.count || '').trim() === '2', h.count);
    check('[390] announcement bar shows its message', Boolean(h.announcement), h.announcement);
    await page.closeAll();
  }

  // Search without results.
  {
    const page = await open(390, '/search?q=zzzz');
    const s = await page.evaluate(() => ({ cards: document.querySelectorAll('.product-grid > li').length, text: document.querySelector('main').textContent.replace(/\s+/g, ' ') }));
    const expected = t('templates.search.no_results', { terms: 'zzzz' }).replace(/<[^>]+>/g, '');
    check('[390] search with no results: no cards and the "no results" message', s.cards === 0 && s.text.includes(expected.trim()), expected);
    await page.closeAll();
  }

  // 404.
  {
    const page = await open(390, '/404');
    const p = await page.evaluate(() => ({ h1: (document.querySelector('main h1') || {}).textContent?.trim(), link: (document.querySelector('main a.button') || {}).getAttribute?.('href') }));
    check('[390] 404 page: heading and a way back to shopping', p.h1 === t('templates.404.title') && p.link === '/collections/all', JSON.stringify(p));
    await page.closeAll();
  }

  // Forms: contact page, newsletter, language switch.
  {
    const page = await open(390, '/pages/contact');
    const f = await page.evaluate(() => {
      const form = document.querySelector('form#ContactForm');
      const fields = form ? [...form.querySelectorAll('input:not([type="hidden"]), textarea')] : [];
      const named = fields.every((el) => (el.labels && el.labels.length) || el.getAttribute('aria-label'));
      const news = document.querySelector('form.newsletter-form');
      const lang = document.querySelector('localization-form form, form[action*="localization"]');
      return {
        contact: form && form.getAttribute('action'),
        contactFields: fields.map((el) => el.name),
        textarea: form ? form.querySelectorAll('textarea[name^="contact["]').length : 0,
        named,
        news: news && news.getAttribute('action'),
        newsEmail: news && news.querySelector('input[type="email"][name="contact[email]"][required]') !== null,
        newsTag: news && (news.querySelector('input[name="contact[tags]"]') || {}).value,
        lang: lang && lang.getAttribute('action'),
        langInput: lang && (lang.querySelector('input[name="locale_code"]') || {}).value,
        langOptions: lang ? [...lang.querySelectorAll('a[data-value], [data-value]')].map((a) => a.dataset.value) : [],
      };
    });
    // Dawn names the other fields after their labels (contact[Comment]); Shopify accepts any contact[…] field.
    check('[390] contact form posts to /contact: required email, a message field, every field labelled', /^\/contact/.test(f.contact || '') && f.contactFields.includes('contact[email]') && f.textarea === 1 && f.named, JSON.stringify(f));
    check('[390] newsletter form posts a required email with the "newsletter" tag to /contact', /^\/contact/.test(f.news || '') && f.newsEmail && f.newsTag === 'newsletter', JSON.stringify(f));
    check('[390] language switch posts to /localization, offering English and Arabic', /^\/localization/.test(f.lang || '') && f.langInput === locale.slice(0, 2) && f.langOptions.includes('en') && f.langOptions.includes('ar'), JSON.stringify(f));
    await page.closeAll();
  }

  // Checkout handoff: the cart page and the drawer submit to /cart with name="checkout".
  {
    const page = await open(390, '/cart');
    const c = await page.evaluate(() => {
      const btn = document.querySelector('main #checkout');
      const form = btn && (btn.form || document.getElementById(btn.getAttribute('form')));
      return { name: btn && btn.name, disabled: btn && btn.disabled, action: form && form.getAttribute('action'), method: form && form.getAttribute('method') };
    });
    check('[390] cart page: checkout button submits the cart form (POST /cart, name="checkout")', c.name === 'checkout' && !c.disabled && c.action === '/cart' && /post/i.test(c.method || ''), JSON.stringify(c));
    await page.click('#cart-icon-bubble');
    await page.waitForTimeout(600);
    const d = await page.evaluate(() => {
      const btn = document.querySelector('cart-drawer #CartDrawer-Checkout');
      const form = btn && (btn.form || document.getElementById(btn.getAttribute('form')));
      return { name: btn && btn.name, disabled: btn && btn.disabled, action: form && form.getAttribute('action') };
    });
    check('[390] cart drawer: checkout button submits to /cart with name="checkout"', d.name === 'checkout' && !d.disabled && d.action === '/cart', JSON.stringify(d));
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
