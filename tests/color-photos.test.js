// Colour photo selector on the product page (snippets/dsr-color-photos.liquid):
// each colour as its own product photo, chosen through Dawn's own variant
// picker; colours sold as separate products linked from the product's "Other
// colours" metafield (custom.color_products). The theme's real product
// template, rendered by tests/lib/theme-harness.js and driven in Chromium;
// variant changes go through Dawn's product-info.js.
// usage: node tests/color-photos.test.js [themeRoot]
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');
const { buildProduct } = require('./lib/catalog');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const WIDTHS = [360, 390, 430, 768, 1280, 1440];
const info = '#MainProduct-template--1__main';
const photos = `${info} variant-selects .product-form__input--dsr-photos`;

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

// The fixture catalog plus the cases the selector has to handle:
// - qa-one-colour: one colour, nothing linked;
// - qa-tiered-skirt: three colours, one with a photo, one with only a swatch
//   colour, one with neither (the store's "Wine Tiered Skirt" has a colour
//   with no photo);
// - qa-no-photos: colours with swatches but no variant photos, nothing linked
//   (Dawn's swatches stay);
// - qa-sold-out-pocket: a sold-out product, linked from the pocket skirt;
// - qa-size-only: no colour option, with linked colour products;
// - qa-many-colours: seven colours, each with its own photo (more than a phone
//   row holds);
// - black-pocket-maxi-skirt: linked to the wine pocket skirt, itself, the
//   sold-out pocket skirt and the four-colour linen skirt, in that order.
function testCatalog() {
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const sizes = ['M', 'L'];
  const add = (p) => catalog.products.push({ type: 'Skirt', created: 1, ...p });
  add({
    handle: 'qa-one-colour',
    title: 'One Colour Skirt',
    options: [{ name: 'Color', values: [['Navy', '#1F2A44']] }, { name: 'Size', values: sizes }],
    media: [[810, 1080]],
    variants: sizes.map((s) => [['Navy', s], 45900, 0, 1, 0]),
  });
  add({
    handle: 'qa-tiered-skirt',
    title: 'Tiered Skirt',
    options: [{ name: 'Color', values: [['Wine', '#722F37'], ['Black', '#000000'], ['Undyed']] }, { name: 'Size', values: sizes }],
    media: [[810, 1080]],
    variants: [
      [['Wine', 'M'], 49900, 0, 1, 0],
      [['Wine', 'L'], 49900, 0, 1, 0],
      [['Black', 'M'], 49900, 0, 1, null],
      [['Black', 'L'], 49900, 0, 1, null],
      [['Undyed', 'M'], 49900, 0, 1, null],
      [['Undyed', 'L'], 49900, 0, 1, null],
    ],
  });
  add({
    handle: 'qa-no-photos',
    title: 'No Photos Skirt',
    options: [{ name: 'Color', values: [['Red', '#C00000'], ['Blue', '#1E3A8A']] }, { name: 'Size', values: sizes }],
    media: [[810, 1080]],
    variants: [
      [['Red', 'M'], 39900, 0, 1, null],
      [['Red', 'L'], 39900, 0, 1, null],
      [['Blue', 'M'], 39900, 0, 1, null],
      [['Blue', 'L'], 39900, 0, 1, null],
    ],
  });
  add({
    handle: 'qa-sold-out-pocket',
    title: 'Olive Pocket Skirt',
    options: [{ name: 'Color', values: [['Olive', '#556B2F']] }, { name: 'Size', values: sizes }],
    media: [[810, 1080]],
    variants: sizes.map((s) => [['Olive', s], 39900, 0, 0, 0]),
  });
  add({
    handle: 'qa-size-only',
    title: 'Size Only Skirt',
    options: [{ name: 'Size', values: sizes }],
    media: [[810, 1080]],
    variants: sizes.map((s) => [[s], 39900, 0, 1, 0]),
    colorProducts: ['wine-pocket-maxi-skirt', 'qa-size-only'],
  });
  const many = [['Black', '#000000'], ['Navy', '#1F2A44'], ['Olive', '#556B2F'], ['Sand', '#C2B280'], ['Rose', '#C08081'], ['Grey', '#808080'], ['Teal', '#0E7F8B']];
  add({
    handle: 'qa-many-colours',
    title: 'Many Colours Skirt',
    options: [{ name: 'Color', values: many }, { name: 'Size', values: sizes }],
    media: many.map(() => [810, 1080]),
    variants: many.flatMap(([c], i) => sizes.map((s) => [[c, s], 39900, 0, 1, i])),
  });
  catalog.products.find((p) => p.handle === 'black-pocket-maxi-skirt').colorProducts = [
    'wine-pocket-maxi-skirt',
    'black-pocket-maxi-skirt',
    'qa-sold-out-pocket',
    'linen-maxi-skirt-with-front-pockets',
  ];
  return catalog;
}

