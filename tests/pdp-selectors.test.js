// Product page colour and size selectors in the 2S style (docs/stages/2s-redesign.md,
// "Product page selectors"): Cairo for Arabic, the type scale, 42 x 30 colour chips,
// 64 x 46 size buttons, labels and spacing. Measured in Chromium at phone widths,
// in Arabic (right to left) and English, on the theme's real product page rendered
// by tests/lib/theme-harness.js.
// usage: node tests/pdp-selectors.test.js [themeRoot]
'use strict';

const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const WIDTHS = [360, 390, 430];
const PRODUCT = 'linen-maxi-skirt-with-front-pockets';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });
const hex = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;

async function main() {
  const browser = await chromium.launch();
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const product = catalog.products.find((p) => p.handle === PRODUCT);
  const colours = product.options.find((o) => o.name === 'Color').values; // [[name, hex], ...]

  for (const locale of ['ar', 'en.default']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });

    for (const width of WIDTHS) {
      const tag = `${L} [${width}]`;
      const sf = storefront({ root, harness, catalog });
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
      await routeTheme(page, { root, fontsDir, harness, imageSize: sf.imageSize, globalsFor: () => sf.globalsFor(), cartSection: sf.cartSection, cartJson: sf.cartJson, pages: (url) => sf.pages(url) });
      await page.goto(`http://dressar.test/products/${PRODUCT}`);
      await page.waitForTimeout(700);

      const measure = () =>
        page.evaluate(async () => {
          await document.fonts.ready;
          const info = document.querySelector('#MainProduct-template--1__main .product__info-container');
          const cs = (e) => getComputedStyle(e);
          const box = (e) => e.getBoundingClientRect();
          const swatchSet = info.querySelector('variant-selects .product-form__input--swatch');
          const sizeSet = info.querySelector('variant-selects .product-form__input--pill');
          const legend = (f) => f.querySelector('legend');
          const chips = [...swatchSet.querySelectorAll('.swatch-input__label > .swatch')];
          const sizes = [...sizeSet.querySelectorAll('input + label')];
          const title = info.querySelector('.product__title h1');
          const price = info.querySelector('.price--large');
          const add = info.querySelector('.product-form__submit');
          const text = (e) => e.textContent.replace(/\s+/g, ' ').trim();
          // The space between two neighbours in a row, whichever way the row runs.
          const gap = (a, b) => Math.round(document.dir === 'rtl' ? box(a).left - box(b).right : box(b).left - box(a).right);
          const firstRowTop = Math.min(...sizes.map((l) => box(l).top));
          const firstRow = sizes.filter((l) => Math.abs(box(l).top - firstRowTop) < 1);
          const setBox = box(sizeSet);
          return {
            cairoFace: [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'DSR Cairo' && f.status === 'loaded'),
            titleFont: cs(title).fontFamily,
            title: [cs(title).fontSize, cs(title).fontWeight, cs(title).textTransform, cs(title).letterSpacing],
            price: [cs(price).fontSize, cs(price).fontWeight, cs(price).letterSpacing],
            labels: [legend(swatchSet), legend(sizeSet)].map((l) => [text(l), cs(l).fontSize, cs(l).fontWeight, cs(l).textTransform, cs(l).letterSpacing]),
            chips: chips.map((c) => {
              const input = c.parentElement.previousElementSibling;
              return {
                value: input.value,
                w: Math.round(box(c).width),
                h: Math.round(box(c).height),
                radius: cs(c).borderTopLeftRadius,
                border: `${cs(c).borderTopWidth} ${cs(c).borderTopColor}`,
                shadow: cs(c).boxShadow,
                bg: cs(c).backgroundColor,
                checked: input.checked,
              };
            }),
            chipGap: gap(chips[0], chips[1]),
            chipsAtStart: Math.round(document.dir === 'rtl' ? box(swatchSet).right - box(chips[0]).right : box(chips[0]).left - box(swatchSet).left),
            labelToChips: Math.round(box(chips[0]).top - box(legend(swatchSet)).bottom),
            colourToSize: Math.round(box(legend(sizeSet)).top - box(swatchSet).bottom),
            labelToSizes: Math.round(firstRowTop - box(legend(sizeSet)).bottom),
            sizes: sizes.map((l) => {
              const input = document.getElementById(l.htmlFor);
              return {
                value: input.value,
                w: Math.round(box(l).width),
                h: Math.round(box(l).height),
                radius: cs(l).borderTopLeftRadius,
                border: `${cs(l).borderTopWidth} ${cs(l).borderTopColor}`,
                shadow: cs(l).boxShadow,
                bg: cs(l).backgroundColor,
                color: cs(l).color,
                font: [cs(l).fontSize, cs(l).fontWeight, cs(l).textTransform, cs(l).letterSpacing],
                checked: input.checked,
                out: input.classList.contains('disabled') || input.disabled,
              };
            }),
            sizeGap: firstRow.length > 1 ? gap(firstRow[0], firstRow[1]) : null,
            rows: new Set(sizes.map((l) => Math.round(box(l).top))).size,
            sizesInside: sizes.every((l) => box(l).left >= setBox.left - 0.5 && box(l).right <= setBox.right + 0.5),
            sizesAtStart: Math.round(document.dir === 'rtl' ? setBox.right - box(sizes[0]).right : box(sizes[0]).left - setBox.left),
            add: [cs(add).textTransform, cs(add).letterSpacing],
            sizeGuide: Boolean(info.querySelector('.product-popup-modal__opener')),
            overflow: document.documentElement.scrollWidth - window.innerWidth,
          };
        });

      const r = await measure();

      // Typography.
      check(`${tag} Cairo is loaded for the Arabic text and leads the product details' font stack`, r.cairoFace && /^"?DSR Cairo"?,/.test(r.titleFont), `${r.cairoFace} ${r.titleFont}`);
      check(`${tag} name 20px bold (700)`, r.title[0] === '20px' && r.title[1] === '700', r.title.join());
      check(`${tag} price 18px bold (700)`, r.price[0] === '18px' && r.price[1] === '700', r.price.join());
      check(`${tag} colour and size labels 14px bold (700)`, r.labels.every((l) => l[1] === '14px' && l[2] === '700'), JSON.stringify(r.labels));
      check(`${tag} size values 14px medium (500)`, r.sizes.every((s) => s.font[0] === '14px' && s.font[1] === '500'), JSON.stringify(r.sizes.map((s) => s.font)));
      check(`${tag} no uppercase on the name, labels, sizes or add to cart`, [r.title[2], ...r.labels.map((l) => l[3]), ...r.sizes.map((s) => s.font[2]), r.add[0]].every((t) => t === 'none'), JSON.stringify([r.title[2], r.labels.map((l) => l[3]), r.add[0]]));
      if (rtl) {
        check(`${tag} no letter-spacing on Arabic text (name, price, labels, sizes, add to cart)`, [r.title[3], r.price[2], ...r.labels.map((l) => l[4]), ...r.sizes.map((s) => s.font[3]), r.add[1]].every((v) => v === 'normal' || v === '0px'), JSON.stringify([r.title[3], r.price[2], r.labels.map((l) => l[4]), r.add[1]]));
      }

      // Labels: the option's name, a dash, the chosen value, right above its choices.
      check(`${tag} labels read "Color — olive" and "Size — L"`, r.labels[0][0] === 'Color — olive' && r.labels[1][0] === 'Size — L', `${r.labels[0][0]} | ${r.labels[1][0]}`);
      check(`${tag} 8-12px from each label to its choices`, r.labelToChips >= 8 && r.labelToChips <= 12 && r.labelToSizes >= 8 && r.labelToSizes <= 12, `${r.labelToChips} / ${r.labelToSizes}`);
      check(`${tag} 18-22px between the colour and size sections`, r.colourToSize >= 18 && r.colourToSize <= 22, r.colourToSize);

      // Colour chips.
      check(`${tag} colour chips 42 x 30 with 5px corners`, r.chips.length === colours.length && r.chips.every((c) => c.w === 42 && c.h === 30 && c.radius === '5px'), JSON.stringify(r.chips.map((c) => [c.w, c.h, c.radius])));
      check(`${tag} chips 12px apart, starting at the ${rtl ? 'right' : 'left'}`, r.chipGap === 12 && Math.abs(r.chipsAtStart) <= 1, `${r.chipGap} ${r.chipsAtStart}`);
      check(`${tag} chips in the variants' own colours`, colours.every(([name, h]) => (r.chips.find((c) => c.value === name) || {}).bg === hex(h)), JSON.stringify(r.chips.map((c) => [c.value, c.bg])));
      const chosenChip = r.chips.find((c) => c.checked);
      const otherChip = r.chips.find((c) => !c.checked);
      check(`${tag} chip not chosen: a light grey edge`, otherChip.border === '1px rgb(217, 217, 217)' && otherChip.shadow === 'none', `${otherChip.border} ${otherChip.shadow}`);
      check(`${tag} chosen chip: black outer frame with a white ring inside`, chosenChip && chosenChip.value === 'olive' && chosenChip.border === '1px rgb(17, 17, 17)' && /rgb\(17, 17, 17\) 0px 0px 0px 1px/.test(chosenChip.shadow) && /rgb\(255, 255, 255\) 0px 0px 0px 2px inset/.test(chosenChip.shadow), chosenChip && `${chosenChip.border} ${chosenChip.shadow}`);

      // Choosing a colour still runs Dawn's variant change: label, chosen chip and size stock follow.
      await page.click(`#MainProduct-template--1__main variant-selects .product-form__input--swatch input[value="Genzari"] + label`);
      await page.waitForTimeout(900);
      const g = await measure();
      check(`${tag} choosing Genzari: its chip is framed, the label reads "Color — Genzari"`, g.chips.find((c) => c.checked)?.value === 'Genzari' && g.labels[0][0] === 'Color — Genzari', `${g.chips.find((c) => c.checked)?.value} | ${g.labels[0][0]}`);
      check(`${tag} Genzari: every size in stock`, g.sizes.every((s) => !s.out), JSON.stringify(g.sizes.map((s) => [s.value, s.out])));

      // Size buttons (measured on Genzari: chosen, not chosen, all in stock).
      check(`${tag} size buttons at least 64px wide, 46px high, 8px corners, white`, g.sizes.every((s) => s.w >= 64 && s.h === 46 && s.radius === '8px' && s.bg === 'rgb(255, 255, 255)'), JSON.stringify(g.sizes.map((s) => [s.value, s.w, s.h, s.radius, s.bg])));
      const plain = g.sizes.filter((s) => !s.checked);
      check(`${tag} size not chosen: 1px #D9D9D9 edge`, plain.length && plain.every((s) => s.border === '1px rgb(217, 217, 217)' && s.shadow === 'none'), JSON.stringify(plain.map((s) => s.border)));
      const chosenSize = g.sizes.find((s) => s.checked);
      check(`${tag} chosen size: 2px #111 edge (1px border + 1px inner ring), white`, chosenSize && chosenSize.border === '1px rgb(17, 17, 17)' && /rgb\(17, 17, 17\) 0px 0px 0px 1px inset/.test(chosenSize.shadow) && chosenSize.bg === 'rgb(255, 255, 255)', chosenSize && `${chosenSize.border} ${chosenSize.shadow}`);
      check(`${tag} size buttons 10px apart, starting at the ${rtl ? 'right' : 'left'}`, g.sizeGap === 10 && Math.abs(g.sizesAtStart) <= 1, `${g.sizeGap} ${g.sizesAtStart}`);
      check(`${tag} size buttons wrap onto more rows instead of overflowing`, g.sizesInside && (width >= 430 ? g.rows >= 1 : g.rows >= 2), `${g.rows} rows, inside ${g.sizesInside}`);

      // Sold out (olive, before): struck through and lighter, still legible.
      const out = r.sizes.filter((s) => s.out);
      check(`${tag} a size not in stock: lighter edge and text, still readable`, out.length && out.every((s) => s.border === '1px rgb(236, 236, 236)' && s.color === 'rgba(17, 17, 17, 0.6)'), JSON.stringify(out.map((s) => [s.border, s.color])));

      check(`${tag} size guide still there`, r.sizeGuide);
      check(`${tag} no sideways page scroll`, r.overflow <= 0, r.overflow);
      check(`${tag} no JS errors`, errors.length === 0, errors.join(' | '));
      await context.close();
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
