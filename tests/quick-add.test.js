// Quick add on product cards (snippets/dsr-card-quick-add.liquid): the square
// "+" button's look, position (both directions), reveal rules and behaviour,
// on the theme's real pages rendered by tests/lib/theme-harness.js and driven
// in Chromium. Adds go through Dawn's own product-form.js and quick-add.js
// against a /cart/add the harness answers like Shopify (with the cart drawer
// and cart bubble sections).
// usage: node tests/quick-add.test.js [themeRoot]
'use strict';

const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');
const { buildProduct } = require('./lib/catalog');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const WIDTHS = [360, 390, 430, 768, 1280, 1440];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

// The fixture catalog plus two one-variant products (like the store's one-size
// "Soft Pink Shirt"), one of them sold out, and a small collection that starts
// with them: one-size, sold-out one-size, then two products with sizes.
function testCatalog() {
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const offset = catalog.products.length;
  catalog.products.push(
    {
      handle: 'soft-pink-shirt',
      title: 'Soft Pink Shirt',
      type: 'Shirt',
      created: 1,
      options: [{ name: 'Color', values: [['Pink', '#FFC0CB']] }, { name: 'Size', values: ['One size'] }],
      media: [[1080, 1440]],
      variants: [[['Pink', 'One size'], 54900, 0, 1, 0]],
    },
    {
      handle: 'wool-scarf',
      title: 'Wool Scarf',
      type: 'Accessory',
      created: 1,
      options: [{ name: 'Color', values: [['Brown', '#9A5630']] }, { name: 'Size', values: ['One size'] }],
      media: [[1080, 1440]],
      variants: [[['Brown', 'One size'], 39900, 0, 0, 0]],
    }
  );
  catalog.collections.qa = { title: 'Quick add', size: 4, offset, description: '' };
  return catalog;
}

