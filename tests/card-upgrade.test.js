// Product card upgrade (docs/stages/card-upgrade.md): the sale badge ("38%", top-right),
// the small quick-add "+" (bottom-right), colour circles on every card (one colour
// included), the card's one price variant (price, compare-at price and badge from the
// same variant, following the chosen colour and size), the type scale and the row order.
// Arabic (right to left) and English, at 320-1440px, on the theme's real card rendered
// by tests/lib/theme-harness.js: collection, search and home rows.
// usage: node tests/card-upgrade.test.js [themeRoot]
'use strict';

const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');
const { buildProduct } = require('./lib/catalog');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1440];
const SIZES = ['M', 'L', 'XL', 'XXL', '3XL'];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

// The fixture catalog plus products shaped like the store's (Admin API, 14 Nov 2026),
// first in a test collection "cu".
function testCatalog() {
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const offset = catalog.products.length;
  const v = (options, price, compare, available, media = 0) => [options, price, compare, available, media];
  catalog.products.push(
    {
      // The store's Turquoise Velvet Jacket: one colour (Navy, #282099) on a linked option.
      handle: 'turquoise-velvet-jacket',
      title: 'Turquoise Velvet Jacket | جاكيت قطيفة تركواز',
      type: 'Jacket',
      created: 1,
      options: [{ name: 'Color', values: [['Navy', '#282099']] }, { name: 'Size', values: SIZES }, { name: 'Fabric', values: ['Velvet'] }],
      media: [[1080, 1440], [1080, 1440]],
      variants: [
        v(['Navy', 'M', 'Velvet'], 39900, 64900, 1),
        v(['Navy', 'L', 'Velvet'], 39900, 64900, 0),
        v(['Navy', 'XL', 'Velvet'], 39900, 64900, 0),
        v(['Navy', 'XXL', 'Velvet'], 39900, 64900, 0),
        v(['Navy', '3XL', 'Velvet'], 39900, 69900, 1),
      ],
    },
    {
      // Exactly 38% off.
      handle: 'sale-38',
      title: 'Thirty-eight Skirt',
      type: 'Skirt',
      created: 1,
      options: [{ name: 'Color', values: [['Black', '#000000'], ['White', '#FFFFFF']] }, { name: 'Size', values: ['M', 'L'] }],
      media: [[1080, 1440], [1080, 1440]],
      variants: [v(['Black', 'M'], 62000, 100000, 1, 0), v(['Black', 'L'], 62000, 100000, 1, 0), v(['White', 'M'], 62000, 100000, 1, 1), v(['White', 'L'], 62000, 100000, 0, 1)],
    },
    {
      // Like the store's Smoothie Skirt: sizes priced differently, compare-at prices not in step.
      handle: 'mixed-pricing',
      title: 'Mixed Pricing Skirt',
      type: 'Skirt',
      created: 1,
      options: [{ name: 'Color', values: [['Black', '#000000'], ['Beige', '#E8D9B5']] }, { name: 'Size', values: ['M', '3XL'] }],
      media: [[1080, 1440], [1080, 1440]],
      variants: [v(['Black', 'M'], 49900, 104900, 1, 0), v(['Black', '3XL'], 54900, 99900, 1, 0), v(['Beige', 'M'], 49900, 0, 1, 1), v(['Beige', '3XL'], 54900, 64900, 1, 1)],
    },
    {
      // A colour option with no swatch data, two colours.
      handle: 'no-swatch-two',
      title: 'Unlinked Colours Dress',
      type: 'Dress',
      created: 1,
      options: [{ name: 'Color', values: ['Black', 'Beige'] }, { name: 'Size', values: ['M', 'L'] }],
      media: [[1080, 1440]],
      variants: [v(['Black', 'M'], 30000, 0, 1), v(['Black', 'L'], 30000, 0, 1), v(['Beige', 'M'], 30000, 0, 1), v(['Beige', 'L'], 30000, 0, 0)],
    },
    {
      // A colour option with no swatch data, one colour.
      handle: 'no-swatch-one',
      title: 'Unlinked Colour Blouse',
      type: 'Blouse',
      created: 1,
      options: [{ name: 'اللون', values: ['أسود'] }, { name: 'المقاس', values: ['M', 'L'] }],
      media: [[1080, 1440]],
      variants: [v(['أسود', 'M'], 20000, 0, 1), v(['أسود', 'L'], 20000, 0, 1)],
    },
    {
      // No colour option; the Color category metafield has one entry.
      handle: 'meta-colour',
      title: 'Metafield Colour Skirt',
      type: 'Skirt',
      created: 1,
      colorMeta: [['Olive', '#556B2F']],
      options: [{ name: 'Size', values: ['M', 'L'] }],
      media: [[1080, 1440]],
      variants: [v(['M'], 25000, 0, 1), v(['L'], 25000, 0, 1)],
    },
    {
      // One variant: the "+" adds it straight away.
      handle: 'one-variant',
      title: 'Soft Pink Shirt',
      type: 'Shirt',
      created: 1,
      options: [{ name: 'Color', values: [['Pink', '#FFC0CB']] }, { name: 'Size', values: ['One size'] }],
      media: [[1080, 1440]],
      variants: [v(['Pink', 'One size'], 54900, 0, 1)],
    }
  );
  catalog.collections.cu = { title: 'Card upgrade', size: 7, offset, description: '' };
  return catalog;
}

