// Stage 3 header tests: the theme's real header/search/cart Liquid, CSS and JS,
// rendered by tests/lib/theme-harness.js and driven in Chromium.
// usage: node tests/header.test.js [themeRoot] [--shots <dir>]
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme } = require('./lib/theme-harness');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const shotsArg = process.argv.indexOf('--shots');
const shotsDir = shotsArg > -1 ? process.argv[shotsArg + 1] : null;
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const fixtures = path.join(root, 'tests/fixtures/store.json');
const WIDTHS = [360, 390, 430, 768, 990, 1280, 1440];
const DESKTOP = 990;

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

const heroMain = '<div style="height:560px;background:#6f6258"><span hidden>hero</span></div><div style="height:2400px;padding:40px">content</div>';
// Like sections/main-product.liquid: the product form loads its own script.
const productForm = `
  <script src="/assets/product-form.js" defer="defer"></script>
  <product-info id="MainProduct-main" data-section="main">
    <div class="price"><div class="price__regular"><span class="price-item price-item--regular">549 ج.م</span></div></div>
    <variant-selects><fieldset><input type="radio" id="s-m" name="Size" value="M" checked><label for="s-m">M</label>
      <input type="radio" id="s-l" name="Size" value="L"><label for="s-l">L</label></fieldset></variant-selects>
    <product-form><form method="post" action="/cart/add"><input type="hidden" name="id" value="1">
      <button type="submit" name="add" class="product-form__submit button"><span>Add</span><div class="loading__spinner hidden"></div></button>
    </form></product-form>
  </product-info>`;

