// Stage 6 tests: free-shipping progress in the cart drawer and on the cart
// page, the product page's free-shipping line, Sympl in the drawer, and
// "Complete the look" (complementary products first, related as fallback).
// The theme's real Liquid, CSS and JS, rendered by tests/lib/theme-harness.js
// and driven in Chromium; cart changes go through Dawn's own cart.js.
// usage: node tests/cart.test.js [themeRoot] [--shots <dir>]
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { buildProduct } = require('./lib/catalog');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const shotsArg = process.argv.indexOf('--shots');
const shotsDir = shotsArg > -1 ? process.argv[shotsArg + 1] : null;
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const locale = process.env.LOCALE || 'en.default';
const WIDTHS = [360, 390, 430, 768, 990, 1280, 1440];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

// Search & Discovery complementary products, as a merchant would set them.
const COMPLEMENTARY = { 'linen-maxi-skirt-with-front-pockets': ['476', '510', '488'] };

async function main() {
  const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const strings = readJson(path.join(root, 'locales', `${locale}.json`));
  const t = (key, vars = {}) => String(key.split('.').reduce((o, k) => (o == null ? o : o[k]), strings)).replace(/{{\s*(\w+)\s*}}/g, (_, k) => vars[k] ?? '');
  const money = (cents) => `${Math.round(cents / 100).toLocaleString('en-US')} ج.م`;
  const text = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const sizes = {};
  catalog.products.forEach((p) => p.media.forEach((m, i) => (sizes[`${p.handle}-${i}.jpg`] = m)));
  const product = (handle) => buildProduct(catalog.products.find((p) => p.handle === handle));

  const browser = await chromium.launch();
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

  // A page with the cart drawer, holding `lines` ({ handle, title, price, quantity }).
  async function open(width, { lines = [], pagePath = '/', pageType = 'index', mainHtml } = {}) {
    let state = lines.map((l) => ({ ...l }));
    const globalsFor = () => harness.globals({ path: pagePath, pageType, cart: harness.makeCart(state) });
    const sectionsFor = async (ids) => {
      const g = globalsFor();
      const out = {};
      for (const id of ids) out[id] = await harness.renderSection(id, id, {}, g);
      return out;
    };
    const cartState = async (ids) => {
      const cart = harness.makeCart(state);
      return { item_count: cart.item_count, items_subtotal_price: cart.items_subtotal_price, items: cart.items.map((i) => ({ key: i.key, quantity: i.quantity })), sections: await sectionsFor(ids) };
    };
    const html = await harness.renderLayout(globalsFor(), mainHtml || '<div style="height:1600px;padding:40px">page</div>');
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    page.errors = [];
    page.requests = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
    page.on('request', (r) => page.requests.push(new URL(r.url()).pathname));
    page.__html = html;
    await routeTheme(page, {
      root,
      fontsDir,
      harness,
      globalsFor,
      imageSize: (n) => sizes[n],
      onCartAdd: async () => {
        state = [...state, { handle: 'linen-pajama-set', title: 'Linen Pajama Set', price: 78900, quantity: 1 }];
        return { id: 1, quantity: 1, ...(await cartState(['cart-drawer', 'cart-icon-bubble'])) };
      },
      cartSection: async (id) => harness.renderSection(id, id, {}, globalsFor()),
      cartJson: () => {
        const c = harness.makeCart(state);
        return { item_count: c.item_count, items_subtotal_price: c.items_subtotal_price, total_price: c.total_price, items: c.items.map((i) => ({ key: i.key, quantity: i.quantity })) };
      },
      pages: async (url, request) => {
        if (url.pathname === '/cart/change') {
          const body = JSON.parse(request.postData() || '{}');
          state = state.map((l, i) => (i === body.line - 1 ? { ...l, quantity: body.quantity } : l)).filter((l) => l.quantity > 0);
          return JSON.stringify(await cartState(body.sections || []));
        }
        return null;
      },
    });
    await page.goto('http://dressar.test/__page');
    await page.waitForTimeout(500);
    page.closeAll = () => context.close();
    return page;
  }
  const openDrawer = async (page) => {
    await page.evaluate(() => document.querySelector('cart-drawer').open());
    await page.waitForTimeout(500);
  };
  const bar = (page, scope = 'cart-drawer') =>
    page.evaluate((s) => {
      const b = document.querySelector(`${s} .dsr-shipping`);
      if (!b) return null;
      return {
        text: b.querySelector('.dsr-shipping__text').textContent.replace(/\s+/g, ' ').trim(),
        width: b.querySelector('.dsr-shipping__fill').style.width,
        qualified: b.classList.contains('dsr-shipping--qualified'),
        role: b.getAttribute('role'),
        inView: (() => { const r = b.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= window.innerWidth + 1; })(),
      };
    }, scope);

  const skirt = { handle: 'olive-chiffon-maxi-skirt', title: 'Olive Chiffon Skirt', price: 24900, quantity: 1 };

  for (const width of WIDTHS) {
    const tag = `[${width}]`;

    // One skirt at 249: 1,251 to go.
    const page = await open(width, { lines: [skirt] });
    const loadRequests = page.requests.filter((p) => p === '/cart.js' || p === '/cart.json').length;
    check(`${tag} no cart request on page load (the old bar fetched /cart.js on every page)`, loadRequests === 0, String(loadRequests));
    await openDrawer(page);
    const b1 = await bar(page);
    check(`${tag} drawer: progress towards free shipping from the cart`, b1 && b1.text === text(t('dressar.free_shipping.remaining_html', { amount: money(125100) })) && b1.width === '16%' && !b1.qualified && b1.role === 'status' && b1.inView, JSON.stringify(b1));
    const sympl = await page.evaluate(() => [...document.querySelectorAll('cart-drawer sympl-widget')].map((w) => Number(w.getAttribute('productprice'))));
    check(`${tag} drawer: Sympl gets the cart total (Stage 2)`, sympl.length === 1 && sympl[0] === 249, sympl.join());
    await shot(page, `drawer-${width}`);

    // Quantity 7 through Dawn's own cart.js: 1,743 ≥ 1,500.
    await page.fill('#Drawer-quantity-1', '7');
    await page.dispatchEvent('#Drawer-quantity-1', 'change');
    await page.waitForTimeout(900);
    const b2 = await bar(page);
    check(`${tag} quantity change in the drawer keeps the bar and updates it (the old bar vanished)`, b2 && b2.qualified && b2.text === t('dressar.free_shipping.qualified') && b2.width === '100%', JSON.stringify(b2));

    // Remove the line with its remove button: no bar for an empty cart.
    await page.click('#CartDrawer-Remove-1 button');
    await page.waitForTimeout(900);
    check(`${tag} empty cart: no bar`, (await bar(page)) === null);
    check(`${tag} no JS errors`, page.errors.length === 0, page.errors.join(' | '));
    await page.closeAll();
  }

  // Add to cart from a product page re-renders the drawer with the bar.
  {
    const productForm = `
      <script src="/assets/product-form.js" defer="defer"></script>
      <product-form><form method="post" action="/cart/add"><input type="hidden" name="id" value="1">
        <button type="submit" name="add" class="product-form__submit button"><span>Add</span><div class="loading__spinner hidden"></div></button>
      </form></product-form>`;
    const page = await open(390, { lines: [skirt], pagePath: '/products/linen-pajama-set', pageType: 'product', mainHtml: productForm });
    await page.click('.product-form__submit');
    await page.waitForTimeout(900);
    const b = await bar(page);
    check('[390] after add to cart: drawer opens with the updated bar (249 + 789 = 1,038)', b && b.text === text(t('dressar.free_shipping.remaining_html', { amount: money(46200) })) && b.width === '69%', JSON.stringify(b));
    await page.closeAll();
  }

  // Off in theme settings: no bar, and the product page falls back to Dawn's line.
  harness.settings.free_shipping_enabled = false;
  {
    const page = await open(390, { lines: [skirt] });
    await openDrawer(page);
    check('[390] free shipping off in settings: no bar', (await bar(page)) === null);
    await page.closeAll();
  }
  harness.settings.free_shipping_enabled = true;

  // Cart page footer.
  {
    const g = harness.globals({ path: '/cart', pageType: 'cart', cart: harness.makeCart([skirt]) });
    const footer = await harness.renderSection('main-cart-footer', 'main-cart-footer', readJson(path.join(root, 'templates/cart.json')).sections['cart-footer'] || {}, g);
    const m = /<div class="dsr-shipping[^"]*"[^>]*>([\s\S]*?)<div class="dsr-shipping__track/.exec(footer);
    check('cart page: same bar in the totals (re-rendered with them)', m && text(m[1]) === text(t('dressar.free_shipping.remaining_html', { amount: money(125100) })) && /class="js-contents"[\s\S]*dsr-shipping/.test(footer), m ? text(m[1]) : 'missing');
  }

  // Product page line from the same settings (not a sentence in the locale file).
  {
    const g = harness.globals({ path: '/products/linen-pajama-set', pageType: 'product', overrides: { product: product('linen-pajama-set'), __pages: {} } });
    g.shop.shipping_policy = { body: '<p>policy</p>', url: '/policies/shipping-policy' };
    const tpl = readJson(path.join(root, 'templates/product.json'));
    const html = await harness.renderSection('main-product', 'template--1__main', tpl.sections.main, g);
    const line = (/<div class="product__tax caption rte">([\s\S]*?)<\/div>/.exec(html) || [])[1] || '';
    check('product page: free-shipping line from theme settings', text(line) === text(t('dressar.free_shipping.policy_link_html', { amount: money(150000), link: '' })) && line.includes('href="/policies/shipping-policy"'), text(line));
    harness.settings.free_shipping_enabled = false;
    const off = await harness.renderSection('main-product', 'template--1__main', tpl.sections.main, g);
    const lineOff = (/<div class="product__tax caption rte">([\s\S]*?)<\/div>/.exec(off) || [])[1] || '';
    check('product page: offer off -> Dawn\'s neutral shipping line, no free-shipping claim', text(lineOff) === text(t('products.product.shipping_policy_html', { link: '' })), text(lineOff));
    harness.settings.free_shipping_enabled = true;
  }
  const arStrings = readJson(path.join(root, 'locales/ar.json'));
  check('ar locale: the shipping line no longer hard-codes "1500"', !/1500|١٥٠٠/.test(arStrings.products.product.shipping_policy_html), arStrings.products.product.shipping_policy_html);

  // Complete the look.
  const tpl = readJson(path.join(root, 'templates/product.json'));
  const related = tpl.sections['related-products'];
  const recommendations = async (url) => {
    const id = Number(url.searchParams.get('product_id'));
    const base = catalog.products.map((p) => buildProduct(p));
    const self = base.find((p) => p.id === id);
    const intent = url.searchParams.get('intent') || 'related';
    const limit = Number(url.searchParams.get('limit')) || 4;
    const list = intent === 'complementary'
      ? (COMPLEMENTARY[self.handle] || []).map((h) => base.find((p) => p.handle === h))
      : base.filter((p) => p.id !== id && p.type === self.type).concat(base.filter((p) => p.id !== id && p.type !== self.type)).slice(0, limit);
    const g = harness.globals({ path: '/recommendations/products', pageType: 'product', overrides: { recommendations: { performed: true, intent, products: list, products_count: list.length } } });
    return harness.renderSection('related-products', url.searchParams.get('section_id'), related, g);
  };
  for (const width of [390, 1280]) {
    for (const [handle, expectHeading, expectHandles, what] of [
      ['linen-maxi-skirt-with-front-pockets', related.settings.heading, COMPLEMENTARY['linen-maxi-skirt-with-front-pockets'], 'complementary products'],
      ['471', t('dressar.recommendations.fallback_heading'), null, 'no complementary -> related, own heading'],
    ]) {
      const p = product(handle);
      const g = harness.globals({ path: p.url, pageType: 'product', overrides: { product: p } });
      const html = await harness.renderLayout(g, await harness.renderSection('related-products', 'template--1__related-products', related, g));
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      page.errors = [];
      page.on('pageerror', (e) => page.errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
      const asked = [];
      page.__html = html;
      await routeTheme(page, {
        root,
        fontsDir,
        harness,
        globalsFor: () => g,
        imageSize: (n) => sizes[n],
        pages: async (url) => {
          if (url.pathname !== '/recommendations/products') return null;
          asked.push(url.searchParams.get('intent'));
          return recommendations(url);
        },
      });
      await page.goto('http://dressar.test/__page');
      await page.evaluate(() => document.querySelector('dsr-recommendations').scrollIntoView());
      await page.waitForTimeout(1200);
      const got = await page.evaluate(() => {
        const el = document.querySelector('dsr-recommendations');
        const items = [...el.querySelectorAll('.grid__item')];
        return {
          heading: (el.querySelector('.related-products__heading') || {}).textContent?.trim(),
          handles: items.map((li) => li.querySelector('a').getAttribute('href').replace('/products/', '')),
          ratios: items.map((li) => li.querySelector('.card__inner').getBoundingClientRect().height / li.querySelector('.card__inner').getBoundingClientRect().width),
          loaded: el.classList.contains('product-recommendations--loaded'),
          priceSize: items.length ? parseFloat(getComputedStyle(items[0].querySelector('.price .price-item')).fontSize) : 0,
          swatchSize: (() => { const sw = el.querySelector('.dsr-card-swatch .swatch'); return sw ? Math.round(sw.getBoundingClientRect().width) : null; })(),
        };
      });
      const handlesOk = expectHandles ? got.handles.join() === expectHandles.join() : got.handles.length === 4 && !got.handles.includes(handle);
      check(`[${width}] complete the look, ${what}`, got.loaded && got.heading === expectHeading && handlesOk, JSON.stringify({ ...got, ratios: undefined, asked }));
      check(`[${width}] complete the look: asks complementary first${expectHandles ? '' : ', then related'}`, asked.join() === (expectHandles ? 'complementary' : 'complementary,related'), asked.join());
      check(`[${width}] complete the look: same 3:4 card`, got.ratios.length > 0 && got.ratios.every((r) => Math.abs(r - 4 / 3) < 0.01), got.ratios.map((r) => r.toFixed(3)).join());
      check(`[${width}] complete the look: card prices card-sized (not the product page's 26px)`, got.priceSize > 0 && got.priceSize < 17, String(got.priceSize));
      if (got.swatchSize !== null) check(`[${width}] complete the look: swatches styled without the product form's CSS`, got.swatchSize >= 14 && got.swatchSize <= 20, String(got.swatchSize));
      check(`[${width}] complete the look: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await shot(page, `ctl-${handle}-${width}`, { fullPage: true });
      await context.close();
    }
  }

  // WhatsApp: one customer-facing floating button.
  const data = readJson(path.join(root, 'config/settings_data.json')).current;
  const whatflow = Object.values(data.blocks || {}).find((b) => /whatflow/.test(b.type));
  check('WhatsApp: the Whatflow app button is hidden on desktop and mobile, so the theme button is the only one', whatflow && whatflow.settings.hide_on_desktop === true && whatflow.settings.hide_on_mobile === true && data.whatsapp_button_enabled !== false, JSON.stringify(whatflow && whatflow.settings));

  await browser.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);

  async function shot(page, name, opts = {}) {
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${name}.png`), ...opts });
  }
}

main().catch((e) => {
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`);
  console.error(e);
  process.exit(1);
});