// Geometry and styles of every card with a photo on the page.
const measureCards = (page) =>
  page.evaluate(() => {
    const box = (e) => e.getBoundingClientRect();
    const cs = (e) => getComputedStyle(e);
    return [...document.querySelectorAll('.product-card-wrapper')]
      .filter((card) => card.querySelector('.card__inner .media img') && card.getClientRects().length)
      .map((card) => {
        const inner = card.querySelector('.card__inner');
        const ib = box(inner);
        const badge = [...card.querySelectorAll('.card__inner .badge')].find((b) => !b.hidden && b.getClientRects().length);
        const plus = card.querySelector('.dsr-quick-add__button');
        const svg = plus && plus.querySelector('svg');
        const title = card.querySelector('.card__heading.h5');
        const priceItem = [...card.querySelectorAll('.card-information .price .price-item--last, .card-information .price .price__regular .price-item--regular')].find((e) => e.getClientRects().length);
        const colors = card.querySelector('.dsr-card-colors-row');
        const sizes = card.querySelector('.dsr-card-sizes-row');
        const dots = [...card.querySelectorAll('.dsr-card-swatch .swatch')];
        const size = card.querySelector('.dsr-card-size');
        const cb = box(card);
        const dotBoxes = dots.map(box);
        const plusBefore = plus && getComputedStyle(plus, '::before');
        return {
          handle: (card.querySelector('.card__heading a') || {}).getAttribute?.('href'),
          inner: { top: ib.top, right: ib.right, bottom: ib.bottom, left: ib.left, w: ib.width, h: ib.height },
          badge: badge && {
            text: [...badge.querySelectorAll('[aria-hidden="true"]')].map((s) => s.textContent.trim()).join('') || badge.textContent.trim(),
            top: Math.round(box(badge).top - ib.top),
            right: Math.round(ib.right - box(badge).right),
            font: [cs(badge).fontSize, cs(badge).fontWeight, cs(badge).paddingTop, cs(badge).paddingRight, cs(badge).borderTopLeftRadius, cs(badge).color, cs(badge).backgroundColor, cs(badge).textTransform],
            rect: box(badge).toJSON(),
          },
          plus: plus && {
            w: Math.round(box(plus).width),
            h: Math.round(box(plus).height),
            icon: svg ? Math.round(box(svg).width) : 0,
            bottom: Math.round(ib.bottom - box(plus).bottom),
            right: Math.round(ib.right - box(plus).right),
            style: [cs(plus).borderTopLeftRadius, cs(plus).backgroundColor, `${cs(plus).borderTopWidth} ${cs(plus).borderTopStyle}`, cs(plus).boxShadow],
            touch: plusBefore ? Math.round(box(plus).width - 2 * parseFloat(plusBefore.left)) : 0,
            rect: box(plus).toJSON(),
            name: plus.getAttribute('aria-labelledby') ? plus.getAttribute('aria-labelledby').split(' ').map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim() : '',
          },
          title: title && [cs(title).fontSize, cs(title).fontWeight, Math.round(box(title).top)],
          price: priceItem && [cs(priceItem).fontSize, cs(priceItem).fontWeight, Math.round(box(priceItem).top)],
          colorsTop: colors ? Math.round(box(colors).top) : -1,
          sizesTop: sizes ? Math.round(box(sizes).top) : -1,
          sizeFont: size ? cs(size).fontSize : null,
          dots: dotBoxes.map((d) => Math.round(d.width)),
          dotRound: dots.every((d) => cs(d).borderTopLeftRadius === '50%'),
          gaps: dotBoxes.slice(1).map((d, i) => Math.round(Math.abs(d.left - dotBoxes[i].left) - dotBoxes[i].width)),
          dotsInside: dotBoxes.every((d) => d.left >= cb.left && d.right <= cb.right && d.top >= cb.top && d.bottom <= cb.bottom),
          cardRight: cb.right,
        };
      });
  });

