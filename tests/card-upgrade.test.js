// Product cards (docs/stages/card-upgrade.md, docs/stages/card-v2.md): the compact V2 card
// (one-line name; price and rating on one line; rounded-square colours; 24px sizes; a
// small quick-add bag; every row of a grid row aligned within 1px, cards the same height),
// the sale badge ("38%", top-right), colours on every card (one colour included), and the
// card's one price variant (price, compare-at price and badge from the same variant,
// following the chosen colour and size). Arabic (right to left) and English, at
// 320-1440px, on the theme's real card rendered by tests/lib/theme-harness.js:
// collection, search and home rows.
// usage: node tests/card-upgrade.test.js [themeRoot]
'use strict';

const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');
const { buildProduct } = require('./lib/catalog');
const { measureCardLayout, spread, ALIGNED } = require('./lib/card-layout');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1440];
const SIZES = ['M', 'L', 'XL', 'XXL', '3XL'];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });
const c0 = (cards) => cards[0] || {};

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
      reviews: [5, 1],
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
      reviews: [4.6, 12],
      options: [{ name: 'Color', values: [['Black', '#000000'], ['White', '#FFFFFF']] }, { name: 'Size', values: ['M', 'L'] }],
      media: [[1080, 1440], [1080, 1440]],
      variants: [v(['Black', 'M'], 62000, 100000, 1, 0), v(['Black', 'L'], 62000, 100000, 1, 0), v(['White', 'M'], 62000, 100000, 1, 1), v(['White', 'L'], 62000, 100000, 0, 1)],
    },
    {
      // Like the store's Smoothie Skirt: sizes priced differently, compare-at prices not in step.
      handle: 'mixed-pricing',
      // A long mixed English/Arabic name: one line, cut with "…".
      title: 'Mixed Pricing Pleated Maxi Skirt with Belt and Pockets | جيبة طويلة بكسرات وحزام وجيوب',
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
        const { cards, rows, overflow } = await page.evaluate(measureCardLayout);
        const t = `${tag} ${url}`;
        check(`${t}: cards shown`, cards.length >= 2, String(cards.length));

        // The card: #F2EEE9, 10px corners, 8px padding, no labels, no dividers.
        check(`${t}: card #F2EEE9, 10px corners, 8px padding, no row labels, no divider lines`, cards.every((c) => c.background === 'rgb(242, 238, 233)' && c.radius === '10px' && c.padding === '8px' && c.labels === 0 && c.dividers.every((w) => w === '0px')), JSON.stringify(cards[0] && [c0(cards).background, c0(cards).radius, c0(cards).padding, c0(cards).labels, c0(cards).dividers]));

        // 1. The name: one line, the same height, cut with "…".
        check(`${t}: name ${desktop ? 13 : 12}px 500 on exactly one line (nowrap, hidden, ellipsis), same height on every card`, cards.every((c) => c.titleOneLine && c.titleFont[0] === `${desktop ? 13 : 12}px` && c.titleFont[1] === '500' && Math.abs(c.titleHeight - c.titleLineHeight) <= 0.5) && spread(cards, 'titleHeight') <= 0.5, JSON.stringify(cards.filter((c) => !c.titleOneLine || Math.abs(c.titleHeight - c.titleLineHeight) > 0.5).map((c) => [c.title.slice(0, 20), c.titleHeight, c.titleLineHeight])));
        if (url === '/collections/cu') check(`${t}: the long mixed English/Arabic name is cut, not wrapped`, cards.some((c) => /Mixed Pricing/.test(c.title) && c.titleCut && c.titleOneLine), JSON.stringify(cards.filter((c) => /Mixed/.test(c.title)).map((c) => [c.titleCut, c.titleOneLine])));

        // 2. Price (14px semibold) and rating (10px) on one line, apart.
        check(`${t}: price 14px 600`, cards.every((c) => c.priceFont && c.priceFont[0] === '14px' && c.priceFont[1] === '600'), JSON.stringify(cards.map((c) => c.priceFont).slice(0, 3)));
        const rated = cards.filter((c) => c.rating);
        const overlaps = (a, b) => a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        if (url === '/collections/cu') check(`${t}: cards with reviews show the rating`, rated.length >= 2, String(rated.length));
        check(`${t}: rating 10px on the price's line, not overlapping the price or the compare-at price`, rated.every((c) => c.rating.font === '10px' && Math.abs((c.rating.rect.top + c.rating.rect.bottom) / 2 - (c.priceTop + c.priceHeight / 2)) <= 2 && !overlaps(c.rating.rect, c.priceRect) && !overlaps(c.rating.rect, c.compareRect)), JSON.stringify(rated.map((c) => [c.rating.font, c.rating.rect.top, c.priceTop])));
        // The compare-at price is whole or not shown at all (no room); never cut.
        check(`${t}: compare-at price never cut: whole beside the price, or left out when there's no room`, cards.filter((c) => c.compareRect).every((c) => !c.compareCut), JSON.stringify(cards.filter((c) => c.compareCut).map((c) => c.title.slice(0, 24))));
        if (width >= 390 && url === '/collections/cu') check(`${t}: on a 390px phone and wider, three-digit sale prices show their compare-at price, rating or not`, cards.filter((c) => c.compareRect && /^(Turquoise|Thirty)/.test(c.title)).every((c) => c.compareShown), JSON.stringify(cards.filter((c) => c.compareRect).map((c) => [c.title.slice(0, 12), c.compareShown])));

        // 3. Colours: rounded squares, 16px, 8px apart.
        const dotted = cards.filter((c) => c.dots.length);
        check(`${t}: colours: 16px rounded squares (4px), 8px apart, not clipped`, dotted.length && dotted.every((c) => c.dots.every((d) => d === 16) && c.dotRadius.every((x) => x === '4px') && c.dotGaps.every((g) => g === 8) && c.dotsInside), JSON.stringify(dotted.map((c) => [c.dots, c.dotRadius[0], c.dotGaps, c.dotsInside]).slice(0, 3)));

        // 4. Sizes: 24px, 4px corners, 11px, one row (scrolls sideways when needed).
        check(`${t}: sizes 24px high, 4px corners, 11px, on one row (sideways scroll)`, cards.every((c) => c.sizes.every((b) => b.h === 24 && b.radius === '4px' && b.font === '11px') && new Set(c.sizes.map((b) => b.top)).size <= 1 && (!c.sizes.length || c.sizesScroll === 'auto')), JSON.stringify(cards.map((c) => [c.sizes[0], new Set(c.sizes.map((b) => b.top)).size]).slice(0, 2)));

        // Rows of cards: every row and the card's bottom within 1px, cards the same height.
        const bad = rows.map((rw) => Object.fromEntries(ALIGNED.map((k) => [k, Math.round(spread(rw, k) * 10) / 10]))).filter((sp) => Object.values(sp).some((v) => v > 1));
        check(`${t}: in each grid row: same card height; photo bottom, name, price, colours, sizes and card bottom within 1px (${rows.length} rows)`, rows.length >= 1 && bad.length === 0, JSON.stringify(bad.slice(0, 3)));
        check(`${t}: order: photo, name, price and rating, colours, sizes`, cards.every((c) => c.imageBottom <= c.titleTop + 0.5 && c.titleTop < c.priceTop && c.priceTop < c.colorsTop && c.colorsTop < c.sizesTop), JSON.stringify(cards.map((c) => [c.imageBottom, c.titleTop, c.priceTop, c.colorsTop, c.sizesTop]).slice(0, 2)));

        // Quick add: a small bag, bottom-right of the photo.
        const bags = cards.filter((c) => c.bag);
        check(`${t}: quick add: a 32px bag, 8px corners, translucent white, on the photo's bottom-right, ${edge}px in`, bags.length && bags.every((c) => c.bag.w === 32 && c.bag.h === 32 && c.bag.radius === '8px' && /^rgba\(255, 255, 255, 0\.88\)$/.test(c.bag.bg) && c.bag.bagIcon && Math.abs(c.bag.bottom - edge) <= 1 && Math.abs(c.bag.right - edge) <= 1), JSON.stringify(bags.map((c) => [c.bag.w, c.bag.radius, c.bag.bg, c.bag.bagIcon, c.bag.bottom, c.bag.right]).slice(0, 2)));
        check(`${t}: quick add touch area 44px, named "${strings.dressar.card.quick_add}"`, bags.every((c) => c.bag.touch >= 44), JSON.stringify(bags.map((c) => c.bag.touch)));

        // Sale badge (unchanged since the card upgrade).
        const badged = cards.filter((c) => c.badge && /%$/.test(c.badge.text));
        check(`${t}: sale badge just the percentage, top-right, clear of the bag`, badged.length > 0 && badged.every((c) => /^\d+%$/.test(c.badge.text) && Math.abs(c.badge.rect.top - (c.imageBottom - (c.imageBottom - c.top)) - edge) <= 1) && cards.every((c) => !overlaps(c.badge && c.badge.rect, c.bag && c.bag.rect)), JSON.stringify(badged.map((c) => c.badge.text)));

        check(`${t}: no sideways scrolling`, overflow <= 0, String(overflow));
        check(`${t}: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
        await page.context().close();
      }
    }

    // Home rows (carousels on phones): the same card, aligned.
    for (const width of [390, 1440]) {
      const page = await open('/', width);
      const { cards, rows, overflow } = await page.evaluate(measureCardLayout);
      const t = `${L} [${width}] home rows`;
      const bad = rows.map((rw) => Object.fromEntries(ALIGNED.map((k) => [k, spread(rw, k)]))).filter((sp) => Object.values(sp).some((v) => v > 1));
      check(`${t}: same card: one-line names, 32px bag, 16px squares, rows aligned`, cards.length > 0 && cards.every((c) => c.titleOneLine && (!c.bag || c.bag.w === 32) && c.dots.every((d) => d === 16)) && bad.length === 0, JSON.stringify([cards.slice(0, 2).map((c) => [c.titleOneLine, c.bag && c.bag.w, c.dots]), bad.slice(0, 2)]));
      check(`${t}: no sideways scrolling, no JS errors`, overflow <= 0 && page.errors.length === 0, page.errors.join(' | '));
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
    check(`${L} A: one colour: one square, selected (thin dark ring), named "Navy"`, c.swatches.length === 1 && c.swatches[0].pressed && c.swatches[0].value === 'Navy' && /^solid (1|1\.5)px 2px$/.test(c.swatches[0].outline), JSON.stringify(c.swatches));
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
