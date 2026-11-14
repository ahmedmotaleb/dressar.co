// Product page UX refinement (docs/stages/pdp-ux.md): "Find your size", the size
// guide button, the product code, no quantity selector, no stock messages, in
// Arabic (right to left) and English, on the theme's real product page rendered by
// tests/lib/theme-harness.js. The size tables are the store's own product
// descriptions (tests/fixtures/descriptions.json).
// usage: node tests/pdp-ux.test.js [themeRoot]
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');
const { buildProduct } = require('./lib/catalog');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const SECTION = 'template--1__main';
const WIDTHS = [360, 390, 430];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });
const fill = (text, values) => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in values ? values[k] : m));

async function main() {
  const browser = await chromium.launch();
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const variants = new Map();
  catalog.products.forEach((p) => buildProduct(p).variants.forEach((v) => variants.set(String(v.id), v)));
  const skirt = buildProduct(catalog.products.find((p) => p.handle === 'linen-maxi-skirt-with-front-pockets'));
  const variantOf = (product, options) => product.variants.find((v) => options.every((o, i) => v.options[i] === o));

  // Static: what is typed never leaves the page.
  const js = fs.readFileSync(path.join(root, 'assets/dsr-find-size.js'), 'utf8');
  check('find your size: no network or storage calls in its script', !/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie/.test(js));

  // Static: Shopify's Liquid ends a {{ }} tag at a brace even inside a quoted string
  // (it refused the snippet with '{size}' placeholders); the local harness doesn't.
  const braces = [];
  for (const dir of ['snippets', 'sections', 'layout', 'blocks']) {
    const folder = path.join(root, dir);
    if (!fs.existsSync(folder)) continue;
    for (const f of fs.readdirSync(folder).filter((n) => n.endsWith('.liquid'))) {
      const text = fs.readFileSync(path.join(folder, f), 'utf8');
      for (const m of text.matchAll(/\{\{-?([\s\S]*?)-?\}\}/g)) if (/'[^']*[{}][^']*'|"[^"]*[{}][^"]*"/.test(m[1])) braces.push(`${dir}/${f}: ${m[0].slice(0, 60)}`);
    }
  }
  check('Liquid: no braces inside quoted strings in {{ }} (Shopify rejects the file)', braces.length === 0, braces.join(' | '));

  // Static: one size guide (the existing pop-up block), now drawn as a button.
  const template = readJson(path.join(root, 'templates/product.json'));
  const main = template.sections.main;
  const popups = Object.values(main.blocks).filter((b) => b.type === 'popup');
  check('template: one size guide pop-up, same page, button style', popups.length === 1 && popups[0].settings.page === 'size-chart' && popups[0].settings.dsr_style === 'size_guide', JSON.stringify(popups));
  const live = main.block_order.filter((id) => !main.blocks[id].disabled);
  const after = live.slice(live.indexOf('variant_picker') + 1, live.indexOf('buy_buttons') + 1);
  check('template: after the selectors: find your size, size guide, product code, add to cart', JSON.stringify(after) === JSON.stringify(['dsr_find_size', 'size_guide', 'sku_r8AL6g', 'buy_buttons']), JSON.stringify(after));
  check('template: quantity, stock and the old size-help link are switched off (settings kept)', ['quantity_selector', 'inventory_dsr', 'dsr_size_help'].every((id) => main.blocks[id] && main.blocks[id].disabled === true));

  for (const locale of ['ar', 'en.default']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    const strings = readJson(path.join(root, 'locales', `${locale}.json`));
    const fsT = strings.dressar.find_size;
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });

    const open = async (handle, width = 390) => {
      const lines = [];
      const sf = storefront({ root, harness, cartLines: lines, catalog });
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.errors = [];
      page.adds = [];
      page.requests = [];
      page.on('pageerror', (e) => page.errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && page.errors.push(m.text()));
      page.on('request', (r) => page.requests.push(r.url()));
      await routeTheme(page, {
        root,
        fontsDir,
        harness,
        imageSize: sf.imageSize,
        globalsFor: () => sf.globalsFor(),
        cartSection: sf.cartSection,
        cartJson: sf.cartJson,
        onCartAdd: async (request) => {
          const body = request.postData() || '';
          const id = (/name="id"\r\n\r\n(\d+)/.exec(body) || [])[1];
          const quantity = (/name="quantity"\r\n\r\n(\d+)/.exec(body) || [])[1] || null;
          page.adds.push({ id, quantity });
          const v = variants.get(id);
          if (v) lines.push({ handle: handle, title: handle, price: v.price, quantity: 1 });
          const sections = {};
          for (const s of ['cart-drawer', 'cart-icon-bubble']) sections[s] = await sf.cartSection(s);
          return { id: Number(id), quantity: 1, sections };
        },
        pages: (url) => sf.pages(url),
      });
      await page.goto(`http://dressar.test/products/${handle}`);
      await page.waitForTimeout(900);
      return page;
    };

    const openFinder = async (page) => {
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.click(`#DsrFindSizeOpener-${SECTION}`);
      await page.waitForTimeout(200);
    };
    const ask = (page, vals) =>
      page.evaluate((vals) => {
        const el = document.querySelector('dsr-find-size');
        const f = el.querySelector('form');
        ['height', 'weight', 'bust', 'waist', 'hips'].forEach((n) => {
          if (f.elements[n]) f.elements[n].value = vals[n] == null ? '' : String(vals[n]);
        });
        f.requestSubmit();
        const r = el.querySelector('[data-result]');
        const err = el.querySelector('[data-error]');
        const q = (s) => r.querySelector(s);
        return {
          size: q('.dsr-fs__line--size') ? q('.dsr-fs__line--size').textContent : null,
          lines: [...r.querySelectorAll('p')].map((p) => p.textContent),
          stock: q('.dsr-fs__line--in') ? 'in' : q('.dsr-fs__line--out') ? 'out' : null,
          stockText: (q('.dsr-fs__line--in') || q('.dsr-fs__line--out') || { textContent: null }).textContent,
          choose: q('.dsr-fs__choose') ? q('.dsr-fs__choose').textContent : null,
          error: err.hidden ? null : err.textContent,
        };
      }, vals);
    const shownFields = (page) =>
      page.evaluate(() => [...document.querySelectorAll('dsr-find-size [data-measure]')].filter((f) => !f.hidden && f.offsetParent).map((f) => f.dataset.measure));
    const resultText = (s) => fill(fsT.result, { size: s });

    // ---------------- Layout, at phone widths ----------------
    for (const width of WIDTHS) {
      const tag = `${L} [${width}]`;
      const page = await open('linen-maxi-skirt-with-front-pockets', width);
      const r = await page.evaluate(() => {
        const info = document.querySelector('product-info .product__info-container');
        const all = [...info.querySelectorAll('*')];
        const at = (el) => (el ? all.indexOf(el) : -1);
        const find = info.querySelector('.dsr-find-size-block .dsr-pdp-tool');
        const guide = info.querySelector('.product-popup-modal__opener .dsr-pdp-tool');
        const sku = info.querySelector('.product__sku');
        const add = info.querySelector('.product-form__submit');
        const picker = info.querySelector('variant-selects');
        const box = (e) => e.getBoundingClientRect();
        const cs = (e) => getComputedStyle(e);
        const tool = (b) => {
          const icon = b.querySelector('.dsr-pdp-tool__icon');
          const label = b.querySelector('.dsr-pdp-tool__label');
          return {
            text: label.textContent.trim(),
            radius: cs(b).borderTopLeftRadius,
            bg: cs(b).backgroundColor,
            border: `${cs(b).borderTopWidth} ${cs(b).borderTopColor}`,
            h: Math.round(box(b).height),
            w: Math.round(box(b).width),
            iconBg: cs(icon).backgroundColor,
            iconSide: Math.abs(box(icon).right - box(b).right) <= 1.5 ? 'right' : Math.abs(box(icon).left - box(b).left) <= 1.5 ? 'left' : 'middle',
            labelAlign: cs(label).justifyContent + '/' + cs(b).direction,
            hasSvg: Boolean(icon.querySelector('svg')),
          };
        };
        // Everything but the merchant's description (which may say "available in several colours").
        const copy = info.cloneNode(true);
        copy.querySelectorAll('.product__description').forEach((d) => d.remove());
        const text = copy.textContent.replace(/\s+/g, ' ');
        return {
          order: [picker, find, guide, sku, add].map(at),
          tops: [picker, find, guide, sku, add].map((e) => (e ? Math.round(box(e).top) : -1)),
          find: find && tool(find),
          guide: guide && tool(guide),
          formWidth: Math.round(box(add).width),
          sku: sku && { label: sku.querySelector('.dsr-sku__label').textContent.trim(), value: sku.querySelector('.dsr-sku__value').textContent.trim(), gap: Math.round(box(sku).top - box(guide).bottom) },
          quantity: Boolean(document.querySelector('product-info .product-form__quantity, product-info quantity-input, product-info input[name="quantity"], [id^="Quantity-Form-"]')),
          inventory: Boolean(info.querySelector('.product__inventory, [id^="Inventory-"]')),
          text,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      const ok = (a) => a.every((v, i) => v > -1 && (i === 0 || v > a[i - 1]));
      check(`${tag} order: selectors, find your size, size guide, product code, add to cart (page and screen)`, ok(r.order) && ok(r.tops), JSON.stringify([r.order, r.tops]));
      check(`${tag} labels: "${fsT.button}", "${strings.dressar.product.size_guide}"`, r.find.text === fsT.button && r.guide.text === strings.dressar.product.size_guide, `${r.find.text} | ${r.guide.text}`);
      for (const [name, b] of [['find your size', r.find], ['size guide', r.guide]]) {
        check(`${tag} ${name}: white, 8px corners, #D9D9D9 edge, at least 48px high, full width`, b.bg === 'rgb(255, 255, 255)' && b.radius === '8px' && b.border === '1px rgb(217, 217, 217)' && b.h >= 48 && Math.abs(b.w - r.formWidth) <= 1, JSON.stringify(b));
        check(`${tag} ${name}: light grey icon area with an icon, on the ${rtl ? 'right' : 'left'}`, b.iconBg === 'rgb(242, 242, 242)' && b.hasSvg && b.iconSide === (rtl ? 'right' : 'left'), JSON.stringify(b));
      }
      check(`${tag} product code: "${strings.dressar.product.product_code}:" and the variant's SKU, right under the buttons`, r.sku.label === `${strings.dressar.product.product_code}:` && r.sku.value === variantOf(skirt, ['olive', 'L', 'Linen']).sku && r.sku.gap >= 0 && r.sku.gap <= 16, JSON.stringify(r.sku));
      check(`${tag} no quantity selector`, !r.quantity);
      const stockWords = [strings.products.product.inventory_low_stock, strings.products.product.inventory_in_stock, fill(strings.products.product.inventory_low_stock_show_count, { quantity: '' }).trim()].filter(Boolean);
      check(`${tag} no stock messages`, !r.inventory && stockWords.every((w) => !r.text.includes(w)), stockWords.filter((w) => r.text.includes(w)).join(' | '));
      check(`${tag} no sideways scrolling`, r.overflow <= 0, String(r.overflow));

      await openFinder(page);
      const m = await page.evaluate(() => {
        const d = document.querySelector('.dsr-find-size-modal [role="dialog"]').getBoundingClientRect();
        const inputs = [...document.querySelectorAll('.dsr-find-size-modal input')].filter((i) => i.offsetParent).map((i) => i.getBoundingClientRect());
        return { left: d.left, right: d.right, vw: document.documentElement.clientWidth, inputsInside: inputs.every((b) => b.left >= d.left && b.right <= d.right), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      check(`${tag} find your size dialog fits the screen`, m.left >= 0 && m.right <= m.vw && m.inputsInside && m.overflow <= 0, JSON.stringify(m));
      check(`${tag} no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.context().close();
    }

    // ---------------- The two dialogs ----------------
    {
      const tag = `${L} dialogs`;
      const page = await open('linen-maxi-skirt-with-front-pockets');
      const state = () =>
        page.evaluate(() => ({
          guide: document.querySelector('#PopupModal-size_guide').hasAttribute('open'),
          finder: document.querySelector('#DsrFindSize-template--1__main').hasAttribute('open'),
          guideText: document.querySelector('#PopupModal-size_guide').textContent.replace(/\s+/g, ' ').trim().slice(0, 120),
          focusIn: document.activeElement && document.activeElement.closest('modal-dialog') ? document.activeElement.closest('modal-dialog').id : null,
          guides: document.querySelectorAll('modal-dialog.product-popup-modal:not(.dsr-find-size-modal)').length,
        }));
      await page.click('#ProductPopup-size_guide');
      await page.waitForTimeout(250);
      let s = await state();
      check(`${tag}: size guide button opens the existing size chart pop-up, only that one`, s.guide && !s.finder && s.focusIn === 'PopupModal-size_guide' && /size|مقاس/i.test(s.guideText), JSON.stringify(s));
      check(`${tag}: one size guide pop-up on the page`, s.guides === 1, String(s.guides));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      s = await state();
      const backOnGuide = await page.evaluate(() => document.activeElement && document.activeElement.id);
      check(`${tag}: Escape closes it and returns focus to the button`, !s.guide && backOnGuide === 'ProductPopup-size_guide', backOnGuide);
      await openFinder(page);
      s = await state();
      check(`${tag}: find your size opens its own dialog, only that one`, s.finder && !s.guide && s.focusIn === 'DsrFindSize-template--1__main', JSON.stringify(s));
      const head = await page.evaluate(() => ({
        title: document.querySelector('.dsr-fs__title').textContent.trim(),
        labelled: document.querySelector('.dsr-find-size-modal [role="dialog"]').getAttribute('aria-labelledby') === document.querySelector('.dsr-fs__title').id,
        fields: [...document.querySelectorAll('dsr-find-size .dsr-fs__row:first-child .dsr-fs__label')].map((l) => l.textContent.trim()),
        submit: document.querySelector('.dsr-fs__submit').textContent.trim(),
        types: ['height', 'weight'].map((n) => document.querySelector(`dsr-find-size input[name="${n}"]`).type),
      }));
      check(`${tag}: "${fsT.button}" asks height (cm) and weight (kg); button "${fsT.submit}"`, head.title === fsT.button && head.labelled && JSON.stringify(head.fields) === JSON.stringify([fsT.height, fsT.weight]) && head.submit === fsT.submit && head.types.join() === 'number,number', JSON.stringify(head));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      s = await state();
      check(`${tag}: Escape closes it`, !s.finder);
      check(`${tag}: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.context().close();
    }

    // ---------------- Recommendations from the product's own table (waist + hips) ----------------
    {
      const tag = `${L} skirt (table: waist, hips)`;
      const page = await open('linen-maxi-skirt-with-front-pockets');
      await openFinder(page);
      check(`${tag}: asks only for the measurements its table has: waist, hips`, JSON.stringify(await shownFields(page)) === '["waist","hips"]', JSON.stringify(await shownFields(page)));
      const before = page.requests.length;
      const storage = await page.evaluate(() => localStorage.length + sessionStorage.length);

      let a = await ask(page, { height: 163, weight: 60 });
      const need = fill(fsT.need, { list: [fsT.waist_name, fsT.hips_name].join(fsT.or) });
      check(`${tag}: height and weight alone: no size, asks for waist or hips`, a.size === null && a.lines[0] === need && !a.choose, JSON.stringify(a));
      const cases = [
        [{ waist: 76 }, 'M', 'at the limit (76)'],
        [{ waist: 76.5 }, 'L', 'just over M: the larger size'],
        [{ waist: 80 }, 'L', 'at the L limit (80)'],
        [{ waist: 81 }, 'XL', 'just over L'],
        [{ waist: 79, hips: 111 }, 'XL', 'both must fit: hips 111 needs XL'],
        [{ hips: 122 }, '3XL', 'hips only'],
      ];
      for (const [vals, size, why] of cases) {
        a = await ask(page, { height: 163, weight: 60, ...vals });
        check(`${tag}: ${JSON.stringify(vals)} -> ${size} (${why})`, a.size === resultText(size) && a.lines.includes(fsT.basis_product), JSON.stringify(a));
      }
      a = await ask(page, { height: 163, weight: 60, waist: 79 });
      const limits = `${fill(fsT.fits, { size: 'L' })} ${fsT.waist_name} 80 ${fsT.cm} · ${fsT.hips_name} 110 ${fsT.cm}`;
      check(`${tag}: shows the table's limits for that size`, a.lines.includes(limits), JSON.stringify(a.lines));
      a = await ask(page, { height: 163, weight: 60, waist: 93 });
      check(`${tag}: above the largest size: no size, says so (3XL)`, a.size === null && a.lines[0] === fill(fsT.too_big, { size: '3XL' }) && !a.choose, JSON.stringify(a));
      const light = await ask(page, { height: 163, weight: 40, waist: 79 });
      const heavy = await ask(page, { height: 163, weight: 120, waist: 79 });
      check(`${tag}: weight never changes the size`, light.size === heavy.size && light.size === resultText('L') && light.lines.includes(fsT.weight_note), JSON.stringify([light.size, heavy.size]));
      const tall = await ask(page, { height: 180, weight: 60, waist: 79 });
      const mid = await ask(page, { height: 160, weight: 60, waist: 79 });
      const note = fill(fsT.height_note, { min: 155, max: 170 });
      check(`${tag}: height outside 155–170 cm only adds the chart's note, same size`, tall.lines.includes(note) && !mid.lines.includes(note) && tall.size === mid.size, JSON.stringify([tall.lines, mid.lines]));
      a = await ask(page, { height: 20, weight: 60, waist: 79 });
      check(`${tag}: impossible height: error, no size`, a.error === fsT.invalid_height && a.lines.length === 0, JSON.stringify(a));
      a = await ask(page, { height: 163, weight: '', waist: 79 });
      check(`${tag}: weight missing: error, no size`, a.error === fsT.invalid_weight && a.lines.length === 0, JSON.stringify(a));
      a = await ask(page, { height: 163, weight: 60, waist: 300 });
      check(`${tag}: impossible measurement: error, no size`, a.error === fsT.invalid_measure && a.lines.length === 0, JSON.stringify(a));

      // Stock for the colour chosen on the page (olive: only L in stock).
      a = await ask(page, { height: 163, weight: 60, waist: 79 });
      check(`${tag}: L in olive: "${fill(fsT.available, { color: 'olive' })}" and a choose button`, a.stock === 'in' && a.stockText === fill(fsT.available, { color: 'olive' }) && a.choose === fill(fsT.choose, { size: 'L' }), JSON.stringify(a));
      a = await ask(page, { height: 163, weight: 60, waist: 81 });
      check(`${tag}: XL in olive is sold out: says so, nothing to choose`, a.size === resultText('XL') && a.stock === 'out' && a.stockText === fill(fsT.sold_out, { color: 'olive' }) && !a.choose, JSON.stringify(a));
      const storageAfter = await page.evaluate(() => localStorage.length + sessionStorage.length);
      check(`${tag}: nothing sent or stored while finding a size`, page.requests.length === before && storageAfter === storage, page.requests.slice(before).join(' | '));

      // Choose another colour, then let the dialog pick the size: the variant, URL and SKU follow; nothing is added.
      await page.keyboard.press('Escape');
      await page.evaluate(() => {
        const input = [...document.querySelectorAll('product-info variant-selects fieldset')][0].querySelector('input[value="Genzari"]');
        document.querySelector(`label[for="${input.id}"]`).click();
      });
      await page.waitForTimeout(1200);
      await openFinder(page);
      a = await ask(page, { height: 163, weight: 60, waist: 70 });
      check(`${tag}: Genzari: M, "${fill(fsT.available, { color: 'Genzari' })}"`, a.size === resultText('M') && a.stockText === fill(fsT.available, { color: 'Genzari' }), JSON.stringify(a));
      await page.click('.dsr-fs__choose');
      await page.waitForTimeout(1200);
      const target = variantOf(skirt, ['Genzari', 'M', 'Linen']);
      const after = await page.evaluate(() => ({
        open: document.querySelector('#DsrFindSize-template--1__main').hasAttribute('open'),
        size: [...document.querySelectorAll('product-info variant-selects fieldset')][1].querySelector('input:checked').value,
        url: location.search,
        sku: document.querySelector('product-info .product__sku .dsr-sku__value').textContent.trim(),
        skuLabel: document.querySelector('product-info .product__sku .dsr-sku__label').textContent.trim(),
      }));
      check(`${tag}: "${fill(fsT.choose, { size: 'M' })}" picks M on the page and closes the dialog`, !after.open && after.size === 'M' && after.url.includes(`variant=${target.id}`), JSON.stringify(after));
      check(`${tag}: product code follows the variant (${target.sku}), label kept`, after.sku === target.sku && after.skuLabel === `${strings.dressar.product.product_code}:`, JSON.stringify(after));
      check(`${tag}: nothing added to the cart by the dialog`, page.adds.length === 0, JSON.stringify(page.adds));

      // Add to cart: one unit of the chosen variant.
      await page.click('product-info .product-form__submit');
      await page.waitForTimeout(900);
      check(`${tag}: add to cart: one request, the chosen variant, quantity 1 (none sent: Shopify's default)`, page.adds.length === 1 && page.adds[0].id === String(target.id) && (page.adds[0].quantity === null || page.adds[0].quantity === '1'), JSON.stringify(page.adds));
      await page.evaluate(() => document.querySelector('cart-drawer') && document.querySelector('cart-drawer').close && document.querySelector('cart-drawer').close());
      await page.waitForTimeout(400);

      // Sold out stays unpurchasable: olive XL.
      for (const [set, value] of [[0, 'olive'], [1, 'XL']]) {
        await page.evaluate(([set, value]) => {
          const box = [...document.querySelectorAll('product-info variant-selects fieldset')][set];
          const input = [...box.querySelectorAll('input')].find((i) => i.value === value);
          document.querySelector(`label[for="${input.id}"]`).click();
        }, [set, value]);
        await page.waitForTimeout(1200);
      }
      const sold = await page.evaluate(() => {
        const b = document.querySelector('product-info .product-form__submit');
        return { disabled: b.disabled, text: b.textContent.trim() };
      });
      await page.evaluate(() => document.querySelector('product-info .product-form__submit').click());
      await page.waitForTimeout(600);
      check(`${tag}: sold-out variant (olive XL): add to cart disabled, nothing added`, sold.disabled && sold.text === strings.products.product.sold_out && page.adds.length === 1, JSON.stringify([sold, page.adds]));

      // Sticky add to cart (phones): available variant, one unit.
      for (const [set, value] of [[0, 'Genzari'], [1, 'XL']]) {
        await page.evaluate(([set, value]) => {
          const box = [...document.querySelectorAll('product-info variant-selects fieldset')][set];
          const input = [...box.querySelectorAll('input')].find((i) => i.value === value);
          document.querySelector(`label[for="${input.id}"]`).click();
        }, [set, value]);
        await page.waitForTimeout(1200);
      }
      await page.evaluate(() => {
        const f = document.querySelector('product-info product-form');
        window.scrollTo(0, f.getBoundingClientRect().bottom + window.scrollY + 160);
      });
      await page.waitForTimeout(700);
      const bar = await page.evaluate(() => {
        const el = document.querySelector('[data-dsr-sticky-atc]');
        return { visible: el.classList.contains('is-visible'), label: el.querySelector('[data-dsr-sticky-btn]').textContent.trim() };
      });
      await page.click('[data-dsr-sticky-btn]');
      await page.waitForTimeout(900);
      const xl = variantOf(skirt, ['Genzari', 'XL', 'Linen']);
      check(`${tag}: sticky add to cart: shown, adds one unit of the chosen variant`, bar.visible && bar.label === strings.products.product.add_to_cart && page.adds.length === 2 && page.adds[1].id === String(xl.id) && (page.adds[1].quantity === null || page.adds[1].quantity === '1'), JSON.stringify([bar, page.adds]));
      check(`${tag}: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.context().close();
    }

    // ---------------- Other tables, and the chart when there is no table ----------------
    {
      let page = await open('long-linen-shirt');
      await openFinder(page);
      let tag = `${L} shirt dress (table: bust)`;
      check(`${tag}: asks only for bust`, JSON.stringify(await shownFields(page)) === '["bust"]', JSON.stringify(await shownFields(page)));
      let a = await ask(page, { height: 165, weight: 70, bust: 104 });
      check(`${tag}: bust 104 -> L (fits up to 106), from the piece's table`, a.size === resultText('L') && a.lines.includes(fsT.basis_product), JSON.stringify(a));
      a = await ask(page, { height: 165, weight: 70 });
      check(`${tag}: height and weight alone: asks for bust, no size`, a.size === null && a.lines[0] === fill(fsT.need, { list: fsT.bust_name }), JSON.stringify(a));
      check(`${tag}: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.context().close();

      page = await open('lined-joubert-maxi-skirt');
      await openFinder(page);
      tag = `${L} lined skirt (table: waist)`;
      check(`${tag}: asks only for waist`, JSON.stringify(await shownFields(page)) === '["waist"]', JSON.stringify(await shownFields(page)));
      a = await ask(page, { height: 158, weight: 55, waist: 84 });
      check(`${tag}: waist 84 -> XL`, a.size === resultText('XL') && a.lines.includes(fsT.basis_product), JSON.stringify(a));
      await page.context().close();

      page = await open('471');
      await openFinder(page);
      tag = `${L} no size table (Dressar chart)`;
      check(`${tag}: asks for bust, waist, hips`, JSON.stringify(await shownFields(page)) === '["bust","waist","hips"]', JSON.stringify(await shownFields(page)));
      a = await ask(page, { height: 160, weight: 65, waist: 75 });
      check(`${tag}: waist 75 -> M (chart: 76), "${fsT.basis_chart}"`, a.size === resultText('M') && a.lines.includes(fsT.basis_chart), JSON.stringify(a));
      a = await ask(page, { height: 160, weight: 65, bust: 107 });
      check(`${tag}: bust 107 -> XL (chart: L 106, XL 110)`, a.size === resultText('XL'), JSON.stringify(a));
      a = await ask(page, { height: 160, weight: 65, bust: 116 });
      check(`${tag}: bust 116 is over its largest size, XXL (114): no size`, a.size === null && a.lines[0] === fill(fsT.too_big, { size: 'XXL' }), JSON.stringify(a));
      check(`${tag}: no JS errors`, page.errors.length === 0, page.errors.join(' | '));

      // The script on data the fixtures don't have: one size; sizes no table or chart covers;
      // a table with only flat garment widths (not body measurements).
      const special = await page.evaluate(() => {
        const base = document.querySelector('dsr-find-size');
        const data = JSON.parse(base.querySelector('[data-dsr-fs-data]').textContent);
        const run = (patch) => {
          const el = base.cloneNode(true);
          el.querySelector('[data-dsr-fs-data]').textContent = JSON.stringify({ ...data, ...patch });
          el.querySelector('[data-result]').replaceChildren();
          document.body.appendChild(el);
          const out = { form: !el.querySelector('form').hidden, text: el.querySelector('[data-result]').textContent };
          el.remove();
          return out;
        };
        const opts = (sizes) => data.options.map((o, i) => (i === data.sizeIndex ? sizes.map((n, j) => ({ id: 9000 + j, name: n })) : o));
        return {
          one: run({ options: opts(['One size']) }),
          odd: run({ options: opts(['175 X 70 cm', '4-6']), tables: [] }),
          flat: run({ options: opts(['4-6', '8-10']), tables: ['<table><tr><td>المقاس</td><td>عرض الصدر مسطّح</td></tr><tr><td>4-6</td><td>40</td></tr><tr><td>8-10</td><td>44</td></tr></table>'] }),
          noChart: run({ chart: '', tables: [] }),
        };
      });
      check(`${tag}: one size: says so, no form`, !special.one.form && special.one.text === fill(fsT.one_size, { size: 'One size' }), JSON.stringify(special.one));
      check(`${tag}: sizes no table or chart covers: no size, no form, says it can't be calculated`, !special.odd.form && special.odd.text === fsT.no_data, JSON.stringify(special.odd));
      check(`${tag}: table with only flat garment widths: not used as body sizes`, !special.flat.form && special.flat.text === fsT.no_data, JSON.stringify(special.flat));
      check(`${tag}: chart setting emptied and no table: no size`, !special.noChart.form && special.noChart.text === fsT.no_data, JSON.stringify(special.noChart));
      await page.context().close();
    }
  }

  await browser.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `  -> ${r.detail}`}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