async function main() {
  const browser = await chromium.launch();
  const catalog = testCatalog();
  const variants = new Map();
  // Collections repeat the fixture products with numbered copies (handle-1, -2): their variants too.
  catalog.products.forEach((p) => [0, 1, 2].forEach((n) => {
    const product = buildProduct(p, n);
    product.variants.forEach((v) => variants.set(String(v.id), { product, variant: v }));
  }));

  for (const locale of ['en.default', 'ar']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });
    const strings = readJson(path.join(root, 'locales', `${locale}.json`));
    const label = strings.dressar.card.quick_add;
    const template = readJson(path.join(root, 'templates/product.json'));
    const related = template.sections['related-products'];

    // A fresh page with its own cart; /cart/add answers after 500 ms so a second click lands mid-request.
    const open = async (width, pagePath, { touch = false } = {}) => {
      const lines = [];
      const sf = storefront({ root, harness, cartLines: lines, catalog });
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: touch, isMobile: touch });
      const page = await context.newPage();
      page.errors = [];
      page.adds = [];
      page.on('pageerror', (e) => page.errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && page.errors.push(m.text()));
      await routeTheme(page, {
        root,
        fontsDir,
        harness,
        imageSize: sf.imageSize,
        globalsFor: () => sf.globalsFor(),
        cartSection: sf.cartSection,
        cartJson: sf.cartJson,
        onCartAdd: async (request) => {
          const id = (/name="id"\r\n\r\n(\d+)/.exec(request.postData() || '') || [])[1];
          page.adds.push(id);
          await new Promise((r) => setTimeout(r, 500));
          const found = variants.get(id);
          if (found) lines.push({ handle: found.product.handle, title: found.product.title, price: found.variant.price, quantity: 1 });
          const sections = {};
          for (const s of ['cart-drawer', 'cart-icon-bubble']) sections[s] = await sf.cartSection(s);
          return { id: Number(id), quantity: 1, sections };
        },
        pages: async (url) => {
          if (url.pathname === '/recommendations/products') {
            const id = Number(url.searchParams.get('product_id'));
            const list = catalog.products.slice(0, 8).map((p) => buildProduct(p)).filter((p) => p.id !== id).slice(0, 4);
            const g = harness.globals({ path: url.pathname, pageType: 'product', overrides: { recommendations: { performed: true, intent: 'related', products: list, products_count: list.length } } });
            return harness.renderSection('related-products', url.searchParams.get('section_id'), related, g);
          }
          return sf.pages(url);
        },
      });
      await page.goto(`http://dressar.test${pagePath}`);
      await page.waitForTimeout(700);
      page.closeAll = () => context.close();
      return page;
    };
    const cardSel = (handle) => `#product-grid > li:has(a.full-unstyled-link[href^="/products/${handle}"])`;

    for (const width of WIDTHS) {
      if (rtl && ![390, 1280].includes(width)) continue;
      const tag = `${L} [${width}]`;
      const desktop = width >= 990;

      // ---------- Look and position, on the collection page ----------
      {
        const page = await open(width, '/collections/skirts');
        const r = await page.evaluate((rtl) => {
          const items = [...document.querySelectorAll('#product-grid > li')];
          const cards = items.map((li) => {
            const b = li.querySelector('.dsr-quick-add__button');
            if (!b) return { missing: true };
            const cs = getComputedStyle(b);
            const box = b.getBoundingClientRect();
            const img = li.querySelector('.card__inner').getBoundingClientRect();
            const svg = b.querySelector('svg').getBoundingClientRect();
            const badge = [...li.querySelectorAll('.card__badge .badge')].find((x) => x.getClientRects().length);
            const bb = badge && badge.getBoundingClientRect();
            return {
              count: li.querySelectorAll('.dsr-quick-add__button').length,
              // Layout size, not the on-screen box: while Dawn's reveal-on-scroll slides a
              // card in, a fractional translateY makes the box 37.999996 or 38.000004 tall.
              w: b.offsetWidth, h: b.offsetHeight,
              border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
              radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, shadow: cs.boxShadow, color: cs.color,
              icon: [Math.round(svg.width), Math.round(svg.height)],
              iconCentred: Math.abs(svg.left + svg.width / 2 - (box.left + box.width / 2)) < 1 && Math.abs(svg.top + svg.height / 2 - (box.top + box.height / 2)) < 1,
              text: [...b.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(''),
              bag: b.querySelector('svg').classList.contains('icon-cart-empty'),
              bottom: Math.round(img.bottom - box.bottom),
              // Bottom-right in both reading directions (docs/stages/card-upgrade.md).
              end: Math.round(img.right - box.right),
              overlapsBadge: bb ? !(bb.right <= box.left || bb.left >= box.right || bb.bottom <= box.top || bb.top >= box.bottom) : false,
            };
          });
          return { cards, n: items.length };
        }, rtl);
        const c = r.cards;
        check(`${tag} collection: one quick-add button per card`, r.n > 0 && c.every((x) => x.count === 1), JSON.stringify(c.map((x) => x.count)));
        // The detail lists the cards that fail, by position in the grid.
        const failing = (ok) => JSON.stringify(c.map((x, i) => ({ i, ...x })).filter((x) => !ok(x)));
        // The compact V2 (docs/stages/card-v2.md): a small translucent bag.
        const edge = desktop ? 12 : 10;
        const looks = (x) => x.w === 32 && x.h === 32 && x.bg === 'rgba(255, 255, 255, 0.88)' && x.radius === '8px';
        const iconOnly = (x) => x.icon.join() === '28,28' && x.iconCentred && x.color === 'rgb(17, 17, 17)' && x.text === '' && x.bag;
        check(`${tag} small bag button: 32 x 32 px, translucent white, 8px corners`, c.every(looks), failing(looks));
        check(`${tag} icon only: a dark shopping bag, centred, no text`, c.every(iconOnly), failing(iconOnly));
        check(`${tag} on the photo's bottom-right corner, ${edge}px in`, c.every((x) => x.bottom === edge && x.end === edge), JSON.stringify(c.map((x) => [x.bottom, x.end])));
        check(`${tag} clear of the sale or sold-out badge`, c.every((x) => !x.overlapsBadge));

        // Accessible name, hit test, photo still opens the product.
        const first = await page.evaluate(() => {
          const li = document.querySelector('#product-grid > li');
          const b = li.querySelector('.dsr-quick-add__button');
          const name = b.getAttribute('aria-labelledby').split(' ').map((id) => document.getElementById(id).textContent.trim());
          const box = b.getBoundingClientRect();
          const img = li.querySelector('.card__inner').getBoundingClientRect();
          const onButton = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          const onPhoto = document.elementFromPoint(img.left + img.width / 3, img.top + img.height / 3);
          return {
            name,
            href: li.querySelector('a.full-unstyled-link').getAttribute('href'),
            onButton: Boolean(onButton && onButton.closest('.dsr-quick-add__button')),
            photoLink: onPhoto && onPhoto.closest('a') ? onPhoto.closest('a').getAttribute('href') : null,
          };
        });
        check(`${tag} accessible name "${label}" + product title`, first.name[0] === label && first.name[1].length > 0, first.name.join(' | '));
        check(`${tag} the button takes the tap (above the card link)`, first.onButton);
        check(`${tag} the rest of the photo still opens the product`, first.photoLink === first.href, `${first.photoLink} vs ${first.href}`);

        const sold = await page.evaluate(() => document.querySelector('#product-grid > li:has(a[href^="/products/linen-suit"]) .dsr-quick-add__button').disabled);
        check(`${tag} sold-out product: button disabled`, sold);

        // Reveal rules.
        const restOpacity = await page.evaluate(() => getComputedStyle(document.querySelector('#product-grid > li .dsr-quick-add')).opacity);
        if (desktop) {
          check(`${tag} desktop: hidden until hover or focus`, restOpacity === '0', restOpacity);
          // The card link covers the photo (Dawn), so move the mouse rather than hover an element.
          const box = await page.locator('#product-grid > li:first-child .card__inner').boundingBox();
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(300);
          const hover = await page.evaluate(() => getComputedStyle(document.querySelector('#product-grid > li .dsr-quick-add')).opacity);
          check(`${tag} desktop: shown on hover`, hover === '1', hover);
          await page.mouse.move(0, 0);
          await page.evaluate(() => document.querySelector('#product-grid > li:nth-child(2) .dsr-quick-add__button').focus());
          await page.waitForTimeout(300);
          const focus = await page.evaluate(() => getComputedStyle(document.querySelector('#product-grid > li:nth-child(2) .dsr-quick-add')).opacity);
          check(`${tag} desktop: shown on keyboard focus`, focus === '1', focus);
        } else {
          check(`${tag} phone/tablet: always shown`, restOpacity === '1', restOpacity);
        }
        check(`${tag} collection: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        check(`${tag} collection: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
        await page.closeAll();
      }

      // ---------- One variant: straight to the cart, once ----------
      {
        const page = await open(width, '/collections/qa');
        const before = await page.evaluate(() => (document.querySelector('#cart-icon-bubble .cart-count-bubble') || {}).textContent?.trim() || '0');
        const btn = `${cardSel('soft-pink-shirt')} .dsr-quick-add__button`;
        await page.click(btn);
        await page.click(btn, { force: true }).catch(() => {});
        await page.waitForTimeout(1500);
        const after = await page.evaluate(() => ({
          drawer: document.querySelector('cart-drawer').classList.contains('active'),
          bubble: (document.querySelector('#cart-icon-bubble .cart-count-bubble span[aria-hidden]') || {}).textContent?.trim(),
          line: (document.querySelector('cart-drawer .cart-item__name') || {}).textContent?.trim(),
        }));
        const pink = buildProduct(catalog.products.find((p) => p.handle === 'soft-pink-shirt')).variants[0].id;
        check(`${tag} one-size product: one click adds it (one request, its variant)`, page.adds.length === 1 && page.adds[0] === String(pink), JSON.stringify(page.adds));
        check(`${tag} one-size product: a second click while adding is ignored`, page.adds.length === 1);
        check(`${tag} one-size product: cart drawer opens with it, count ${before} -> 1`, after.drawer && after.bubble === '1' && after.line === 'Soft Pink Shirt', JSON.stringify(after));

        const soldOut = await page.evaluate((sel) => document.querySelector(sel).disabled, `${cardSel('wool-scarf')} .dsr-quick-add__button`);
        await page.click(`${cardSel('wool-scarf')} .dsr-quick-add__button`, { force: true, timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(400);
        check(`${tag} sold-out one-size product: disabled, nothing added`, soldOut && page.adds.length === 1);
        check(`${tag} quick add: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
        await page.closeAll();
      }

      // ---------- Several variants: the size picker, then the cart ----------
      {
        const page = await open(width, '/collections/qa');
        const card = cardSel('linen-maxi-skirt-with-front-pockets');
        const cardBox = await page.locator(`${card} .card__inner`).boundingBox();
        await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
        await page.click(`${card} .dsr-quick-add__button`);
        await page.waitForSelector('quick-add-modal[open] variant-selects', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);
        const modal = await page.evaluate(() => {
          const m = document.querySelector('quick-add-modal[open]');
          if (!m) return null;
          const shown = (sel) => [...m.querySelectorAll(sel)].some((e) => e.getClientRects().length);
          return {
            picker: shown('variant-selects'),
            add: shown('button[name="add"]'),
            breadcrumbs: shown('.dsr-breadcrumbs'),
            inViewport: (() => { const r = m.querySelector('.quick-add-modal__content').getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1; })(),
          };
        });
        check(`${tag} sizes: opens Dawn's variant and size picker`, modal && modal.picker && modal.add, JSON.stringify(modal));
        check(`${tag} sizes: picker without the page's breadcrumbs, inside the screen`, modal && !modal.breadcrumbs && modal.inViewport, JSON.stringify(modal));
        // Pick Genzari (every size in stock in the fixtures), another size, then add.
        const genzari = await page.evaluate(() => {
          const input = [...document.querySelectorAll('quick-add-modal[open] variant-selects input[type="radio"]')].find((i) => i.value === 'Genzari');
          return input && input.id;
        });
        if (genzari) {
          await page.click(`quick-add-modal[open] label[for="${genzari}"]`);
          await page.waitForTimeout(1200);
        }
        const size = await page.evaluate(() => {
          const set = [...document.querySelectorAll('quick-add-modal[open] variant-selects fieldset')].find((f) => /size/i.test(f.querySelector('legend').textContent));
          const input = [...set.querySelectorAll('input[type="radio"]')].find((i) => !i.checked && !i.classList.contains('disabled'));
          return input && { id: input.id, value: input.value };
        });
        if (size) await page.click(`quick-add-modal[open] label[for="${size.id}"]`);
        await page.waitForTimeout(1200);
        const chosen = await page.evaluate(() => (document.querySelector('quick-add-modal[open] product-form input[name="id"]') || {}).value);
        await page.click('quick-add-modal[open] button[name="add"]', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1800);
        const after = await page.evaluate(() => ({
          modalOpen: Boolean(document.querySelector('quick-add-modal[open]')),
          drawer: document.querySelector('cart-drawer').classList.contains('active'),
          bubble: (document.querySelector('#cart-icon-bubble .cart-count-bubble span[aria-hidden]') || {}).textContent?.trim(),
        }));
        const added = page.adds[0] && variants.get(page.adds[0]);
        check(
          `${tag} sizes: adds the variant picked in the dialog${size ? ` (size ${size.value})` : ''}, one request`,
          page.adds.length === 1 && page.adds[0] === chosen && added && added.product.handle.startsWith('linen-maxi-skirt-with-front-pockets') && (!size || added.variant.option2 === size.value), JSON.stringify(page.adds.map((id) => variants.get(id) && variants.get(id).variant.title)));
        check(`${tag} sizes: picker closes, cart drawer opens, count 1`, !after.modalOpen && after.drawer && after.bubble === '1', JSON.stringify(after));
        check(`${tag} sizes: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
        await page.closeAll();
      }

      // ---------- Colour and size chosen on the card: the bag adds exactly that ----------
      {
        const page = await open(width, '/collections/qa');
        const card = cardSel('linen-maxi-skirt-with-front-pockets');
        // This card's own variants (the collection shows a numbered copy of the linen skirt).
        const linen = (await page.evaluate((sel) => JSON.parse(document.querySelector(`${sel} script[data-dsr-card-variants]`).textContent), card)).map(([id, available, options]) => ({
          id,
          available: Boolean(available),
          option1: options[0],
          option2: options[1],
        }));
        await page.locator(`${card} .dsr-card-swatch[aria-label="olive"], ${card} .dsr-card-swatch[data-value="olive"]`).first().click();
        await page.waitForTimeout(200);
        const olive = await page.evaluate((sel) => [...document.querySelectorAll(`${sel} .dsr-card-size`)].map((b) => `${b.dataset.value}:${b.getAttribute('aria-disabled') === 'true' ? 'x' : 'ok'}`).join(), card);
        const oliveOpen = linen.filter((v) => v.option1 === 'olive' && v.available).map((v) => v.option2);
        check(`${tag} card: sizes follow the chosen colour (olive: only ${oliveOpen.join(', ')} in stock)`, olive.split(',').every((x) => x.endsWith(':ok') === oliveOpen.includes(x.split(':')[0])), olive);
        // A struck-through size can't be chosen.
        const struck = olive.split(',').find((x) => x.endsWith(':x'));
        if (struck) {
          await page.locator(`${card} .dsr-card-size[data-value="${struck.split(':')[0]}"]`).click({ force: true });
          const pressed = await page.evaluate((sel) => document.querySelectorAll(`${sel} .dsr-card-size[aria-pressed="true"]`).length, card);
          check(`${tag} card: a size not in stock can't be chosen`, pressed === 0, pressed);
        }
        // No size chosen yet: the bag opens the dialog, adds nothing.
        const cardBox = await page.locator(`${card} .card__inner`).boundingBox();
        await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
        await page.click(`${card} .dsr-quick-add__button`);
        await page.waitForSelector('quick-add-modal[open]', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);
        const dialogFirst = await page.evaluate(() => Boolean(document.querySelector('quick-add-modal[open]')));
        check(`${tag} card: no size chosen -> the bag opens the dialog, nothing added`, dialogFirst && page.adds.length === 0, `${dialogFirst} ${page.adds.length}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        // Genzari, size L: the bag adds exactly that variant, without the dialog.
        await page.locator(`${card} .dsr-card-swatch[data-value="Genzari"]`).click();
        await page.locator(`${card} .dsr-card-size[data-value="L"]`).click();
        await page.waitForTimeout(150);
        const wanted = linen.find((v) => v.option1 === 'Genzari' && v.option2 === 'L');
        const link = await page.evaluate((sel) => document.querySelector(`${sel} a.full-unstyled-link`).getAttribute('href'), card);
        check(`${tag} card: colour and size chosen -> the card opens that exact variant`, new RegExp(`^/products/linen-maxi-skirt-with-front-pockets(-\\d+)?\\?variant=${wanted.id}$`).test(link), link);
        await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
        await page.click(`${card} .dsr-quick-add__button`);
        await page.waitForTimeout(1500);
        const after = await page.evaluate(() => ({
          modal: Boolean(document.querySelector('quick-add-modal[open]')),
          drawer: document.querySelector('cart-drawer').classList.contains('active'),
          bubble: (document.querySelector('#cart-icon-bubble .cart-count-bubble span[aria-hidden]') || {}).textContent?.trim(),
        }));
        check(`${tag} card: the bag adds exactly Genzari / L, one request, no dialog`, page.adds.length === 1 && page.adds[0] === String(wanted.id) && !after.modal, `${JSON.stringify(page.adds)} ${JSON.stringify(after)}`);
        check(`${tag} card: cart drawer opens, count 1`, after.drawer && after.bubble === '1', JSON.stringify(after));
        check(`${tag} card choice: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
        await page.closeAll();
      }
    }

    // ---------- A picked colour carries into the picker ----------
    {
      const page = await open(390, '/collections/qa');
      const card = cardSel('linen-maxi-skirt-with-front-pockets');
      await page.click(`${card} .dsr-card-swatch[aria-label="Genzari"]`);
      await page.waitForTimeout(300);
      const swatch = await page.evaluate((c) => ({
        img: document.querySelector(`${c} .card__media img`).getAttribute('src'),
        url: document.querySelector(`${c} .dsr-quick-add__button`).getAttribute('data-product-url'),
      }), card);
      await page.click(`${card} .dsr-quick-add__button`);
      await page.waitForSelector('quick-add-modal[open] variant-selects', { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);
      const picked = await page.evaluate(() => (document.querySelector('quick-add-modal[open] variant-selects input[type="radio"]:checked') || {}).value);
      check(`${L} [390] swatches still work: Genzari shows its photo`, /linen-maxi-skirt-with-front-pockets-2\.jpg/.test(swatch.img), swatch.img);
      check(`${L} [390] the picker opens on the picked colour (Genzari)`, /variant=\d+/.test(swatch.url) && picked === 'Genzari', `${swatch.url} -> ${picked}`);
      await page.closeAll();
    }

    // ---------- Touch screen at desktop width: always shown ----------
    {
      const page = await open(1280, '/collections/skirts', { touch: true });
      const op = await page.evaluate(() => getComputedStyle(document.querySelector('#product-grid > li .dsr-quick-add')).opacity);
      check(`${L} [1280, touch] always shown on touch screens`, op === '1', op);
      await page.closeAll();
    }

    // ---------- Everywhere cards show ----------
    for (const [where, pagePath, scope, scroll] of [
      ['homepage rows', '/', 'main .product-grid', false],
      ['search results', '/search?q=linen', 'main .product-grid', false],
      ['Complete the look', '/products/linen-maxi-skirt-with-front-pockets', 'dsr-recommendations', true],
    ]) {
      for (const width of [390, 1280]) {
        const page = await open(width, pagePath);
        if (scroll) {
          await page.evaluate(() => document.querySelector('dsr-recommendations').scrollIntoView());
          await page.waitForTimeout(1500);
        }
        const r = await page.evaluate((scope) => {
          const cards = [...document.querySelectorAll(`${scope} .card-wrapper`)];
          const scripts = [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'));
          return {
            cards: cards.length,
            buttons: cards.filter((c) => c.querySelectorAll('.dsr-quick-add__button').length === 1).length,
            quickAddJs: scripts.filter((s) => /\/quick-add\.js/.test(s)).length,
            productFormJs: scripts.filter((s) => /\/product-form\.js/.test(s)).length,
            productInfoJs: scripts.filter((s) => /\/product-info\.js/.test(s)).length,
            ids: (() => { const ids = [...document.querySelectorAll('[id]')].map((e) => e.id).filter((id) => /^(QuickAdd|quick-add)-/.test(id)); return ids.length === new Set(ids).size; })(),
          };
        }, scope);
        check(`${L} [${width}] ${where}: every card has the quick-add button`, r.cards > 0 && r.buttons === r.cards, JSON.stringify(r));
        check(`${L} [${width}] ${where}: quick-add.js, product-info.js and product-form.js load once, no duplicate IDs`, r.quickAddJs === 1 && r.productFormJs === 1 && r.productInfoJs === 1 && r.ids, JSON.stringify(r));
        check(`${L} [${width}] ${where}: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
        await page.closeAll();
      }
    }
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
