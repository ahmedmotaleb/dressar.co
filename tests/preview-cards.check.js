// The compact V2 card (docs/stages/card-v2.md) on the real Shopify preview theme, with the
// store's own products: the same layout checks as tests/card-upgrade.test.js
// (tests/lib/card-layout.js), plus a colour pick, a size pick and the quick-add bag on real
// cards. Add-to-cart requests are recorded and stopped (never sent), so the store's cart and
// analytics are untouched. Needs network access to the store; not part of `npm test`.
// usage: node tests/preview-cards.check.js [themeId] [--shots dir]
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { measureCardLayout, spread, ALIGNED } = require('./lib/card-layout');

const THEME = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '168399831271';
const shotsArg = process.argv.indexOf('--shots');
const SHOTS = shotsArg > -1 ? process.argv[shotsArg + 1] : null;
const WIDTHS = [360, 390, 430, 1440];
const PAGES = ['/search?q=skirt+jacket&type=product', '/collections/all'];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

async function main() {
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

  for (const [lang, prefix] of [['ar', '/ar'], ['en', '']]) {
    for (const width of WIDTHS) {
      const desktop = width >= 990;
      for (const pagePath of PAGES) {
        const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height: 900 }, isMobile: !desktop, hasTouch: !desktop, deviceScaleFactor: desktop ? 1 : 2, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => !/tiktok|importScripts|Failed to fetch/i.test(e.message) && errors.push(e.message));
        const sep = pagePath.includes('?') ? '&' : '?';
        await page.goto(`https://dressar.co${prefix}${pagePath}${sep}preview_theme_id=${THEME}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForTimeout(3500);
        // Shopify's preview bar and the WhatsApp button sit over the grid; hide them to measure and shoot.
        await page.addStyleTag({ content: '#PBarNextFrameWrapper,#preview-bar-iframe,.dsr-wa{display:none!important}' });
        const themeId = await page.evaluate(() => window.Shopify && Shopify.theme && Shopify.theme.id);
        const tag = `[${lang}] [${width}] ${pagePath.split('?')[0]}`;
        check(`${tag}: preview theme ${THEME} served`, String(themeId) === THEME, String(themeId));
        await page.evaluate(async () => {
          for (let y = 0; y < Math.min(document.body.scrollHeight, 6000); y += 700) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 60));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(500);
        const { cards, rows, overflow } = await page.evaluate(measureCardLayout);
        check(`${tag}: cards`, cards.length >= 4, String(cards.length));
        check(`${tag}: names on exactly one line, the same height`, cards.every((c) => c.titleOneLine && Math.abs(c.titleHeight - c.titleLineHeight) <= 0.5) && spread(cards, 'titleHeight') <= 0.5, JSON.stringify(cards.filter((c) => !c.titleOneLine).map((c) => c.title.slice(0, 30))));
        const bad = rows.map((rw) => ({ titles: rw.map((c) => c.title.slice(0, 16)), ...Object.fromEntries(ALIGNED.map((k) => [k, Math.round(spread(rw, k) * 10) / 10])) })).filter((sp) => ALIGNED.some((k) => sp[k] > 1));
        check(`${tag}: every grid row: same card height; photo bottom, name, price, colours, sizes, card bottom within 1px (${rows.length} rows)`, rows.length > 0 && bad.length === 0, JSON.stringify(bad.slice(0, 2)));
        check(`${tag}: price 14px 600; rating 10px on its line; compare-at price never cut`, cards.every((c) => c.priceFont && c.priceFont.join() === '14px,600' && !c.compareCut) && cards.filter((c) => c.rating).every((c) => c.rating.font === '10px' && Math.abs((c.rating.rect.top + c.rating.rect.bottom) / 2 - (c.priceTop + c.priceHeight / 2)) <= 2), JSON.stringify(cards.filter((c) => c.compareCut).map((c) => c.title.slice(0, 20))));
        check(`${tag}: colours 16px squares, 8px apart; sizes 24px, 4px corners, 11px, one row`, cards.every((c) => c.dots.every((d) => d === 16) && c.dotGaps.every((g) => g === 8) && c.dotsInside && c.sizes.every((b) => b.h === 24 && b.radius === '4px' && b.font === '11px') && new Set(c.sizes.map((b) => b.top)).size <= 1), JSON.stringify(cards.slice(0, 2).map((c) => [c.dots, c.dotGaps, c.sizes[0]])));
        check(`${tag}: 32px bag on the photo's bottom-right; no labels, no dividers, 8px padding`, cards.every((c) => (!c.bag || (c.bag.w === 32 && c.bag.bagIcon)) && c.labels === 0 && c.padding === '8px' && c.dividers.every((w) => w === '0px')), JSON.stringify(cards.slice(0, 1).map((c) => [c.bag, c.labels, c.padding])));
        check(`${tag}: no sideways page scroll`, overflow <= 0, String(overflow));
        check(`${tag}: no JS errors`, errors.length === 0, errors.join(' | '));
        if (SHOTS && pagePath === PAGES[0]) {
          await page.evaluate(() => {
            const g = document.querySelector('#product-grid');
            if (g) g.scrollIntoView();
            window.scrollBy(0, -60);
          });
          await page.waitForTimeout(900);
          await page.screenshot({ path: path.join(SHOTS, `after-${lang}-${width}.png`) });
        }

        // Behaviour on a real card (phones, first page only): colour, size, quick add.
        if (width === 390 && pagePath === PAGES[0]) {
          const adds = [];
          await page.route('**/cart/add**', (route) => {
            adds.push(route.request().postData() || '');
            route.abort();
          });
          const target = await page.evaluate(() => {
            const card = [...document.querySelectorAll('.product-card-wrapper')].find((c) => c.querySelectorAll('button.dsr-card-swatch').length > 1 && c.querySelector('.dsr-card-swatch[aria-pressed="false"]:not(.dsr-card-swatch--sold-out)'));
            if (!card) return null;
            card.setAttribute('data-qa', 'v2');
            return card.querySelector('.card__heading a').getAttribute('href').split('?')[0];
          });
          check(`[${lang}] real card with several colours found`, Boolean(target), String(target));
          if (target) {
            const sel = '[data-qa="v2"]';
            const state = () =>
              page.evaluate((s) => {
                const c = document.querySelector(s);
                const pressed = c.querySelector('.dsr-card-swatch[aria-pressed="true"]');
                return {
                  colour: pressed && pressed.dataset.value,
                  img: c.querySelector('.card__media img').getAttribute('src'),
                  price: c.querySelector('.card-information .price').textContent.replace(/\s+/g, ' ').trim(),
                  open: [...c.querySelectorAll('.dsr-card-size')].filter((b) => b.getAttribute('aria-disabled') !== 'true').map((b) => b.dataset.value),
                  link: c.querySelector('.card__heading a').getAttribute('href'),
                  height: Math.round(c.getBoundingClientRect().height),
                };
              }, sel);
            const before = await state();
            await page.click(`${sel} .dsr-card-swatch[aria-pressed="false"]:not(.dsr-card-swatch--sold-out)`);
            await page.waitForTimeout(800);
            const after = await state();
            check(`[${lang}] picking another colour: selected, its link (variant, pick=color), card height unchanged`, after.colour && after.colour !== before.colour && /variant=\d+/.test(after.link) && /pick=color/.test(after.link) && after.height === before.height, JSON.stringify({ before, after }));
            if (after.open.length) {
              await page.click(`${sel} .dsr-card-size[data-value="${after.open[0]}"]`);
              await page.waitForTimeout(400);
              const sized = await state();
              check(`[${lang}] then a size in stock: the card links to that exact variant`, /variant=\d+/.test(sized.link) && !/pick=color/.test(sized.link), sized.link);
              await page.click(`${sel} .dsr-quick-add__button`);
              await page.waitForTimeout(800);
              const variant = (/variant=(\d+)/.exec(sized.link) || [])[1];
              check(`[${lang}] the bag sends exactly that variant to the cart (request stopped, not sent)`, adds.length === 1 && adds[0].includes(variant), JSON.stringify([variant, adds.map((a) => (/name="id"\r\n\r\n(\d+)/.exec(a) || [])[1])]));
            }
          }
        }
        await context.close();
      }
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
