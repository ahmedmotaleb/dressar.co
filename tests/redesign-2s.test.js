// The 2S Homewear redesign (docs/stages/2s-redesign.md): the product card,
// the compact product page and the sticky add-to-cart bar, on the theme's
// real pages rendered by tests/lib/theme-harness.js and measured in Chromium.
// usage: node tests/redesign-2s.test.js [themeRoot]
'use strict';

const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const WIDTHS = [360, 390, 430, 768, 990, 1280, 1440];
const CARD_BG = 'rgb(242, 238, 233)'; // #F2EEE9

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

async function main() {
  const browser = await chromium.launch();
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  // Real-shaped reviews on the linen skirt only (Judge.me syncs them to Shopify's review metafields).
  catalog.products.find((p) => p.handle === 'linen-maxi-skirt-with-front-pockets').reviews = [4.6, 12];

  for (const locale of ['en.default', 'ar']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });
    const strings = readJson(path.join(root, 'locales', `${locale}.json`));

    const open = async (width, pagePath, { touch = false } = {}) => {
      const sf = storefront({ root, harness, catalog });
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: touch, isMobile: touch });
      const page = await context.newPage();
      page.errors = [];
      page.on('pageerror', (e) => page.errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && page.errors.push(m.text()));
      await routeTheme(page, { root, fontsDir, harness, imageSize: sf.imageSize, globalsFor: () => sf.globalsFor(), cartSection: sf.cartSection, cartJson: sf.cartJson, pages: (url) => sf.pages(url) });
      await page.goto(`http://dressar.test${pagePath}`);
      await page.waitForTimeout(600);
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 30));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(400);
      page.closeAll = () => context.close();
      return page;
    };

    // ---------------- The product card ----------------
    for (const width of WIDTHS) {
      if (rtl && ![390, 1440].includes(width)) continue;
      const tag = `${L} [${width}] card`;
      const desktop = width >= 990;
      const page = await open(width, '/collections/skirts');
      const r = await page.evaluate(() => {
        const px = (el, prop) => (el ? parseFloat(getComputedStyle(el)[prop]) : null);
        const cards = [...document.querySelectorAll('#product-grid > li')].map((li) => {
          const card = li.querySelector('.card');
          const content = li.querySelector('.card > .card__content');
          const title = li.querySelector('.card > .card__content .card__heading');
          const link = title.querySelector('a');
          const rating = li.querySelector('.dsr-card-rating');
          const price = li.querySelector('.card > .card__content .price');
          const colours = li.querySelector('.dsr-card-colors-row');
          const sizes = li.querySelector('.dsr-card-sizes-row');
          const top = (el) => (el ? el.getBoundingClientRect().top : null);
          const cs = getComputedStyle(card);
          const box = card.getBoundingClientRect();
          // How far the visible content of a centred row is from the card's middle.
          const offCentre = (el) => {
            if (!el) return null;
            const parts = [...el.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.offsetWidth > 0 && !e.closest('.visually-hidden')).map((e) => e.getBoundingClientRect());
            if (!parts.length) return null;
            // What shows: a part cut short ("...") counts only up to the row's edge.
            const edge = el.getBoundingClientRect();
            const l = Math.max(edge.left, Math.min(...parts.map((b) => b.left)));
            const r = Math.min(edge.right, Math.max(...parts.map((b) => b.right)));
            return Math.abs((l + r) / 2 - (box.left + box.right) / 2);
          };
          const visiblePrice = price.querySelector(price.classList.contains('price--on-sale') ? '.price__sale' : '.price__regular');
          const options = li.querySelector('.dsr-card-options');
          const label = (row) => {
            const l = row && row.querySelector('.dsr-card-row__label');
            const next = l && l.nextElementSibling;
            if (!l || !next) return null;
            const a = l.getBoundingClientRect();
            const b = next.getBoundingClientRect();
            return { text: l.textContent.trim(), above: a.bottom <= b.top + 0.5, beside: a.top < b.bottom && b.top < a.bottom };
          };
          const swatch = li.querySelector('.dsr-card-swatch .swatch');
          return {
            handle: link.getAttribute('href').split('/').pop().split('?')[0],
            bg: cs.backgroundColor,
            contentBg: getComputedStyle(content).backgroundColor,
            radius: cs.borderTopLeftRadius,
            shadow: cs.boxShadow,
            innerShadow: getComputedStyle(li.querySelector('.card__inner'), '::after').display,
            order: [top(title), top(rating), top(price), top(colours), top(sizes)].filter((v) => v !== null).every((v, i, a) => i === 0 || v > a[i - 1]),
            titleSize: px(title, 'fontSize'),
            titleLines: Math.round(link.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight)),
            rating: rating ? { size: px(rating, 'fontSize'), text: rating.textContent.replace(/\s+/g, ' ').trim(), stars: Boolean(rating.querySelector('.rating-star')) } : null,
            priceSize: px(price, 'fontSize'),
            priceWeight: getComputedStyle(price).fontWeight,
            sizeButtons: [...li.querySelectorAll('.dsr-card-size')].map((b) => px(b, 'fontSize')),
            swatch: swatch ? [Math.round(swatch.getBoundingClientRect().width), Math.round(swatch.getBoundingClientRect().height), getComputedStyle(swatch).borderTopLeftRadius] : null,
            titleStyle: [getComputedStyle(title).fontWeight, getComputedStyle(title).textTransform, getComputedStyle(title).textAlign],
            titleCentre: offCentre(link),
            ratingCentre: offCentre(rating),
            priceCentre: offCentre(visiblePrice),
            star: rating && getComputedStyle(rating.querySelector('.rating-star')).getPropertyValue('--color-rating-star').trim(),
            rules: options && [getComputedStyle(options).borderTopWidth, colours && sizes ? getComputedStyle(sizes).borderTopWidth : '1px'],
            colourLabel: label(colours),
            sizeLabel: label(sizes),
            cardWidth: box.width,
            left: card.getBoundingClientRect().left,
            right: card.getBoundingClientRect().right,
            cardTop: Math.round(card.getBoundingClientRect().top),
          };
        });
        return { cards, overflow: document.documentElement.scrollWidth - window.innerWidth };
      });
      const c = r.cards;
      check(`${tag}: the whole card #F2EEE9 (photo, name, rating, price, colours, sizes), no white panel`, c.every((x) => x.bg === CARD_BG && x.contentBg === 'rgba(0, 0, 0, 0)'), JSON.stringify(c.map((x) => [x.bg, x.contentBg])));
      check(`${tag}: 10px corners, a faint shadow only`, c.every((x) => x.radius === '10px' && /rgba\(17, 17, 17, 0\.0[45]\)/.test(x.shadow) && x.innerShadow === 'none'), JSON.stringify(c[0].shadow));
      check(`${tag}: order name, rating, price, colours, sizes`, c.every((x) => x.order));
      check(`${tag}: name ${desktop ? 13 : 12}px, two lines at most`, c.every((x) => x.titleSize === (desktop ? 13 : 12) && x.titleLines <= 2), JSON.stringify(c.map((x) => [x.titleSize, x.titleLines])));
      check(`${tag}: price ${desktop ? 16 : 14}px`, c.every((x) => x.priceSize === (desktop ? 16 : 14)), JSON.stringify(c.map((x) => x.priceSize)));
      check(`${tag}: size buttons ${desktop ? 11 : 10}px`, c.every((x) => x.sizeButtons.every((s) => s === (desktop ? 11 : 10))), JSON.stringify(c.map((x) => x.sizeButtons)));
      check(`${tag}: colour chips: rounded rectangles, ${desktop ? '26 x 22' : '22 x 18'}`, c.every((x) => x.swatch === null || x.swatch.join() === (desktop ? '26,22,4px' : '22,18,4px')), JSON.stringify(c.map((x) => x.swatch)));
      // The "Collection grid product" reference: centred name, rating and price; lines and labels for the rows.
      check(`${tag}: name centred, regular weight, no capitals`, c.every((x) => x.titleStyle.join() === '400,none,center' && x.titleCentre <= 2), JSON.stringify(c.map((x) => [x.titleStyle, x.titleCentre && x.titleCentre.toFixed(1)])));
      check(`${tag}: price centred and bold`, c.every((x) => x.priceCentre !== null && x.priceCentre <= 2 && x.priceWeight === '700'), JSON.stringify(c.map((x) => [x.priceCentre && x.priceCentre.toFixed(1), x.priceWeight])));
      check(`${tag}: thin lines above the colours and between colours and sizes`, c.every((x) => x.rules && x.rules.join() === '1px,1px'), JSON.stringify(c.map((x) => x.rules)));
      const labelled = c.filter((x) => x.colourLabel && x.sizeLabel);
      const wide = (x) => x.cardWidth - 2 * (desktop ? 12 : 8) >= 240;
      check(`${tag}: rows labelled "${rtl ? 'اللون:' : 'Colour:'}" and "${rtl ? 'المقاس:' : 'Size:'}"`, labelled.length > 0 && labelled.every((x) => x.colourLabel.text === (rtl ? 'اللون:' : 'Colour:') && x.sizeLabel.text === (rtl ? 'المقاس:' : 'Size:')), JSON.stringify(labelled.map((x) => [x.colourLabel.text, x.sizeLabel.text])));
      check(`${tag}: labels ${desktop && width >= 1280 ? 'beside' : 'above'} their rows (${desktop && width >= 1280 ? 'wide' : 'narrow'} card)`, labelled.every((x) => (wide(x) ? x.colourLabel.beside && x.sizeLabel.beside : x.colourLabel.above && x.sizeLabel.above)), JSON.stringify(labelled.map((x) => [Math.round(x.cardWidth), x.colourLabel.above, x.colourLabel.beside])));
      const reviewed = c.filter((x) => x.handle.startsWith('linen-maxi-skirt-with-front-pockets'));
      const others = c.filter((x) => !x.handle.startsWith('linen-maxi-skirt-with-front-pockets'));
      check(`${tag}: rating from real reviews: stars and (12), ${desktop ? 11 : 10}px`, reviewed.length > 0 && reviewed.every((x) => x.rating && x.rating.stars && x.rating.size === (desktop ? 11 : 10) && x.rating.text.includes('(12)')), JSON.stringify(reviewed.map((x) => x.rating)));
      check(`${tag}: rating centred, gold stars`, reviewed.every((x) => x.ratingCentre <= 2 && x.star === '#f2b33d'), JSON.stringify(reviewed.map((x) => [x.ratingCentre, x.star])));
      check(`${tag}: no reviews, no rating row (no empty space)`, others.every((x) => x.rating === null), JSON.stringify(others.filter((x) => x.rating).map((x) => x.handle)));
      // Grid: two cards a row on phones, 8px apart; 16px from 750px; four a row from 990px.
      const rows = {};
      c.forEach((x) => (rows[x.cardTop] = rows[x.cardTop] || []).push(x));
      const first = Object.values(rows)[0].sort((a, b) => a.left - b.left);
      const gap = first.length > 1 ? Math.round(first[1].left - first[0].right) : null;
      const perRow = first.length;
      check(`${tag}: ${width < 750 ? 'two cards a row, 8px apart' : `${desktop ? 'four' : 'three'} cards a row, 16px apart`}`, (width < 750 ? perRow === 2 && gap === 8 : gap === 16 && (!desktop || perRow === 4)), `${perRow} cards, gap ${gap}`);
      check(`${tag}: no sideways page scroll`, r.overflow <= 0, r.overflow);
      check(`${tag}: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.closeAll();
    }

    // ---------------- The product page ----------------
    for (const width of [390, 1440]) {
      const tag = `${L} [${width}] product page`;
      const desktop = width >= 990;
      const page = await open(width, '/products/linen-maxi-skirt-with-front-pockets', { touch: !desktop });
      const r = await page.evaluate(() => {
        const info = document.querySelector('#MainProduct-template--1__main .product__info-container');
        const at = (sel) => { const el = info.querySelector(sel); return el ? [...info.querySelectorAll('*')].indexOf(el) : -1; };
        const legend = (i) => (info.querySelectorAll('variant-selects fieldset legend')[i] || {}).textContent?.replace(/\s+/g, ' ').trim();
        const sizeInputs = [...info.querySelectorAll('variant-selects .product-form__input--pill')][0];
        const chosen = sizeInputs && sizeInputs.querySelector('input:checked + label');
        const struck = sizeInputs && sizeInputs.querySelector('input.disabled + label');
        const media = document.querySelector('#MainProduct-template--1__main .product__media-item .global-media-settings, #MainProduct-template--1__main .product__media-item .product-media-container');
        const title = info.querySelector('.product__title h1');
        const price = info.querySelector('.price--large');
        return {
          order: {
            title: at('.product__title'),
            price: at('[id^="price-"]'),
            colour: at('variant-selects'),
            sizeGuide: at('.product-popup-modal__opener'),
            sku: at('.product__sku'),
            add: at('.product-form__submit'),
            shipping: at('.icon-with-text'),
            description: at('.product__description'),
            facts: at('.dsr-facts'),
          },
          titleSize: parseFloat(getComputedStyle(title).fontSize),
          priceSize: parseFloat(getComputedStyle(price).fontSize),
          priceWeight: getComputedStyle(price).fontWeight,
          colourLegend: legend(0),
          sizeLegend: legend(1),
          sizeShape: chosen && { radius: getComputedStyle(chosen).borderTopLeftRadius, height: chosen.getBoundingClientRect().height, frame: getComputedStyle(chosen).boxShadow, bg: getComputedStyle(chosen).backgroundColor },
          struck: struck && getComputedStyle(struck).textDecorationLine,
          mediaRadius: media && getComputedStyle(media).borderTopLeftRadius,
        };
      });
      // The rating under the name is Judge.me's badge, an app block (its code lives in the app,
      // so it isn't rendered here): its place in the template is checked below.
      const seq = ['title', 'price', 'colour', 'sizeGuide', 'sku', 'add', 'shipping', 'description', 'facts'];
      check(`${tag}: order: name, rating, price, colour, size, size guide, product code, add to cart, shipping and exchange, description, fabric and fit`, seq.every((k, i) => r.order[k] > -1 && (i === 0 || r.order[k] > r.order[seq[i - 1]])), JSON.stringify(r.order));
      check(`${tag}: name ${desktop ? 24 : 20}px, price ${desktop ? 20 : 18}px bold`, r.titleSize === (desktop ? 24 : 20) && r.priceSize === (desktop ? 20 : 18) && Number(r.priceWeight) === 700, JSON.stringify([r.titleSize, r.priceSize, r.priceWeight]));
      check(`${tag}: labels "Color — olive", "Size — L"`, r.colourLegend === 'Color — olive' && r.sizeLegend === 'Size — L', `${r.colourLegend} | ${r.sizeLegend}`);
      // (Exact sizes and colours: tests/pdp-selectors.test.js.)
      check(`${tag}: sizes: rounded 8px buttons, 46px high; the chosen one framed in black, not filled`, r.sizeShape && r.sizeShape.radius === '8px' && r.sizeShape.height === 46 && /rgb\(17, 17, 17\)/.test(r.sizeShape.frame) && r.sizeShape.bg === 'rgb(255, 255, 255)', JSON.stringify(r.sizeShape));
      check(`${tag}: a size not in stock is struck through`, r.struck === 'line-through', r.struck);
      check(`${tag}: rounded photos (10px)`, r.mediaRadius === '10px', r.mediaRadius);
      check(`${tag}: no JS errors`, page.errors.length === 0, page.errors.join(' | '));

      // ---------------- The sticky bar (phones) ----------------
      if (!desktop) {
        const bar = () =>
          page.evaluate(() => {
            const el = document.querySelector('[data-dsr-sticky-atc]');
            const r = el.getBoundingClientRect();
            const wa = document.querySelector('.dsr-wa');
            const w = wa && wa.getBoundingClientRect();
            const thumb = el.querySelector('[data-dsr-sticky-thumb]');
            return {
              visible: el.classList.contains('is-visible') && getComputedStyle(el).visibility === 'visible',
              thumb: thumb ? thumb.getAttribute('src') : null,
              title: el.querySelector('.dsr-sticky-atc__title').textContent.trim(),
              price: el.querySelector('[data-dsr-sticky-price]').textContent.trim(),
              meta: el.querySelector('[data-dsr-sticky-meta]').textContent.trim(),
              change: el.querySelector('[data-dsr-sticky-change]').textContent.trim(),
              label: el.querySelector('[data-dsr-sticky-btn]').textContent.trim(),
              bottom: Math.round(r.bottom),
              top: r.top,
              waClear: !w || w.bottom <= r.top + 1,
              padding: parseFloat(getComputedStyle(document.body).paddingBottom),
              height: el.offsetHeight,
            };
          });
        await page.evaluate(() => {
          const f = document.querySelector('product-info product-form');
          window.scrollTo(0, f.getBoundingClientRect().bottom + window.scrollY + 120);
        });
        await page.waitForTimeout(700);
        let b = await bar();
        check(`${tag}: sticky bar: shown past the add button, at the bottom`, b.visible && b.bottom === 844, JSON.stringify(b));
        check(`${tag}: sticky bar: photo, name, price`, b.thumb && /linen-maxi-skirt-with-front-pockets/.test(b.thumb) && b.title.length > 0 && /249/.test(b.price), JSON.stringify(b));
        check(`${tag}: sticky bar: the colour, "${strings.dressar.product.change}", and "${strings.dressar.product.pick_size}" until a size is chosen`, b.meta === 'olive' && b.change === strings.dressar.product.change && b.label === strings.dressar.product.pick_size, JSON.stringify(b));
        check(`${tag}: sticky bar: WhatsApp button above it, page padded by its height`, b.waClear && Math.abs(b.padding - b.height) <= 1, JSON.stringify(b));
        // Choose a colour and a size: the bar follows.
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
          window.scrollTo(0, f.getBoundingClientRect().bottom + window.scrollY + 120);
        });
        await page.waitForTimeout(500);
        b = await bar();
        check(`${tag}: sticky bar after choosing Genzari, XL: "Genzari / XL", its photo, and the add button's own label`, b.meta === 'Genzari / XL' && /front-pockets-2\.jpg/.test(b.thumb) && b.label === strings.products.product.add_to_cart, JSON.stringify(b));
        check(`${tag}: sticky bar: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      }
      await page.closeAll();
    }
  }

  // The rating under the name: Judge.me's badge right after the title, before the price.
  {
    const raw = require('fs').readFileSync(path.join(root, 'templates/product.json'), 'utf8');
    const order = JSON.parse(raw.slice(raw.indexOf('{'))).sections.main.block_order;
    const badge = order.findIndex((b) => b.startsWith('judge_me_reviews_preview_badge'));
    check('product template: Judge.me rating right after the name, before the price', badge === order.indexOf('title') + 1 && badge < order.indexOf('price'), order.join(', '));
  }

  await browser.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) {
      failed++;
      console.log(`FAIL  ${r.name}  -> ${r.detail}`);
    }
  }
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