// A colour's photo as the theme should pick it: the first variant of that
// colour with a photo.
function photoOf(catalog, handle, colour) {
  const p = buildProduct(catalog.products.find((x) => x.handle === handle));
  const v = p.variants.find((x) => x.option1 === colour && x.featured_media);
  return v ? v.featured_media.filename : null;
}

async function main() {
  const browser = await chromium.launch();
  const catalog = testCatalog();
  const linen = buildProduct(catalog.products.find((p) => p.handle === 'linen-maxi-skirt-with-front-pockets'));
  const firstOf = (product, colour) => product.variants.find((v) => v.option1 === colour && v.available) || product.variants.find((v) => v.option1 === colour);

  for (const locale of ['en.default', 'ar']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });
    const strings = readJson(path.join(root, 'locales', `${locale}.json`));
    const soldOut = strings.products.product.sold_out;

    const open = async (width, pagePath) => {
      const sf = storefront({ root, harness, catalog });
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await context.newPage();
      page.errors = [];
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
        pages: (url) => sf.pages(url),
      });
      await page.goto(`http://dressar.test${pagePath}`);
      await page.waitForTimeout(600);
      page.closeAll = () => context.close();
      return page;
    };
    const settle = (page) => page.waitForTimeout(800);

    // Every photo, link and label in the selector, in order.
    const tiles = (page) =>
      page.evaluate((sel) => {
        const box = document.querySelector(sel);
        if (!box) return null;
        const track = box.querySelector('.dsr-color-photos__track');
        const tr = track.getBoundingClientRect();
        const items = [...track.querySelectorAll('.dsr-color-photo')].map((el) => {
          const input = el.tagName === 'LABEL' ? document.getElementById(el.htmlFor) : null;
          const img = el.querySelector('img');
          const swatch = el.querySelector('.dsr-color-photo__swatch');
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            kind: el.tagName === 'A' ? 'link' : el.getAttribute('aria-current') === 'true' ? 'current' : 'radio',
            name: (el.querySelector('.visually-hidden') || {}).textContent?.trim(),
            href: el.getAttribute('href'),
            checked: input ? input.checked : el.getAttribute('aria-current') === 'true',
            soldOut: el.classList.contains('dsr-color-photo--sold-out'),
            img: img ? img.getAttribute('src') : null,
            imgOpacity: img ? getComputedStyle(img).opacity : null,
            swatchBg: swatch ? getComputedStyle(swatch).backgroundColor : null,
            swatchText: swatch ? swatch.textContent.trim() : null,
            strike: getComputedStyle(el, '::after').backgroundImage,
            w: r.width,
            h: r.height,
            left: r.left,
            right: r.right,
            visible: r.left >= tr.left - 1 && r.right <= tr.right + 1,
            border: cs.borderTopColor,
            borderWidth: cs.borderTopWidth,
          };
        });
        const legend = box.querySelector('legend, .form__label');
        return {
          items,
          legend: legend.textContent.replace(/\s+/g, ' ').trim(),
          overflowX: getComputedStyle(track).overflowX,
          wrap: getComputedStyle(track).flexWrap,
          scrolls: track.scrollWidth > track.clientWidth,
          tops: [...new Set([...track.querySelectorAll('.dsr-color-photo')].map((el) => Math.round(el.getBoundingClientRect().top)))].length,
          pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
          colourSelectors: document.querySelectorAll(`${sel.split(' variant-selects')[0]} .product-form__input--dsr-photos`).length,
          dawnSwatches: document.querySelectorAll(`${sel.split(' variant-selects')[0]} variant-selects .swatch-input__input, ${sel.split(' variant-selects')[0]} variant-selects .swatch`).length,
          firstFieldset: (document.querySelector(`${sel.split(' variant-selects')[0]} variant-selects fieldset`) || {}).className || '',
        };
      }, photos);

    const state = (page) =>
      page.evaluate((sel) => {
        const rootEl = document.querySelector(sel);
        const priceBox = rootEl.querySelector('.price');
        const sale = priceBox.classList.contains('price--on-sale');
        const num = (el) => (el ? Number(el.textContent.replace(/[^\d]/g, '')) : null);
        const atc = rootEl.querySelector('.product-form__submit');
        const featured = rootEl.querySelector('.product__media-item.is-active img, .product__media-list .product__media-item:first-child img');
        return {
          url: location.pathname + location.search,
          price: num(sale ? priceBox.querySelector('.price__sale .price-item--last') : priceBox.querySelector('.price__regular .price-item--regular')),
          atcDisabled: atc.disabled,
          atcText: atc.textContent.replace(/\s+/g, ' ').trim(),
          media: featured ? featured.getAttribute('src') : null,
          sympl: [...document.querySelectorAll('sympl-widget')].map((w) => w.getAttribute('productprice')),
          sizes: [...rootEl.querySelectorAll('variant-selects fieldset:nth-of-type(2) input')].filter((i) => !i.classList.contains('disabled')).map((i) => i.value).join(),
          barLabel: (document.querySelector('[data-dsr-sticky-btn]') || {}).textContent?.trim(),
        };
      }, info);

    const clickColour = async (page, name) => {
      await page.locator(`${photos} label.dsr-color-photo:has(.visually-hidden:text-is("${name}"))`).first().click();
      await settle(page);
    };

    for (const width of WIDTHS) {
      if (rtl && ![390, 1280].includes(width)) continue;
      const tag = `${L} [${width}]`;
      const phone = width < 750;
      const scrollRow = width < 990;

      // ---------- Several colours: photos, look, order, layout ----------
      {
        const page = await open(width, '/products/linen-maxi-skirt-with-front-pockets');
        const r = await tiles(page);
        if (!r) {
          check(`${tag} linen skirt: colour photo selector shown`, false, 'missing');
          await page.closeAll();
          continue;
        }
        const colours = ['olive', 'Genzari', 'coffe', 'Green'];
        check(`${tag} one colour selector, no colour circles`, r.colourSelectors === 1 && r.dawnSwatches === 0, `${r.colourSelectors} ${r.dawnSwatches}`);
        check(`${tag} the colour row comes first, Dawn's size row second`, /dsr-photos/.test(r.firstFieldset), r.firstFieldset);
        check(`${tag} one photo per colour, in the product's order`, r.items.map((i) => i.name).join() === colours.join(), r.items.map((i) => i.name).join());
        const expected = colours.map((c) => photoOf(catalog, 'linen-maxi-skirt-with-front-pockets', c));
        check(`${tag} each photo is that colour's own variant photo`, r.items.every((i, k) => i.img && i.img.includes(expected[k])), JSON.stringify(r.items.map((i) => i.img)));
        const w = phone ? 68 : 76;
        check(`${tag} ${w}px wide, 3:4`, r.items.every((i) => Math.abs(i.w - w) < 0.6 && Math.abs(i.h - (w * 4) / 3) < 1), JSON.stringify(r.items.map((i) => [i.w, i.h])));
        check(`${tag} selected colour's name above the photos`, r.legend === 'Color: olive', r.legend);
        const sel = r.items.find((i) => i.checked);
        const other = r.items.find((i) => !i.checked && !i.soldOut);
        check(`${tag} selected: thin black frame; others: a faint one`, sel && sel.borderWidth === '1px' && /^rgb\(/.test(sel.border) && other.borderWidth === '1px' && /rgba\(.*0\.15\)/.test(other.border), `${sel && sel.border} / ${other && other.border}`);
        const green = r.items[3];
        check(`${tag} sold-out colour (Green): faded and struck through`, green.soldOut && green.imgOpacity === '0.45' && /linear-gradient/.test(green.strike), JSON.stringify([green.soldOut, green.imgOpacity, green.strike.slice(0, 40)]));
        check(`${tag} in-stock colours are not struck through`, r.items.filter((i) => !i.soldOut).length === 3 && r.items.filter((i) => !i.soldOut).every((i) => i.strike === 'none'));
        if (scrollRow) {
          check(`${tag} row scrolls sideways below 990px`, r.overflowX === 'auto', r.overflowX);
        } else {
          check(`${tag} row wraps from 990px`, r.wrap === 'wrap', r.wrap);
        }
        check(`${tag} no sideways page scroll`, r.pageOverflow <= 0, r.pageOverflow);
        const order = r.items.map((i) => (rtl ? -i.right : i.left));
        check(`${tag} photos run ${rtl ? 'right to left' : 'left to right'}`, order.every((x, k) => k === 0 || x > order[k - 1]), JSON.stringify(order.map(Math.round)));
        check(`${tag} no JS errors`, page.errors.length === 0, page.errors.join(' | '));
        await page.closeAll();
      }

      // ---------- Many colours: the row and the selected colour ----------
      {
        const page = await open(width, '/products/qa-many-colours');
        let r = await tiles(page);
        if (scrollRow) {
          check(`${tag} 7 colours: the row scrolls, the page doesn't`, r.scrolls && r.pageOverflow <= 0, `${r.scrolls} ${r.pageOverflow}`);
        } else {
          check(`${tag} 7 colours: wrap onto more rows, nothing hidden`, !r.scrolls && r.items.every((i) => i.visible) && r.pageOverflow <= 0, `${r.tops} rows ${r.pageOverflow}`);
        }
        // Choose the last colour (scrolling to it first on phones): it stays in view after Dawn redraws the picker.
        await page.locator(`${photos} label.dsr-color-photo`).last().scrollIntoViewIfNeeded();
        await clickColour(page, 'Teal');
        r = await tiles(page);
        const teal = r.items[6];
        check(`${tag} after choosing the last colour (Teal): it's selected and fully in view`, teal.checked && teal.visible && r.legend.endsWith('Teal'), JSON.stringify([teal.checked, teal.visible, r.legend]));
        check(`${tag} many colours: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
        await page.closeAll();
      }
    }

    // ---------- Choosing colours: Dawn's variant change follows ----------
    for (const width of rtl ? [390] : [390, 1280]) {
      const tag = `${L} [${width}]`;
      const page = await open(width, '/products/linen-maxi-skirt-with-front-pockets');
      await clickColour(page, 'Genzari');
      let s = await state(page);
      let r = await tiles(page);
      // Dawn keeps the size already chosen (olive's first in-stock size) when the colour changes.
      const startSize = linen.variants.find((v) => v.available).option2;
      const genzari = linen.variants.find((v) => v.option1 === 'Genzari' && v.option2 === startSize);
      check(`${tag} choose Genzari: it's selected, its name above`, r.items[1].checked && r.legend.endsWith('Genzari'), r.legend);
      check(`${tag} choose Genzari: URL names its variant (same size, ${startSize})`, s.url === `/products/linen-maxi-skirt-with-front-pockets?variant=${genzari.id}`, s.url);
      check(`${tag} choose Genzari: main photo is Genzari's`, (s.media || '').includes(photoOf(catalog, 'linen-maxi-skirt-with-front-pockets', 'Genzari')), s.media);
      check(`${tag} choose Genzari: price and Sympl follow`, s.price === genzari.price / 100 && s.sympl.length === 1 && Number(s.sympl[0]) === genzari.price / 100, `${s.price} ${s.sympl}`);
      check(`${tag} choose Genzari: its sizes and stock (all 5 in stock)`, s.sizes === 'M,L,XL,XXL,3XL', s.sizes);
      check(`${tag} choose Genzari: add to cart enabled`, !s.atcDisabled, s.atcText);

      // Sold out, but still selectable: its photos, price and page stay reachable.
      await clickColour(page, 'Green');
      s = await state(page);
      r = await tiles(page);
      const green = linen.variants.find((v) => v.option1 === 'Green' && v.option2 === startSize);
      check(`${tag} choose sold-out Green: selectable, its name above`, r.items[3].checked && r.legend.endsWith('Green'), r.legend);
      check(`${tag} choose sold-out Green: URL, photo follow; add to cart says sold out`, s.url.endsWith(`variant=${green.id}`) && (s.media || '').includes(photoOf(catalog, 'linen-maxi-skirt-with-front-pockets', 'Green')) && s.atcDisabled && s.atcText.includes(soldOut), `${s.url} ${s.media} ${s.atcText}`);
      check(`${tag} choose sold-out Green: no size in stock`, s.sizes === '', s.sizes);
      check(`${tag} choosing colours: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.closeAll();
    }

    // ---------- Keyboard ----------
    if (!rtl) {
      const page = await open(1280, '/products/linen-maxi-skirt-with-front-pockets');
      let focused = null;
      for (let i = 0; i < 80 && !focused; i++) {
        await page.keyboard.press('Tab');
        focused = await page.evaluate(() => (document.activeElement && document.activeElement.matches('.product-form__input--dsr-photos input') ? document.activeElement.value : null));
      }
      const ring = await page.evaluate(() => {
        const label = document.querySelector(`label[for="${document.activeElement.id}"]`);
        return label ? getComputedStyle(label).outlineStyle + ' ' + getComputedStyle(label).outlineWidth : null;
      });
      check('[en] [1280] keyboard: Tab reaches the selected colour, with a focus ring', focused === 'olive' && /solid 2px/.test(ring || ''), `${focused} ${ring}`);
      await page.keyboard.press('ArrowRight');
      await settle(page);
      const after = await page.evaluate(() => ({
        checked: (document.querySelector('.product-form__input--dsr-photos input:checked') || {}).value,
        active: document.activeElement && document.activeElement.value,
      }));
      check('[en] [1280] keyboard: arrow key chooses the next colour, focus stays on it', after.checked === 'Genzari' && after.active === 'Genzari', JSON.stringify(after));
      await page.closeAll();
    }

    // ---------- Colours sold as separate products ----------
    for (const width of rtl ? [390] : [390, 1280]) {
      const tag = `${L} [${width}]`;
      const page = await open(width, '/products/black-pocket-maxi-skirt');
      const r = await tiles(page);
      const kinds = r.items.map((i) => i.kind).join();
      check(`${tag} linked colours in the metafield's order, this product in its place`, kinds === 'link,radio,link,link,link,link,link', kinds);
      check(`${tag} this product's colour is selected`, r.items[1].checked);
      check(`${tag} a one-colour linked product links to its page`, r.items[0].href === '/products/wine-pocket-maxi-skirt', r.items[0].href);
      check(`${tag} linked product with no colour option: its own photo`, (r.items[0].img || '').includes('wine-pocket-maxi-skirt-0.jpg'), r.items[0].img);
      const multi = r.items.slice(3);
      const ok = ['olive', 'Genzari', 'coffe', 'Green'].every((c, k) => multi[k].href === `/products/linen-maxi-skirt-with-front-pockets?variant=${firstOf(linen, c).id}&pick=color` && (multi[k].img || '').includes(photoOf(catalog, 'linen-maxi-skirt-with-front-pockets', c)));
      check(`${tag} a several-colour linked product: one link per colour, to that colour's variant, with its photo`, ok, JSON.stringify(multi.map((i) => [i.href, i.img])));
      check(`${tag} sold-out linked product: faded, struck through, named sold out, still a link`, r.items[2].soldOut && r.items[2].href === '/products/qa-sold-out-pocket' && r.items[2].name.includes(soldOut) && /linear-gradient/.test(r.items[2].strike), JSON.stringify(r.items[2]));
      check(`${tag} sold-out colour of a linked product marked too (Green)`, multi[3].soldOut && !multi[0].soldOut);
      if (width < 990) check(`${tag} 7 colours: the row scrolls, the page doesn't`, r.scrolls && r.pageOverflow <= 0, `${r.scrolls} ${r.pageOverflow}`);
      check(`${tag} one colour selector on the page`, r.colourSelectors === 1, r.colourSelectors);

      // Following a linked colour opens that product on that colour, size still to pick.
      // Links: wine, sold-out olive pocket skirt, then the linen skirt's olive, Genzari, coffe, Green.
      const genzariLink = page.locator(`${photos} a.dsr-color-photo`).nth(3);
      await genzariLink.scrollIntoViewIfNeeded();
      await Promise.all([page.waitForURL(/linen-maxi-skirt/), genzariLink.click()]);
      await settle(page);
      const there = await page.evaluate(() => ({
        url: location.pathname + location.search,
        checked: (document.querySelector('.product-form__input--dsr-photos input:checked') || {}).value,
        bar: (document.querySelector('[data-dsr-sticky-btn]') || {}).textContent?.trim(),
      }));
      check(`${tag} a linked colour opens its product on that colour (Genzari)`, there.url.startsWith('/products/linen-maxi-skirt-with-front-pockets?variant=') && there.checked === 'Genzari', JSON.stringify(there));
      if (width < 990) check(`${tag} ... and the sticky bar still asks for a size`, there.bar === strings.dressar.product.pick_size, there.bar);
      check(`${tag} linked colours: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.closeAll();
    }

    // ---------- One colour; missing photos; no photos; no colour option ----------
    {
      const tag = `${L} [390]`;
      let page = await open(390, '/products/qa-one-colour');
      let r = await tiles(page);
      check(`${tag} one colour: one photo, selected, named`, r && r.items.length === 1 && r.items[0].checked && r.legend === 'Color: Navy' && /^rgb\(/.test(r.items[0].border), r && JSON.stringify([r.items.length, r.legend, r.items[0].border]));
      await page.closeAll();

      page = await open(390, '/products/qa-tiered-skirt');
      r = await tiles(page);
      const [wine, black, undyed] = r.items;
      check(`${tag} missing photo: a colour with a photo shows it`, (wine.img || '').includes('qa-tiered-skirt-0.jpg'), wine.img);
      check(`${tag} missing photo: a colour without one shows its swatch colour, no made-up image`, !black.img && black.swatchBg === 'rgb(0, 0, 0)', JSON.stringify(black));
      check(`${tag} missing photo and swatch: the colour's name instead`, !undyed.img && undyed.swatchText === 'Undyed', JSON.stringify(undyed));
      check(`${tag} missing photo: same 3:4 tile for all`, r.items.every((i) => Math.abs(i.w - 68) < 0.6 && Math.abs(i.h - 90.67) < 1), JSON.stringify(r.items.map((i) => [i.w, i.h])));
      await clickColour(page, 'Black');
      r = await tiles(page);
      check(`${tag} missing photo: that colour can still be chosen`, r.items[1].checked && r.legend.endsWith('Black') && page.errors.length === 0, `${r.legend} ${page.errors.join(' | ')}`);
      await page.closeAll();

      page = await open(390, '/products/qa-no-photos');
      r = await tiles(page);
      const circles = await page.evaluate((sel) => document.querySelectorAll(`${sel} variant-selects .swatch-input__input`).length, info);
      check(`${tag} no variant photos and nothing linked: Dawn's colour swatches stay`, r === null && circles === 2, `${r} ${circles}`);
      await page.closeAll();

      page = await open(390, '/products/qa-size-only');
      r = await tiles(page);
      const sizesStill = await page.evaluate((sel) => document.querySelectorAll(`${sel} variant-selects fieldset input`).length, info);
      check(`${tag} no colour option, linked colours: a row on its own, labelled "${strings.dressar.product.colour}"`, r && r.legend === strings.dressar.product.colour, r && r.legend);
      check(`${tag} ... this product (its photo, selected) in its place after the linked one`, r && r.items.map((i) => i.kind).join() === 'link,current' && (r.items[1].img || '').includes('qa-size-only-0.jpg') && /^rgb\(/.test(r.items[1].border), r && JSON.stringify(r.items));
      check(`${tag} ... and the size choice is still Dawn's`, sizesStill === 2, sizesStill);
      check(`${tag} edge cases: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.closeAll();
    }

    // ---------- Accessibility ----------
    for (const pagePath of ['/products/linen-maxi-skirt-with-front-pockets', '/products/black-pocket-maxi-skirt', '/products/qa-size-only']) {
      const page = await open(390, pagePath);
      // Scroll through first, as a shopper would: Dawn's scroll reveals start faded (tests/a11y.test.js does the same).
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
      });
      await page.waitForTimeout(900);
      await page.addScriptTag({ content: axeSource });
      const v = await page.evaluate(async (sel) => {
        const r = await window.axe.run({ include: [sel] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
        return r.violations.map((x) => `${x.impact} ${x.id}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' , ')}`);
      }, `${info} variant-selects`);
      check(`${L} [390] ${pagePath}: no axe violations in the picker`, v.length === 0, v.join(' | '));
      const names = await page.evaluate((sel) => [...document.querySelectorAll(`${sel} .dsr-color-photo`)].every((el) => (el.querySelector('.visually-hidden') || {}).textContent?.trim()), photos);
      check(`${L} [390] ${pagePath}: every photo has its colour as its name`, names);
      await page.closeAll();
    }

    // ---------- In the quick-add dialog ----------
    {
      const page = await open(390, '/collections/skirts');
      const opener = page.locator('#product-grid .dsr-quick-add__button[data-product-url*="linen-maxi-skirt-with-front-pockets"]').first();
      if (await opener.count()) {
        await opener.scrollIntoViewIfNeeded();
        await opener.click();
        await page.waitForSelector('quick-add-modal[open] .product-form__input--dsr-photos', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(400);
        const inDialog = await page.evaluate(() => document.querySelectorAll('quick-add-modal[open] .product-form__input--dsr-photos .dsr-color-photo img').length);
        check(`${L} [390] quick-add dialog shows the colour photos too`, inDialog === 4, inDialog);
        await page.locator('quick-add-modal[open] label.dsr-color-photo:has(.visually-hidden:text-is("Genzari"))').click();
        await page.waitForTimeout(800);
        const picked = await page.evaluate(() => (document.querySelector('quick-add-modal[open] .product-form__input--dsr-photos input:checked') || {}).value);
        check(`${L} [390] quick-add dialog: choosing a colour photo works`, picked === 'Genzari' && page.errors.length === 0, `${picked} ${page.errors.join(' | ')}`);
      } else {
        check(`${L} [390] quick-add dialog: linen skirt card found`, false);
      }
      await page.closeAll();
    }
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