async function main() {
  const browser = await chromium.launch();
  const catalog = testCatalog();
  const variants = new Map();
  catalog.products.forEach((p) => buildProduct(p).variants.forEach((variant) => variants.set(String(variant.id), variant)));
  const product = (handle) => buildProduct(catalog.products.find((p) => p.handle === handle));
  const variantOf = (handle, options) => product(handle).variants.find((x) => options.every((o, i) => x.options[i] === o));

  for (const locale of ['ar', 'en.default']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    const strings = readJson(path.join(root, 'locales', `${locale}.json`));
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });

    const open = async (url, width = 390) => {
      const lines = [];
      const sf = storefront({ root, harness, cartLines: lines, catalog });
      const mobile = width < 990;
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: mobile, isMobile: width < 750, reducedMotion: 'reduce' });
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
          const body = request.postData() || '';
          const id = (/name="id"\r\n\r\n(\d+)/.exec(body) || [])[1];
          page.adds.push(id);
          const found = variants.get(id);
          if (found) lines.push({ handle: 'x', title: 'x', price: found.price, quantity: 1 });
          const sections = {};
          for (const s of ['cart-drawer', 'cart-icon-bubble']) sections[s] = await sf.cartSection(s);
          return { id: Number(id), quantity: 1, sections };
        },
        pages: (u) => sf.pages(u),
      });
      await page.goto(`http://dressar.test${url}`);
      await page.waitForTimeout(900);
      return page;
    };

    // ---------------- Look and layout, every width ----------------
    for (const width of WIDTHS) {
      const desktop = width >= 990;
      const tag = `${L} [${width}]`;
      const edge = desktop ? 12 : 10;
      for (const url of ['/collections/cu', '/collections/skirts', '/search?q=linen']) {
        const page = await open(url, width);
        const cards = await measureCards(page);
        const t = `${tag} ${url}`;
        check(`${t}: cards shown`, cards.length >= 2, String(cards.length));
        const badged = cards.filter((c) => c.badge && /%$/.test(c.badge.text));
        check(`${t}: sale badge just the percentage ("38%"), no "OFF"`, badged.length > 0 && badged.every((c) => /^\d+%$/.test(c.badge.text)), JSON.stringify(badged.map((c) => c.badge.text)));
        check(`${t}: badge ${desktop ? '12px, 600, 5px 9px' : '11px, 600, 4px 7px'}, 5px corners, white on dark red, no capitals`, badged.every((c) => JSON.stringify(c.badge.font.slice(0, 5)) === JSON.stringify(desktop ? ['12px', '600', '5px', '9px', '5px'] : ['11px', '600', '4px', '7px', '5px']) && c.badge.font[5] === 'rgb(255, 255, 255)' && /^rgb\((1[2-9]\d|[2-9]\d), 0?\d{1,2}, 0?\d{1,2}\)$/.test(c.badge.font[6]) && c.badge.font[7] === 'none'), JSON.stringify(badged[0] && badged[0].badge.font));
        check(`${t}: badge on the photo's top-right corner, ${edge}px in`, cards.filter((c) => c.badge).every((c) => Math.abs(c.badge.top - edge) <= 1 && Math.abs(c.badge.right - edge) <= 1), JSON.stringify(cards.filter((c) => c.badge).map((c) => [c.badge.top, c.badge.right])));
        const plus = cards.filter((c) => c.plus);
        const size = desktop ? 34 : 30;
        check(`${t}: quick add ${size}px with a ${desktop ? 18 : 16}px plus`, plus.length && plus.every((c) => c.plus.w === size && c.plus.h === size && c.plus.icon === (desktop ? 18 : 16)), JSON.stringify(plus.map((c) => [c.plus.w, c.plus.icon])));
        check(`${t}: quick add white, thin dark edge, 3px corners, no shadow`, plus.every((c) => c.plus.style[0] === '3px' && c.plus.style[1] === 'rgb(255, 255, 255)' && c.plus.style[2] === '1px solid' && c.plus.style[3] === 'none'), JSON.stringify(plus[0] && plus[0].plus.style));
        check(`${t}: quick add on the photo's bottom-right corner, ${edge}px in`, plus.every((c) => Math.abs(c.plus.bottom - edge) <= 1 && Math.abs(c.plus.right - edge) <= 1), JSON.stringify(plus.map((c) => [c.plus.bottom, c.plus.right])));
        check(`${t}: quick add touch area 44px, named "${strings.dressar.card.quick_add} …"`, plus.every((c) => c.plus.touch >= 44 && c.plus.name.startsWith(strings.dressar.card.quick_add)), JSON.stringify(plus.map((c) => [c.plus.touch, c.plus.name.slice(0, 30)])));
        const overlap = (a, b) => a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        check(`${t}: badge and "+" never overlap`, cards.every((c) => !overlap(c.badge && c.badge.rect, c.plus && c.plus.rect)));
        const dotted = cards.filter((c) => c.dots.length);
        const dot = desktop ? 18 : 16;
        // 7px apart from 990px; 8px on phones, where it keeps each colour button 24px wide (WCAG 2.5.8).
        const gap = desktop ? 7 : 8;
        check(`${t}: colour circles ${dot}px, round, ${gap}px apart, not clipped`, dotted.length && dotted.every((c) => c.dots.every((d) => d === dot) && c.dotRound && c.gaps.every((g) => g === gap) && c.dotsInside), JSON.stringify(dotted.map((c) => [c.dots, c.gaps, c.dotsInside])));
        check(`${t}: name ${desktop ? 13 : 12}px 500, price ${desktop ? 14 : 13}px 600, sizes ${desktop ? 12 : 11}px`, cards.every((c) => c.title[0] === `${desktop ? 13 : 12}px` && c.title[1] === '500' && c.price[0] === `${desktop ? 14 : 13}px` && c.price[1] === '600' && (!c.sizeFont || c.sizeFont === `${desktop ? 12 : 11}px`)), JSON.stringify(cards[0] && [cards[0].title, cards[0].price, cards[0].sizeFont]));
        check(`${t}: order: photo, name, price, colours, sizes`, cards.every((c) => c.inner.bottom <= c.title[2] + 1 && c.title[2] < c.price[2] && c.price[2] < c.colorsTop && c.colorsTop < c.sizesTop), JSON.stringify(cards.map((c) => [Math.round(c.inner.bottom), c.title[2], c.price[2], c.colorsTop, c.sizesTop]).slice(0, 3)));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check(`${t}: no sideways scrolling`, overflow <= 0, String(overflow));
        check(`${t}: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
        await page.context().close();
      }
    }

    // Home rows (carousels on phones): the same card.
    for (const width of [390, 1440]) {
      const page = await open('/', width);
      const cards = await measureCards(page);
      const desktop = width >= 990;
      const t = `${L} [${width}] home rows`;
      check(`${t}: same badge, "+" and circles as the grid`, cards.length > 0 && cards.every((c) => (!c.badge || /^(\d+%|.*)$/.test(c.badge.text)) && (!c.plus || c.plus.w === (desktop ? 34 : 30)) && c.dots.every((d) => d === (desktop ? 18 : 16))), JSON.stringify(cards.slice(0, 2).map((c) => [c.badge && c.badge.text, c.plus && c.plus.w, c.dots])));
      check(`${t}: no sideways scrolling, no JS errors`, (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0 && page.errors.length === 0, page.errors.join(' | '));
      await page.context().close();
    }

    // ---------------- Behaviour ----------------
    let page = await open('/collections/cu', 390);
    const cardSel = (handle) => `.product-card-wrapper:has(a[href^="/products/${handle}"])`;
    const card = (handle) =>
      page.evaluate((sel) => {
        const c = document.querySelector(sel);
        const badge = [...c.querySelectorAll('.card__inner [data-dsr-sale-badge], .card__inner .badge')].find((b) => !b.hidden);
        const visible = (e) => e && e.getClientRects().length > 0;
        const price = c.querySelector('.card-information .price');
        return {
          swatches: [...c.querySelectorAll('.dsr-card-swatch')].map((s) => ({
            value: s.dataset.value || s.getAttribute('aria-label'),
            button: s.tagName === 'BUTTON',
            pressed: s.getAttribute('aria-pressed') === 'true' || s.classList.contains('dsr-card-swatch--selected'),
            outline: getComputedStyle(s.querySelector('.swatch')).outlineStyle + ' ' + getComputedStyle(s.querySelector('.swatch')).outlineWidth + ' ' + getComputedStyle(s.querySelector('.swatch')).outlineOffset,
            edge: getComputedStyle(s.querySelector('.swatch')).borderTopWidth,
          })),
          missing: c.querySelector('.dsr-card-colors-row').dataset.dsrColorData || null,
          count: (c.querySelector('.dsr-card-colors') || {}).textContent || null,
          badge: badge ? ([...badge.querySelectorAll('[aria-hidden="true"]')].map((s) => s.textContent).join('') || badge.textContent.trim()) : null,
          spoken: badge ? (badge.querySelector('.visually-hidden') || {}).textContent || null : null,
          onSale: price.classList.contains('price--on-sale'),
          price: [...price.querySelectorAll(price.classList.contains('price--on-sale') ? '.price__sale .price-item--sale' : '.price__regular .price-item--regular')].map((e) => e.textContent.trim()).join(''),
          compare: price.classList.contains('price--on-sale') ? (price.querySelector('.price__sale s') || {}).textContent?.trim() : null,
          sizes: [...c.querySelectorAll('.dsr-card-size')].map((b) => b.dataset.value + (b.getAttribute('aria-disabled') === 'true' ? ':x' : '')),
          img: c.querySelector('.card__media .media > img').getAttribute('src'),
          link: c.querySelector('.card__heading a').getAttribute('href'),
          height: Math.round(c.getBoundingClientRect().height),
          plusDisabled: (c.querySelector('.dsr-quick-add__button') || {}).disabled,
        };
      }, cardSel(handle));
    const money = (cents) => `${cents / 100}`;
    const has = (text, cents) => new RegExp(`(^|\\D)${money(cents)}(\\D|$)`).test((text || '').replace(/(\d),(\d)/g, '$1$2'));
    const click = async (handle, selector) => {
      await page.click(`${cardSel(handle)} ${selector}`);
      await page.waitForTimeout(250);
    };

    // A — one colour (the Turquoise Velvet Jacket).
    let c = await card('turquoise-velvet-jacket');
    check(`${L} A: one colour: one circle, selected (thin dark ring), named "Navy"`, c.swatches.length === 1 && c.swatches[0].pressed && c.swatches[0].value === 'Navy' && /^solid 1px 2px$/.test(c.swatches[0].outline), JSON.stringify(c.swatches));
    check(`${L} A: its sizes in stock open, the rest struck through`, c.sizes.join() === 'M,L:x,XL:x,XXL:x,3XL', c.sizes.join());
    check(`${L} A: price 399 against 649 (the cheapest in-stock size), badge 39% (38.5 rounded)`, has(c.price, 39900) && has(c.compare, 64900) && c.badge === '39%', JSON.stringify(c));
    const fromWordA = strings.products.product.price.from_price_html.split('{{')[0].trim();
    check(`${L} A: no "${fromWordA}": the sizes in stock (M, 3XL) cost the same`, !c.price.includes(fromWordA), c.price);
    await click('turquoise-velvet-jacket', '.dsr-card-size[data-value="3XL"]');
    c = await card('turquoise-velvet-jacket');
    check(`${L} A: choosing 3XL moves price and badge to that variant (399 against 699, 43%)`, has(c.price, 39900) && has(c.compare, 69900) && c.badge === '43%', JSON.stringify([c.price, c.compare, c.badge]));

    // B — several colours.
    c = await card('sale-38');
    check(`${L} B: several colours: one circle each, only the shown one selected`, c.swatches.map((s) => s.value).join() === 'Black,White' && c.swatches.every((s) => s.button) && c.swatches.filter((s) => s.pressed).length === 1 && c.swatches[0].pressed, JSON.stringify(c.swatches));
    check(`${L} B: a light colour (white) has a thin grey edge, a dark one none; unselected: no ring`, c.swatches[1].edge === '1px' && c.swatches[0].edge === '0px' && /^none/.test(c.swatches[1].outline), JSON.stringify(c.swatches));
    // C — 38%.
    check(`${L} C: 620 against 1000: "38%", no "OFF"; screen readers: "${strings.dressar.card.sale_percent.replace('{{ percent }}', '38')}"`, c.badge === '38%' && c.spoken === strings.dressar.card.sale_percent.replace('{{ percent }}', '38'), JSON.stringify([c.badge, c.spoken]));

    // E — choosing a colour: photo, price, badge, sizes, links, quick add.
    const before = await card('mixed-pricing');
    const fromWord = strings.products.product.price.from_price_html.split('{{')[0].trim();
    check(`${L} E: mixed prices open on Black: "${fromWord}" 499 against 1049 (one variant), 52%`, has(before.price, 49900) && has(before.compare, 104900) && before.badge === '52%' && before.price.includes(fromWord), JSON.stringify([before.price, before.compare, before.badge]));
    await click('mixed-pricing', '.dsr-card-swatch[data-value="Beige"]');
    let after = await card('mixed-pricing');
    check(`${L} E: Beige: its own photo, price 499 with no compare-at (that variant isn't reduced), no badge`, /mixed-pricing-1/.test(after.img) && has(after.price, 49900) && !after.onSale && after.badge === null, JSON.stringify(after));
    check(`${L} E: no layout shift when the colour changes`, after.height === before.height, `${before.height} -> ${after.height}`);
    await click('mixed-pricing', '.dsr-card-size[data-value="3XL"]');
    after = await card('mixed-pricing');
    const beige3 = variantOf('mixed-pricing', ['Beige', '3XL']);
    check(`${L} E: Beige 3XL: 549 against 649, badge 15%; the card links open that variant`, has(after.price, 54900) && has(after.compare, 64900) && after.badge === '15%' && after.link.includes(`variant=${beige3.id}`), JSON.stringify(after));
    await click('mixed-pricing', '.dsr-quick-add__button');
    await page.waitForTimeout(600);
    check(`${L} E/D: the "+" adds exactly Beige 3XL`, page.adds.length === 1 && page.adds[0] === String(beige3.id), JSON.stringify(page.adds));
    await page.evaluate(() => document.querySelector('cart-drawer') && document.querySelector('cart-drawer').close && document.querySelector('cart-drawer').close());
    await page.waitForTimeout(300);

    // Keyboard: a colour can be chosen with the keyboard.
    await page.focus(`${cardSel('sale-38')} .dsr-card-swatch[data-value="White"]`);
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    c = await card('sale-38');
    check(`${L} keyboard: Space on a colour selects it (aria-pressed)`, c.swatches[1].pressed && !c.swatches[0].pressed && /sale-38-1/.test(c.img), JSON.stringify(c.swatches));

    // D — quick add: one variant adds at once; several without a size open the dialog; sold out is disabled.
    const addsBefore = page.adds.length;
    await click('one-variant', '.dsr-quick-add__button');
    await page.waitForTimeout(600);
    const pink = product('one-variant').variants[0];
    check(`${L} D: one variant: the "+" adds it`, page.adds.length === addsBefore + 1 && page.adds[page.adds.length - 1] === String(pink.id), JSON.stringify(page.adds));
    await page.evaluate(() => document.querySelector('cart-drawer') && document.querySelector('cart-drawer').close && document.querySelector('cart-drawer').close());
    await page.waitForTimeout(300);
    const n = page.adds.length;
    await click('sale-38', '.dsr-quick-add__button');
    await page.waitForTimeout(500);
    const dialog = await page.evaluate((sel) => {
      const id = document.querySelector(`${sel} .dsr-quick-add__button`).dataset.dsrDialog;
      return document.querySelector(id) && document.querySelector(id).hasAttribute('open');
    }, cardSel('sale-38'));
    check(`${L} D: several variants, no size chosen: opens the existing quick-add dialog, adds nothing`, dialog && page.adds.length === n, JSON.stringify([dialog, page.adds.length]));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // F — no reliable colour data: no made-up circle, flagged for the merchant.
    c = await card('no-swatch-two');
    check(`${L} F: colour option without swatch data, two colours: no circle, a colour count, flagged`, c.swatches.length === 0 && c.missing === 'missing' && Boolean(c.count), JSON.stringify(c));
    c = await card('no-swatch-one');
    check(`${L} F: one colour without swatch data: no circle, flagged`, c.swatches.length === 0 && c.missing === 'missing' && !c.count, JSON.stringify(c));
    c = await card('meta-colour');
    check(`${L} F: no colour option, the Color metafield has one: one circle from it, selected, not flagged`, c.swatches.length === 1 && c.swatches[0].value === 'Olive' && c.swatches[0].pressed && c.missing === null, JSON.stringify(c));
    check(`${L} behaviour: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
    await page.context().close();

    page = await open('/collections/skirts', 390);
    // The fixture skirt: sizes follow the colour's stock; the photo follows the colour.
    await click('linen-maxi-skirt-with-front-pockets', '.dsr-card-swatch[data-value="Genzari"]');
    c = await card('linen-maxi-skirt-with-front-pockets');
    const genz = variantOf('linen-maxi-skirt-with-front-pockets', ['Genzari', 'M', 'Linen']);
    check(`${L} E: linen skirt, Genzari: its photo, all its sizes open, links on its first in-stock variant (pick=color)`, /front-pockets-2/.test(c.img) && c.sizes.every((s) => !s.endsWith(':x')) && c.link.includes(`variant=${genz.id}`) && c.link.includes('pick=color'), JSON.stringify(c));
    await click('linen-maxi-skirt-with-front-pockets', '.dsr-card-swatch[data-value="coffe"]');
    c = await card('linen-maxi-skirt-with-front-pockets');
    check(`${L} E: coffe: only L and XL in stock, the rest struck through (no silent pick)`, c.sizes.join() === 'M:x,L,XL,XXL:x,3XL:x', c.sizes.join());

    check(`${L} skirts: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
    await page.context().close();

    // Sold out stays unpurchasable from the card (fixture linen suit: nothing in stock).
    const skirts = await open('/collections/skirts', 390);
    const sold = await skirts.evaluate(() => {
      const c = document.querySelector('.product-card-wrapper:has(a[href^="/products/linen-suit"])');
      return c ? { disabled: c.querySelector('.dsr-quick-add__button').disabled, badge: c.querySelector('.card__inner .badge').textContent.trim() } : null;
    });
    if (sold) check(`${L} D: sold-out product: "+" disabled, "${strings.products.product.sold_out}" badge`, sold.disabled && sold.badge === strings.products.product.sold_out, JSON.stringify(sold));
    await skirts.context().close();
  }

  // Every badge on the collection pages states its own card's markdown, from one variant.
  {
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale: 'en.default' });
    const sf = storefront({ root, harness, catalog });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await routeTheme(page, { root, fontsDir, harness, imageSize: sf.imageSize, globalsFor: () => sf.globalsFor(), cartSection: sf.cartSection, cartJson: sf.cartJson, pages: (u) => sf.pages(u) });
    for (const url of ['/collections/white-friday-sale', '/collections/cu']) {
      await page.goto(`http://dressar.test${url}`);
      await page.waitForTimeout(600);
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll('.product-card-wrapper')].map((c) => {
          const price = c.querySelector('.card-information .price');
          const sale = price.classList.contains('price--on-sale');
          const num = (e) => (e ? Number(e.textContent.replace(/[^\d.]/g, '')) : null);
          const badge = [...c.querySelectorAll('.card__inner [data-dsr-sale-badge]')].find((b) => !b.hidden);
          return {
            href: c.querySelector('.card__heading a').getAttribute('href').split('?')[0].replace('/products/', ''),
            price: num(price.querySelector(sale ? '.price__sale .price-item--sale' : '.price__regular .price-item--regular')),
            compare: sale ? num(price.querySelector('.price__sale s')) : null,
            badge: badge ? Number(badge.querySelector('[aria-hidden]').textContent.replace('%', '')) : null,
            soldOut: !c.querySelector('.card__inner [data-dsr-sale-badge]') && Boolean(c.querySelector('.card__inner .badge')),
          };
        })
      );
      // Sold-out products show "Sold out" instead of a percentage. The card prints whole
      // amounts (the store's money format), so variants are matched on those and the badge
      // is checked against that variant's exact prices.
      const wrong = rows.filter((r) => !r.soldOut).filter((r) => {
        // Collections repeat products as numbered copies (handle-1, -2); "sale-38" is a handle of its own.
        const p = catalog.products.find((x) => x.handle === r.href) || catalog.products.find((x) => x.handle === r.href.replace(/-\d+$/, ''));
        if (!p) return true;
        const v = buildProduct(p).variants.find((x) => Math.round(x.price / 100) === r.price && (r.compare === null ? !(x.compare_at_price > x.price) : Math.round(x.compare_at_price / 100) === r.compare));
        if (!v) return true;
        const expected = v.compare_at_price > v.price ? Math.round(((v.compare_at_price - v.price) / v.compare_at_price) * 100) : null;
        return expected !== r.badge;
      });
      check(`[en] ${url}: every badge = round((compare-at - price) / compare-at x 100) of the prices on its card, both from one variant (${rows.length} cards)`, rows.length > 0 && wrong.length === 0, JSON.stringify(wrong.slice(0, 4)));
    }
    await context.close();
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