async function main() {
  const harness = createHarness({ root, fixtures, locale: process.env.LOCALE || 'en.default' });
  const browser = await chromium.launch();
  const menu = harness.store.menus['main-menu'];
  const parent = menu.find((l) => l.links);

  async function openPage(width, { pagePath = '/collections/skirts', pageType = 'collection', mainHtml, product } = {}) {
    const globals = harness.globals({ path: pagePath, pageType, overrides: product ? { product } : {} });
    let main = mainHtml || '<div style="height:2400px;padding:40px">page</div>';
    if (product) main = productForm + (await harness.renderSection('dsr-product-boost', 'dsr-product-boost', {}, globals)) + main;
    const html = await harness.renderLayout(globals, main);
    const page = await browser.newPage({ viewport: { width, height: 760 } });
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
    page.__html = html;
    let cartLines = [];
    await routeTheme(page, {
      root,
      fontsDir,
      harness,
      globalsFor: () => globals,
      onCartAdd: async () => {
        cartLines = [...cartLines, { handle: harness.store.products[0].handle, title: harness.store.products[0].title, price: 24900, quantity: 2 }];
        const g = harness.globals({ path: pagePath, pageType, cart: harness.makeCart(cartLines) });
        const drawer = await harness.renderSection('cart-drawer', 'cart-drawer', {}, g);
        const bubble = await harness.renderSection('cart-icon-bubble', 'cart-icon-bubble', {}, g);
        return { id: 1, quantity: 2, sections: { 'cart-drawer': drawer, 'cart-icon-bubble': bubble } };
      },
      cartSection: (id) => harness.renderSection(id, id, {}, harness.globals({ path: pagePath, pageType, cart: harness.makeCart(cartLines) })),
      cartJson: () => {
        const c = harness.makeCart(cartLines);
        return { item_count: c.item_count, total_price: c.total_price, items_subtotal_price: c.items_subtotal_price, items: c.items.map((i) => ({ key: i.key, quantity: i.quantity })) };
      },
    });
    await page.goto('http://dressar.test/__page');
    await page.waitForTimeout(500);
    page.html = html;
    return page;
  }

  const visible = (page, sel) =>
    page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    }).length, sel);
  const noHorizontalOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const shot = async (page, name, clip) => shotsDir && page.screenshot({ path: path.join(shotsDir, `${name}.png`), ...(clip ? { clip } : {}) });
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

  for (const width of WIDTHS) {
    const t = `[${width}]`;
    const desktop = width >= DESKTOP;
    const page = await openPage(width);
    const html = page.html;

    // One header, one announcement bar, menu from Shopify data.
    check(`${t} exactly one header rendered`, (html.match(/<sticky-header/g) || []).length === 1 && !/header-block-/.test(html));
    check(`${t} exactly one announcement bar`, (html.match(/class="utility-bar /g) || []).length === 1);
    check(`${t} one search toggle visible`, (await visible(page, '.header__icon--search')) === 1);
    check(`${t} cart and account icons visible`, (await visible(page, '#cart-icon-bubble')) === 1 && (await visible(page, 'shopify-account')) === 1);
    check(`${t} no horizontal overflow`, await noHorizontalOverflow(page));
    const logo = await page.evaluate(() => { const i = document.querySelector('.header__heading-logo'); const r = i.getBoundingClientRect(); return { w: r.width, h: r.height }; });
    check(`${t} logo keeps its aspect ratio`, Math.abs(logo.w / logo.h - 1281 / 428) < 0.05, JSON.stringify(logo));

    if (desktop) {
      check(`${t} desktop menu shows every top-level item`, (await visible(page, '.header__inline-menu > ul > li')) === menu.length);
      check(`${t} menu drawer toggle hidden`, (await visible(page, '.header__icon--menu')) === 0);
      // Dropdown: open by click, inside viewport, on top of the page, links from the menu.
      await page.click(`#HeaderMenu-${parent.title.trim().toLowerCase().replace(/\s+/g, '-')}`);
      await page.waitForTimeout(350);
      const dd = await page.evaluate(() => {
        const ul = document.querySelector('header-menu details[open] > .header__submenu');
        if (!ul) return null;
        const r = ul.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.bottom - 8);
        return { left: r.left, right: r.right, bottom: r.bottom, onTop: ul.contains(hit), hrefs: [...ul.querySelectorAll('a')].map((a) => a.getAttribute('href')) };
      });
      check(`${t} "${parent.title.trim()}" dropdown opens`, dd);
      if (dd) {
        check(`${t} dropdown inside viewport`, dd.left >= 0 && dd.right <= width && dd.bottom <= 760, JSON.stringify(dd));
        check(`${t} dropdown not covered or clipped`, dd.onTop);
        check(`${t} dropdown links = menu children + view all`, JSON.stringify(dd.hrefs) === JSON.stringify([parent.url, ...parent.links.map((l) => l.url)]), dd.hrefs.join(' '));
      }
      await shot(page, `dropdown-${width}`, { x: 0, y: 0, width, height: 520 });
      // Keyboard: Escape closes and returns focus to the toggle.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      const esc = await page.evaluate(() => ({ open: !!document.querySelector('header-menu details[open]'), focus: document.activeElement.tagName, expanded: document.activeElement.getAttribute('aria-expanded') }));
      check(`${t} Escape closes dropdown, focus on its toggle`, !esc.open && esc.focus === 'SUMMARY' && esc.expanded === 'false', JSON.stringify(esc));
      await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
      const kb = await page.evaluate(() => ({ open: !!document.querySelector('header-menu details[open]'), expanded: document.activeElement.getAttribute('aria-expanded'), controls: document.activeElement.getAttribute('aria-controls') }));
      check(`${t} Enter opens dropdown (aria-expanded, aria-controls)`, kb.open && kb.expanded === 'true' && kb.controls, JSON.stringify(kb));
      await page.keyboard.press('Tab');
      check(`${t} Tab moves into the dropdown links`, await page.evaluate(() => !!document.activeElement.closest('.header__submenu')));
      for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
      await page.waitForTimeout(150);
      check(`${t} tabbing past the dropdown closes it`, await page.evaluate(() => !document.querySelector('header-menu details[open]')));
    } else {
      check(`${t} desktop menu hidden on small screens`, (await visible(page, '.header__inline-menu')) === 0);
      // Drawer: open, nested categories, focus, scroll lock, Escape.
      await page.click('.header__icon--menu');
      await page.waitForTimeout(450);
      const drawer = await page.evaluate(() => ({
        open: document.querySelector('#Details-menu-drawer-container').hasAttribute('open'),
        locked: document.body.classList.contains('overflow-hidden-tablet'),
        topLevel: document.querySelectorAll('.menu-drawer__navigation > .menu-drawer__menu > li').length,
        focusInside: !!document.activeElement.closest('header-drawer'),
      }));
      check(`${t} drawer opens with every top-level item`, drawer.open && drawer.topLevel === menu.length, JSON.stringify(drawer));
      check(`${t} body scroll locked while drawer open`, drawer.locked);
      check(`${t} WhatsApp button hidden while drawer open`, (await visible(page, '.dsr-wa')) === 0);
      await page.click(`#HeaderDrawer-${parent.title.trim().toLowerCase().replace(/\s+/g, '-')}`);
      await page.waitForTimeout(500);
      const sub = await page.evaluate(() => {
        const s = document.querySelector('.menu-drawer__submenu');
        const r = s.getBoundingClientRect();
        return { inView: r.left >= -1 && r.right <= window.innerWidth + 1, hrefs: [...s.querySelectorAll('a')].map((a) => a.getAttribute('href')), focus: document.activeElement.className };
      });
      check(`${t} "${parent.title.trim()}" drill-down shows every category`, JSON.stringify(sub.hrefs) === JSON.stringify([parent.url, ...parent.links.map((l) => l.url)]), sub.hrefs.join(' '));
      check(`${t} submenu slides fully into view`, sub.inView);
      check(`${t} focus moves to the submenu back button`, /menu-drawer__close-button/.test(sub.focus), sub.focus);
      await shot(page, `drawer-sub-${width}`);
      const scrollable = await page.evaluate(() => {
        const d = document.querySelector('.menu-drawer');
        return { scrollW: d.scrollWidth, clientW: d.clientWidth, overflowY: getComputedStyle(d.querySelector('.menu-drawer__inner-container') || d).overflowY };
      });
      check(`${t} drawer has no horizontal overflow`, scrollable.scrollW <= scrollable.clientW + 1, JSON.stringify(scrollable));
      await page.keyboard.press('Escape'); // closes the submenu
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape'); // closes the drawer
      await page.waitForTimeout(500);
      const closed = await page.evaluate(() => ({
        open: document.querySelector('#Details-menu-drawer-container').hasAttribute('open'),
        locked: document.body.classList.contains('overflow-hidden-tablet'),
        focus: document.activeElement.classList.contains('header__icon--menu'),
      }));
      check(`${t} Escape closes drawer, unlocks scroll, focus back on menu button`, !closed.open && !closed.locked && closed.focus, JSON.stringify(closed));
    }

    // Search: open, autofocus, predictive results, keyboard, sold out, no results, close.
    await page.click('.header__icon--search >> visible=true');
    await page.waitForTimeout(250);
    const focused = await page.evaluate(() => ({ id: document.activeElement.id, type: document.activeElement.type, label: document.querySelector(`label[for="${document.activeElement.id}"]`)?.textContent.trim() }));
    check(`${t} search opens with the input focused and labelled`, focused.type === 'search' && focused.label, JSON.stringify(focused));
    await page.keyboard.type('skirt', { delay: 20 });
    await page.waitForSelector('predictive-search[open] #predictive-search-results-products-list', { timeout: 3000 }).catch(() => {});
    const res = await page.evaluate(() => {
      const ps = [...document.querySelectorAll('predictive-search')].find((p) => p.hasAttribute('open'));
      const box = ps && ps.querySelector('.predictive-search');
      const items = ps ? [...ps.querySelectorAll('#predictive-search-results-products-list > li')] : [];
      const r = box && box.getBoundingClientRect();
      return {
        count: items.length,
        first: items[0] && { img: !!items[0].querySelector('img'), title: items[0].querySelector('.predictive-search__item-heading')?.textContent.trim(), price: items[0].querySelector('.price')?.textContent.replace(/\s+/g, ' ').trim(), compareAt: !!items[0].querySelector('.price--on-sale s, .price__sale s') },
        inView: r && r.left >= -1 && r.right <= window.innerWidth + 1,
      };
    });
    check(`${t} predictive search shows products`, res.count > 0, JSON.stringify(res));
    check(`${t} result shows image, title, price and compare-at`, res.first && res.first.img && res.first.title && res.first.price && res.first.compareAt, JSON.stringify(res.first));
    check(`${t} results panel inside viewport`, res.inView);
    await shot(page, `search-${width}`, { x: 0, y: 0, width, height: 700 });
    await page.keyboard.press('ArrowDown');
    check(`${t} ArrowDown selects the first result`, await page.evaluate(() => !!document.querySelector('predictive-search[open] [aria-selected="true"]')));
    await page.fill('input[type="search"]:focus', 'blouse');
    await page.waitForTimeout(600);
    check(`${t} sold-out product is labelled`, await page.evaluate(() => !!document.querySelector('predictive-search[open] .predictive-search__item-sold-out')));
    await page.fill('input[type="search"]:focus', 'zzqx');
    await page.waitForTimeout(600);
    check(`${t} no-results message is visible`, (await visible(page, 'predictive-search[open] .predictive-search__no-results')) === 1);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const sclosed = await page.evaluate(() => ({ open: !!document.querySelector('details-modal details[open]'), focus: document.activeElement.classList.contains('header__icon--search'), locked: document.body.classList.contains('overflow-hidden') }));
    check(`${t} Escape closes search, focus back on search button`, !sclosed.open && sclosed.focus && !sclosed.locked, JSON.stringify(sclosed));

    // Sticky header after scrolling, with no layout shift.
    await page.evaluate(() => {
      window.__cls = 0;
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__cls += e.value))).observe({ type: 'layout-shift', buffered: false });
    });
    for (const y of [150, 400, 900]) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(120);
    }
    const sticky = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      return { cart: r('#cart-icon-bubble').top, cartBottom: r('#cart-icon-bubble').bottom, logoBottom: r('.header__heading-logo').bottom, cls: window.__cls };
    });
    check(`${t} cart still reachable after scrolling (sticky)`, sticky.cart >= 0 && sticky.cartBottom <= 90, JSON.stringify(sticky));
    check(`${t} no layout shift while scrolling`, sticky.cls < 0.01, `CLS=${sticky.cls}`);
    if (desktop && width > 990) check(`${t} compact: logo row scrolled away, nav row pinned`, sticky.logoBottom <= 1, JSON.stringify(sticky));
    if (desktop) {
      const navOnTop = await page.evaluate(() => { const r = document.querySelector('.header__inline-menu').getBoundingClientRect(); return r.top >= -1 && r.top < 70; });
      check(`${t} compact: menu still visible after scrolling`, navOnTop);
    }
    await shot(page, `sticky-${width}`, { x: 0, y: 0, width, height: 200 });

    // Cart count: AJAX add -> bubble updates without reload; icon opens the drawer.
    await page.evaluate(() => window.scrollTo(0, 0));
    check(`${t} no count bubble on an empty cart`, (await visible(page, '#cart-icon-bubble .cart-count-bubble')) === 0);
    check(`${t} no JS errors`, page.errors.length === 0, page.errors.join(' | '));
    await page.close();
  }

  // Cart count via the real product form + cart drawer (390 and 1280).
  for (const width of [390, 1280]) {
    const t = `[${width}] cart flow:`;
    const page = await openPage(width, { pagePath: '/products/olive-chiffon-maxi-skirt', pageType: 'product', product: harness.productDrop(harness.store.products[0]) });
    await page.evaluate(() => document.querySelector('.product-form__submit').click());
    await page.waitForSelector('#cart-icon-bubble .cart-count-bubble', { timeout: 3000 }).catch(() => {});
    const bubble = await page.evaluate(() => document.querySelector('#cart-icon-bubble .cart-count-bubble span[aria-hidden]')?.textContent.trim());
    check(`${t} count bubble shows 2 after AJAX add, no reload`, bubble === '2', String(bubble));
    await page.waitForTimeout(400);
    check(`${t} cart drawer opened after add`, await page.evaluate(() => document.querySelector('cart-drawer').classList.contains('active')));
    await page.evaluate(() => document.querySelector('cart-drawer').close());
    await page.waitForTimeout(400);
    await page.click('#cart-icon-bubble');
    await page.waitForTimeout(400);
    check(`${t} cart icon opens the drawer (no navigation)`, await page.evaluate(() => document.querySelector('cart-drawer').classList.contains('active') && location.pathname === '/__page'));
    await shot(page, `cart-${width}`);
    check(`${t} no JS errors`, page.errors.length === 0, page.errors.join(' | ') + ' missing: ' + (page.missing || []).join(', '));
    await page.close();
  }

  // PDP: the sticky add-to-cart bar must not sit over the drawer or search.
  {
    const page = await openPage(390, { pagePath: '/products/olive-chiffon-maxi-skirt', pageType: 'product', product: harness.productDrop(harness.store.products[0]) });
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(400);
    const barShown = await visible(page, '[data-dsr-sticky-atc].is-visible');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('.header__icon--menu');
    await page.waitForTimeout(450);
    await page.evaluate(() => window.scrollTo(0, 1500));
    const barDuringMenu = await page.evaluate(() => getComputedStyle(document.querySelector('[data-dsr-sticky-atc]')).visibility);
    check('[390] PDP sticky bar is shown on scroll', barShown === 1);
    check('[390] PDP sticky bar hidden while the menu drawer is open', barDuringMenu === 'hidden', barDuringMenu);
    await page.close();
  }

  // Transparent header on the homepage (desktop only).
  for (const width of [390, 1280]) {
    const page = await openPage(width, { pagePath: '/', pageType: 'index', mainHtml: heroMain });
    const bg = () => page.evaluate(() => getComputedStyle(document.querySelector('.header-wrapper')).backgroundColor);
    const atTop = await bg();
    const heroUnder = await page.evaluate(() => document.querySelector('main').getBoundingClientRect().top < document.querySelector('.header-wrapper').getBoundingClientRect().bottom);
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(250);
    const scrolled = await bg();
    if (width >= DESKTOP) {
      check(`[${width}] home: header transparent over the hero`, atTop === 'rgba(0, 0, 0, 0)' && heroUnder, `${atTop} heroUnder=${heroUnder}`);
      check(`[${width}] home: header solid after scrolling`, scrolled === 'rgb(11, 12, 13)', scrolled);
    } else {
      check(`[${width}] home: mobile header stays solid`, atTop === 'rgb(11, 12, 13)' && !heroUnder, `${atTop} heroUnder=${heroUnder}`);
    }
    await shot(page, `home-${width}`, { x: 0, y: 0, width, height: 260 });
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
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : "  -> " + r.detail}`);
  console.error(e);
  process.exit(1);
});
