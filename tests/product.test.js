// Stage 5 product page tests: the theme's real product template (Dawn's
// main-product with the Dressar blocks, the sticky bar, Sympl), rendered by
// tests/lib/theme-harness.js from tests/fixtures/catalog.json and driven in
// Chromium. Variant changes go through Dawn's own product-info.js, which
// fetches the section for the chosen option values; the harness renders it.
// usage: node tests/product.test.js [themeRoot] [--shots <dir>]
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { buildProduct, selectVariant } = require('./lib/catalog');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const shotsArg = process.argv.indexOf('--shots');
const shotsDir = shotsArg > -1 ? process.argv[shotsArg + 1] : null;
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const locale = process.env.LOCALE || 'en.default';
const WIDTHS = [360, 390, 430, 768, 990, 1280, 1440];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

const PAGES = {
  'size-chart': { title: 'Size chart', handle: 'size-chart', url: '/pages/size-chart', content: '<table class="dsr-test-chart"><tr><th>Size</th><th>Bust (cm)</th></tr><tr><td>M</td><td>96</td></tr></table>' },
  'care-instructions': { title: 'Care', handle: 'care-instructions', url: '/pages/care-instructions', content: '<p>Care page.</p>' },
};

async function main() {
  const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const strings = readJson(path.join(root, 'locales', `${locale}.json`));
  const t = (key, vars = {}) => String(key.split('.').reduce((o, k) => (o == null ? o : o[k]), strings)).replace(/{{\s*(\w+)\s*}}/g, (_, k) => vars[k] ?? '');
  const money = (cents) => `${Math.round(cents / 100).toLocaleString('en-US')} ج.م`;
  const sizes = {};
  catalog.products.forEach((p) => p.media.forEach((m, i) => (sizes[`${p.handle}-${i}.jpg`] = m)));
  const productFor = (handle, extra = {}) => {
    const p = buildProduct(catalog.products.find((x) => x.handle === handle));
    if (extra.modelSize) p.metafields.custom.model_size = { value: extra.modelSize };
    return p;
  };

  const pages = async (url, request, extra = {}) => {
    if (url.pathname.startsWith('/recommendations/')) return '<div></div>';
    // Dawn asks for pickup availability on each variant change; this store has no local pickup.
    if (url.pathname.startsWith('/variants/')) return '<div id="shopify-section-pickup-availability" class="shopify-section"></div>';
    const m = /^\/products\/([\w-]+)$/.exec(url.pathname);
    if (!m) return null;
    let product = productFor(m[1], extra);
    const variantId = url.searchParams.get('variant');
    const optionValues = url.searchParams.get('option_values');
    if (variantId) product = selectVariant(product, product.variants.find((v) => String(v.id) === variantId));
    if (optionValues) {
      const ids = optionValues.split(',').map(Number);
      const names = product.options_with_values.map((o) => (o.values.find((v) => ids.includes(v.id)) || {}).name);
      product = selectVariant(product, product.variants.find((v) => names.every((n, i) => v[`option${i + 1}`] === n)) || null);
    }
    const globals = harness.globals({
      path: url.pathname,
      pageType: 'product',
      overrides: { product, __pages: PAGES, __query: url.search.slice(1), __path: url.pathname },
    });
    const sid = url.searchParams.get('section_id');
    if (sid) return harness.renderTemplate('product', globals, { only: sid });
    return harness.renderLayout(globals, await harness.renderTemplate('product', globals));
  };

  const browser = await chromium.launch();
  const open = async (width, pagePath, extra = {}) => {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    page.on('console', (msg) => msg.type() === 'error' && page.errors.push(msg.text()));
    await routeTheme(page, {
      root,
      fontsDir,
      harness,
      globalsFor: () => harness.globals(),
      pages: (url, request) => pages(url, request, extra),
      imageSize: (n) => sizes[n],
    });
    await page.goto(`http://dressar.test${pagePath}`);
    await page.waitForTimeout(500);
    page.closeAll = () => context.close();
    return page;
  };
  const shot = async (page, name, opts = {}) => shotsDir && page.screenshot({ path: path.join(shotsDir, `${name}.png`), ...opts });
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
  const info = '#MainProduct-template--1__main';
  const settle = (page) => page.waitForTimeout(700);
  const state = (page) =>
    page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const priceBox = root.querySelector('.price');
      const sale = priceBox.classList.contains('price--on-sale');
      const num = (el) => (el ? Number(el.textContent.replace(/[^\d]/g, '')) : null);
      const atc = root.querySelector('.product-form__submit');
      const featured = root.querySelector('.product__media-item.is-active img, .product__media-list .product__media-item:first-child img');
      const bar = document.querySelector('[data-dsr-sticky-atc]');
      return {
        url: location.pathname + location.search,
        price: num(sale ? priceBox.querySelector('.price__sale .price-item--last') : priceBox.querySelector('.price__regular .price-item--regular')),
        compare: sale ? num(priceBox.querySelector('.price__sale s.price-item--regular')) : null,
        badge: sale ? priceBox.querySelector('.price__badge-sale').textContent.trim() : null,
        atcDisabled: atc.disabled,
        atcText: atc.textContent.replace(/\s+/g, ' ').trim(),
        media: featured ? featured.getAttribute('src') : null,
        sympl: [...document.querySelectorAll('sympl-widget')].map((w) => w.getAttribute('productprice')),
        inventory: (root.querySelector('.product__inventory') || {}).textContent?.replace(/\s+/g, ' ').trim(),
        barPrice: bar && bar.querySelector('[data-dsr-sticky-price]').textContent.trim(),
        barLabel: bar && bar.querySelector('[data-dsr-sticky-btn]').textContent.trim(),
        barDisabled: bar && bar.querySelector('[data-dsr-sticky-btn]').getAttribute('aria-disabled'),
      };
    }, info);
  const pick = async (page, optionIndex, value) => {
    const label = page.locator(`${info} variant-selects fieldset`).nth(optionIndex).locator(`label:has-text("${value}")`).first();
    await label.scrollIntoViewIfNeeded();
    await label.click();
    await settle(page);
  };

  // Template structure (merchant-editable order).
  const tpl = readJson(path.join(root, 'templates/product.json'));
  const sectionOrder = tpl.order.filter((id) => !tpl.sections[id].disabled);
  check('template: Complete the look comes before the reviews', sectionOrder.indexOf('related-products') < sectionOrder.indexOf('178648157455ed3771'), sectionOrder.join(' > '));
  check('template: Buy it now off, so Add to cart is the one primary action', tpl.sections.main.blocks.buy_buttons.settings.show_dynamic_checkout === false);
  check('template: old hard-coded trust list disabled, not deleted', tpl.sections.main.blocks.dsr_trust && tpl.sections.main.blocks.dsr_trust.disabled === true);

  const skirt = productFor('linen-maxi-skirt-with-front-pockets');
  const v = (product, ...opts) => product.variants.find((x) => opts.every((o, i) => x[`option${i + 1}`] === o));

  for (const width of WIDTHS) {
    const tag = `[${width}]`;
    const page = await open(width, '/products/linen-maxi-skirt-with-front-pockets');

    // Information order.
    const order = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const at = (s) => {
        const el = root.querySelector(s);
        return el ? [...root.querySelectorAll('*')].indexOf(el) : -1;
      };
      return {
        title: at('.product__title h1'),
        price: at('.price'),
        picker: at('variant-selects'),
        guide: at('.product-popup-modal__opener'),
        help: at('.dsr-size-help'),
        stock: at('.product__inventory'),
        atc: at('.product-form__submit'),
        reassure: at('.icon-with-text'),
        details: at('.product__description'),
        facts: at('.dsr-facts'),
        tabs: at('.product__accordion:not(.dsr-facts)'),
      };
    }, info);
    const seq = ['title', 'price', 'picker', 'guide', 'help', 'stock', 'atc', 'reassure', 'details', 'facts', 'tabs'];
    check(`${tag} order: title, price, colour/size, size guide, size help, stock, add to cart, reassurance, details, fabric & fit, tabs`, seq.every((k, i) => order[k] > -1 && (i === 0 || order[k] > order[seq[i - 1]])), JSON.stringify(order));
    const h1 = await page.evaluate(() => [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()));
    check(`${tag} one H1, the product title`, h1.length === 1 && h1[0] === skirt.title, h1.join(' | '));
    check(`${tag} no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    check(`${tag} no Buy it now button`, (await page.locator(`${info} .shopify-payment-button`).count()) === 0);

    // Starting variant: olive / L (the only olive in stock), 249 against 350.
    const s0 = await state(page);
    const olive = v(skirt, 'olive', 'L', 'Linen');
    check(`${tag} sale badge from the locale: % and amount saved`, s0.badge === t('dressar.product.sale_badge', { percent: 28, amount: money(10100) }), s0.badge);
    check(`${tag} price and compare-at of the selected variant`, s0.price === 249 && s0.compare === 350, JSON.stringify(s0));
    const priceSize = await page.evaluate((sel) => parseFloat(getComputedStyle(document.querySelector(`${sel} .price--large .price__sale .price-item--last`)).fontSize), info);
    check(`${tag} product price at its Dressar size (22px phones, 26px from 750px)`, priceSize === (width < 750 ? 22 : 26), String(priceSize));
    check(`${tag} Sympl gets the selected variant's price`, s0.sympl.length === 1 && Number(s0.sympl[0]) === 249, s0.sympl.join());
    const struck = await page.evaluate((sel) =>
      [...document.querySelectorAll(`${sel} variant-selects fieldset:nth-of-type(2) input`)].map((i) => `${i.value}:${i.classList.contains('disabled') ? 'x' : 'ok'}:${getComputedStyle(document.querySelector(`label[for="${i.id}"]`)).textDecorationLine}`), info);
    check(`${tag} sizes with no stock in this colour are struck through`, struck.join() === 'M:x:line-through,L:ok:none,XL:x:line-through,XXL:x:line-through,3XL:x:line-through', struck.join());

    // Size guide pop-up with the real page.
    await page.click(`${info} .product-popup-modal__button`);
    await page.waitForTimeout(300);
    const modal = await page.evaluate(() => {
      const m = document.querySelector('product-modal[open], .product-popup-modal[open]');
      const dialog = m && m.querySelector('[role="dialog"]');
      return { open: Boolean(m), table: Boolean(m && m.querySelector('.dsr-test-chart')), label: dialog && dialog.getAttribute('aria-label'), focus: Boolean(document.activeElement && m && m.contains(document.activeElement)) };
    });
    check(`${tag} size guide opens the Size chart page in a dialog`, modal.open && modal.table && modal.focus, JSON.stringify(modal));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const closed = await page.evaluate(() => ({ open: Boolean(document.querySelector('.product-popup-modal[open]')), focus: document.activeElement && document.activeElement.classList.contains('product-popup-modal__button') }));
    check(`${tag} Escape closes it and returns focus`, !closed.open && closed.focus, JSON.stringify(closed));

    // WhatsApp size help.
    const help = await page.evaluate(() => {
      const a = document.querySelector('.dsr-size-help');
      const u = new URL(a.href);
      return { host: u.host, path: u.pathname, text: u.searchParams.get('text'), target: a.target, rel: a.rel, label: a.textContent.replace(/\s+/g, ' ').trim() };
    });
    check(`${tag} size help opens WhatsApp on the theme-setting number with the product named`, help.host === 'wa.me' && help.path === '/201020676173' && help.text.includes(skirt.title) && help.text.includes('/products/linen-maxi-skirt-with-front-pockets') && help.target === '_blank' && help.rel.includes('noopener'), JSON.stringify(help));
    check(`${tag} size help text from the locale`, help.label.startsWith(t('dressar.product.size_help')), help.label);

    // Fabric & fit from category metafields.
    const facts = await page.evaluate(() => [...document.querySelectorAll('.dsr-facts__row')].map((r) => `${r.querySelector('dt').textContent}=${r.querySelector('dd').textContent}`));
    check(`${tag} fabric & fit lists only the filled facts`, facts.join() === `${t('dressar.product.facts.fabric')}=Linen,${t('dressar.product.facts.length')}=Maxi`, facts.join());
    check(`${tag} no model-size line without the metafield`, (await page.locator('.dsr-model-size').count()) === 0);

    // Change colour: Genzari is in stock in every size.
    await pick(page, 0, 'Genzari');
    const s1 = await state(page);
    const genzariL = v(skirt, 'Genzari', 'L', 'Linen');
    check(`${tag} colour change: URL names the new variant`, s1.url === `/products/linen-maxi-skirt-with-front-pockets?variant=${genzariL.id}`, s1.url);
    check(`${tag} colour change: photo of that colour`, /linen-maxi-skirt-with-front-pockets-2\.jpg/.test(s1.media || ''), s1.media);
    const sizesNow = await page.evaluate((sel) => [...document.querySelectorAll(`${sel} variant-selects fieldset:nth-of-type(2) input`)].filter((i) => !i.classList.contains('disabled')).map((i) => i.value).join(), info);
    check(`${tag} colour change: size availability follows the colour`, sizesNow === 'M,L,XL,XXL,3XL', sizesNow);

    // 3XL costs more.
    await pick(page, 1, '3XL');
    const s2 = await state(page);
    const genzari3 = v(skirt, 'Genzari', '3XL', 'Linen');
    check(`${tag} size change: URL, price and compare-at update`, s2.url.endsWith(`?variant=${genzari3.id}`) && s2.price === 299 && s2.compare === 400, JSON.stringify(s2));
    check(`${tag} size change: sale badge recalculated (25%, save 101)`, s2.badge === t('dressar.product.sale_badge', { percent: 25, amount: money(10100) }), s2.badge);
    check(`${tag} size change: Sympl follows (299.0)`, s2.sympl.length === 1 && Number(s2.sympl[0]) === 299, s2.sympl.join());
    check(`${tag} size change: add to cart enabled`, !s2.atcDisabled, s2.atcText);
    if (width < 990) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
      const s3 = await state(page);
      check(`${tag} sticky bar shows the new price and the real button label`, s3.barPrice.replace(/[^\d]/g, '') === '299' && s3.barLabel === t('products.product.add_to_cart') && s3.barDisabled === 'false', JSON.stringify({ p: s3.barPrice, l: s3.barLabel, d: s3.barDisabled }));
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
    }

    // A sold-out combination cannot be added.
    await pick(page, 0, 'coffe');
    await pick(page, 1, 'M');
    const s4 = await state(page);
    check(`${tag} sold-out variant: add to cart disabled and says so`, s4.atcDisabled && s4.atcText.includes(t('products.product.sold_out')), JSON.stringify({ d: s4.atcDisabled, t: s4.atcText }));
    if (width < 990) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
      const s5 = await state(page);
      check(`${tag} sticky bar marks the sold-out variant disabled`, s5.barDisabled === 'true', String(s5.barDisabled));
    }
    await shot(page, `pdp-${width}`, { fullPage: true });
    check(`${tag} no JS errors`, page.errors.length === 0, page.errors.join(' | '));
    await page.closeAll();
  }

  // Products without facts, and with a model size.
  const plain = await open(390, '/products/471');
  check('[390] product without category facts: no fabric & fit row', (await plain.locator('.dsr-facts').count()) === 0);
  await plain.closeAll();
  const model = await open(390, '/products/long-linen-shirt', { modelSize: 'L' });
  const modelText = await model.evaluate(() => (document.querySelector('.dsr-model-size') || {}).textContent || '');
  check('[390] model size shown from the metafield', modelText.trim() === t('dressar.product.model_size', { size: 'L' }), modelText.trim());
  const modelOrder = await model.evaluate(() => {
    const all = [...document.querySelectorAll('#MainProduct-template--1__main *')];
    return all.indexOf(document.querySelector('.dsr-model-size')) > all.indexOf(document.querySelector('.dsr-size-help')) && all.indexOf(document.querySelector('.dsr-model-size')) < all.indexOf(document.querySelector('.product-form__submit'));
  });
  check('[390] model size sits with the size help, before add to cart', modelOrder);
  await model.closeAll();

  // A link from a card's colour swatch: colour chosen, size still to pick.
  const shirt = productFor('long-linen-shirt');
  const black = shirt.variants.find((x) => x.option1 === 'Black' && x.available);
  const fromCard = await open(390, `/products/long-linen-shirt?variant=${black.id}&pick=color`);
  const colour = await fromCard.evaluate((sel) => (document.querySelector(`${sel} variant-selects fieldset input:checked`) || {}).value, info);
  await fromCard.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await fromCard.waitForTimeout(400);
  const fc = await state(fromCard);
  check('[390] from a card swatch: that colour preselected, sticky bar asks for a size', colour === 'Black' && fc.barLabel === t('dressar.product.pick_size'), `${colour} ${fc.barLabel}`);
  await fromCard.closeAll();

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
