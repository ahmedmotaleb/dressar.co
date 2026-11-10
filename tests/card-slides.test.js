// Photo slideshow on collection cards (snippets/dsr-card-slides.liquid,
// assets/dsr-card-slides.js): autoplay on mouse hover over the photo, swipe
// on touch screens. The theme's real collection page, rendered by
// tests/lib/theme-harness.js and driven in Chromium: a real mouse for
// desktop, touch emulation and Chromium's own touch gestures for phones and
// tablets.
// usage: node tests/card-slides.test.js [themeRoot]
'use strict';

const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');
const { buildProduct } = require('./lib/catalog');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const MOUSE_WIDTHS = [990, 1280, 1440];
const TOUCH_WIDTHS = [360, 390, 430, 768];
const STEP = 800;

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

async function main() {
  const browser = await chromium.launch();
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const linenRaw = catalog.products.find((p) => p.handle === 'linen-maxi-skirt-with-front-pockets');
  const linen = buildProduct(linenRaw);
  const onePhoto = catalog.products.find((p) => p.media.length === 1).handle;
  // A card by its product, whether or not a picked colour has added ?variant= to its link.
  const card = (handle) => `#product-grid > li:has(a.full-unstyled-link:is([href="/products/${handle}"], [href^="/products/${handle}?"]))`;
  const LINEN = card(linen.handle);
  // The extra images of the linen skirt: media 1 to 4 (5 with its photo).
  const extraImage = /linen-maxi-skirt-with-front-pockets-[1-4]\.jpg/;

  for (const locale of ['en.default', 'ar']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });

    const open = async (width, pagePath, { touch = false, reducedMotion = 'no-preference' } = {}) => {
      const sf = storefront({ root, harness, catalog });
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: touch, isMobile: touch, reducedMotion });
      const page = await context.newPage();
      page.errors = [];
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
        pages: (url) => sf.pages(url),
      });
      await page.goto(`http://dressar.test${pagePath}`);
      await page.waitForTimeout(600);
      page.closeAll = () => context.close();
      return page;
    };

    // Records, for a card, every change of the shown image (0 = its own photo) with a timestamp.
    const record = (page, sel) =>
      page.evaluate((sel) => {
        const el = document.querySelector(`${sel} dsr-card-slides`);
        window.__shown = [];
        const t0 = performance.now();
        const now = () => {
          const slides = [...el.querySelectorAll('.dsr-card-slides__slide')];
          const i = slides.findIndex((s) => s.classList.contains('is-active'));
          return i < 0 ? 0 : i;
        };
        let last = now();
        new MutationObserver(() => {
          const i = now();
          if (i !== last) window.__shown.push([Math.round(performance.now() - t0), i]);
          last = i;
        }).observe(el, { subtree: true, attributes: true, attributeFilter: ['class'] });
      }, sel);
    const shown = (page) => page.evaluate(() => window.__shown.slice());
    const activeCount = (page) => page.evaluate(() => document.querySelectorAll('.dsr-card-slides__slide.is-active').length);
    const photoBox = async (page, sel) => {
      await page.locator(`${sel} .card__media`).scrollIntoViewIfNeeded();
      return page.locator(`${sel} .card__media`).boundingBox();
    };
    const loadedExtras = (page) => page.requests.filter((u) => extraImage.test(u)).length;

    // ---------------- Desktop with a mouse ----------------
    for (const width of MOUSE_WIDTHS) {
      if (rtl && width !== 1280) continue;
      const tag = `${L} [${width} mouse]`;
      const page = await open(width, '/collections/skirts');

      const setup = await page.evaluate((sel) => {
        const el = document.querySelector(`${sel} dsr-card-slides`);
        const media = document.querySelector(`${sel} .card__media`);
        const r = media.getBoundingClientRect();
        return {
          slides: el ? el.querySelectorAll('.dsr-card-slides__slide').length : 0,
          withSrc: el ? [...el.querySelectorAll('img')].filter((i) => i.getAttribute('src')).length : -1,
          ratio: r.height / r.width,
          hoverEffect: document.querySelector(`${sel} .media`).classList.contains('media--hover-effect'),
        };
      }, LINEN);
      check(`${tag} up to 5 images (the linen skirt has 6): 5 slides`, setup.slides === 5, setup.slides);
      check(`${tag} 3:4 photo box`, Math.abs(setup.ratio - 4 / 3) < 0.01, setup.ratio);
      check(`${tag} extra images not loaded before hover`, setup.withSrc === 0 && loadedExtras(page) === 0, `${setup.withSrc} ${loadedExtras(page)}`);
      check(`${tag} Dawn's second-image hover is off for slideshow cards`, !setup.hoverEffect);

      // Hover the photo: the card's own photo first, then a new image every 800ms.
      const box = await photoBox(page, LINEN);
      const sizeBefore = await page.locator(LINEN).boundingBox();
      await record(page, LINEN);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
      await page.waitForTimeout(80);
      const atStart = await activeCount(page);
      await page.waitForTimeout(STEP * 4 + 500);
      const seq = await shown(page);
      const sizeDuring = await page.locator(LINEN).boundingBox();
      check(`${tag} hover starts on the card's own photo`, atStart === 0, atStart);
      check(`${tag} then images 2, 3, 4, 5 in turn`, seq.map((s) => s[1]).slice(0, 4).join() === '1,2,3,4', JSON.stringify(seq));
      const gaps = seq.slice(1, 4).map((s, i) => s[0] - seq[i][0]);
      check(`${tag} every 800ms`, seq.length >= 4 && Math.abs(seq[0][0] - STEP) < 250 && gaps.every((g) => Math.abs(g - STEP) < 250), JSON.stringify(seq));
      check(`${tag} images loaded on hover, from the product's media`, loadedExtras(page) >= 4, loadedExtras(page));
      const others = await page.evaluate((sel) => {
        const mine = document.querySelector(`${sel} dsr-card-slides`);
        const rest = [...document.querySelectorAll('dsr-card-slides')].filter((e) => e !== mine);
        return { active: rest.filter((e) => e.querySelector('.is-active')).length, loaded: rest.filter((e) => [...e.querySelectorAll('img')].some((i) => i.getAttribute('src'))).length };
      }, LINEN);
      check(`${tag} only the hovered card plays; the others load nothing`, others.active === 0 && others.loaded === 0, JSON.stringify(others));
      check(`${tag} the card's size doesn't change`, JSON.stringify(sizeBefore) === JSON.stringify(sizeDuring), `${JSON.stringify(sizeBefore)} ${JSON.stringify(sizeDuring)}`);

      const look = await page.evaluate((sel) => {
        const media = document.querySelector(`${sel} .card__media`).getBoundingClientRect();
        const active = document.querySelector(`${sel} .dsr-card-slides__slide.is-active img`);
        const badge = document.querySelector(`${sel} .card__inner .card__badge .badge`) || document.querySelector(`${sel} .badge`);
        const plus = document.querySelector(`${sel} .dsr-quick-add__button`);
        const out = { cover: null, fills: null, badgeOver: null, plusOnTop: null };
        if (active) {
          const r = active.getBoundingClientRect();
          out.cover = getComputedStyle(active).objectFit;
          out.fills = Math.abs(r.width - media.width) < 1 && Math.abs(r.height - media.height) < 1;
        }
        if (badge) {
          const b = badge.getBoundingClientRect();
          const stack = document.elementsFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          const bi = stack.findIndex((e) => badge.contains(e) || e === badge);
          const si = stack.findIndex((e) => e.closest && e.closest('dsr-card-slides'));
          out.badgeOver = bi > -1 && (si === -1 || bi < si);
        }
        if (plus) {
          const p = plus.getBoundingClientRect();
          out.plusOnTop = plus.contains(document.elementFromPoint(p.left + p.width / 2, p.top + p.height / 2));
        }
        return out;
      }, LINEN);
      check(`${tag} images fill the 3:4 box without stretching (cover)`, look.cover === 'cover' && look.fills, JSON.stringify(look));
      check(`${tag} sale badge stays on top of the images`, look.badgeOver === true, JSON.stringify(look));
      check(`${tag} the "+" stays on top`, look.plusOnTop === true, JSON.stringify(look));

      // Over the "+": still the photo, still playing. Click it: quick add, no navigation, no slideshow side effects.
      const plusBox = await page.locator(`${LINEN} .dsr-quick-add__button`).boundingBox();
      await page.mouse.move(plusBox.x + plusBox.width / 2, plusBox.y + plusBox.height / 2);
      await page.waitForTimeout(STEP + 150);
      const playingOverPlus = (await shown(page)).length > seq.length;
      check(`${tag} keeps playing with the pointer on the "+"`, playingOverPlus);
      const urlBefore = page.url();
      await page.mouse.click(plusBox.x + plusBox.width / 2, plusBox.y + plusBox.height / 2);
      await page.waitForSelector('quick-add-modal[open]', { timeout: 4000 }).catch(() => {});
      const dialog = await page.evaluate(() => Boolean(document.querySelector('quick-add-modal[open]')));
      check(`${tag} the "+" opens quick add, not the product page`, dialog && page.url() === urlBefore, `${dialog} ${page.url()}`);
      check(`${tag} quick add opening stops the slideshow`, (await activeCount(page)) === 0);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Leave the photo: back to the first photo at once, and no more changes.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
      await page.waitForTimeout(STEP + 200);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height + 60);
      const right = await page.evaluate((sel) => ({
        active: document.querySelectorAll(`${sel} .dsr-card-slides__slide.is-active`).length,
        visible: [...document.querySelectorAll(`${sel} .dsr-card-slides__slide`)].filter((s) => getComputedStyle(s).opacity !== '0' && getComputedStyle(s).display !== 'none').length,
      }), LINEN);
      check(`${tag} leaving the photo (to the card's text): reset to the first photo immediately`, right.active === 0 && right.visible === 0, JSON.stringify(right));
      await record(page, LINEN);
      await page.waitForTimeout(STEP * 2 + 200);
      check(`${tag} nothing plays on the card's text, and no timer is left`, (await shown(page)).length === 0, JSON.stringify(await shown(page)));

      // Another card: only it plays.
      const second = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#product-grid > li')].filter((li) => li.querySelector('dsr-card-slides'));
        return cards[1] ? `#product-grid > li:nth-child(${[...cards[1].parentElement.children].indexOf(cards[1]) + 1})` : null;
      });
      if (second) {
        const b2 = await photoBox(page, second);
        await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 3);
        await page.waitForTimeout(STEP + 250);
        const one = await page.evaluate((sel) => ({ total: document.querySelectorAll('.dsr-card-slides__slide.is-active').length, mine: document.querySelectorAll(`${sel} .dsr-card-slides__slide.is-active`).length }), second);
        check(`${tag} moving to another card: only that one plays`, one.total === 1 && one.mine === 1, JSON.stringify(one));
        // Scrolled off screen under a still pointer: stops.
        await page.evaluate(() => window.scrollBy(0, 3000));
        await page.waitForTimeout(300);
        const after = await page.evaluate((sel) => document.querySelectorAll(`${sel} .dsr-card-slides__slide.is-active`).length, second);
        check(`${tag} card scrolled off screen: stops at once`, after === 0, after);
        await page.mouse.move(5, 5);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(200);
      }

      // Click the photo during the slideshow: the product page.
      const b3 = await photoBox(page, LINEN);
      await page.mouse.move(b3.x + b3.width / 2, b3.y + b3.height / 3);
      await page.waitForTimeout(STEP + 200);
      await Promise.all([page.waitForURL(/\/products\/linen-maxi-skirt-with-front-pockets/, { timeout: 5000 }).catch(() => {}), page.mouse.click(b3.x + b3.width / 2, b3.y + b3.height / 3)]);
      check(`${tag} clicking the photo opens the product`, /\/products\/linen-maxi-skirt-with-front-pockets$/.test(new URL(page.url()).pathname), page.url());
      check(`${tag} no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.closeAll();
    }

    if (!rtl) {
      const tag = `${L} [1280 mouse]`;
      // One photo: no slideshow, Dawn's card as before.
      let page = await open(1280, '/collections/skirts');
      const one = card(onePhoto);
      const single = await page.evaluate((sel) => ({ slides: document.querySelectorAll(`${sel} dsr-card-slides`).length, imgs: document.querySelectorAll(`${sel} .card__media img`).length }), one);
      check(`${tag} a product with one photo stays static (no slideshow)`, single.slides === 0 && single.imgs === 1, JSON.stringify(single));

      // A picked colour stays: no slideshow on that card.
      await page.locator(`${LINEN} .dsr-card-swatch[aria-label="Genzari"]`).click();
      await page.waitForTimeout(200);
      const b = await photoBox(page, LINEN);
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3);
      await page.waitForTimeout(STEP * 2 + 200);
      const picked = await page.evaluate((sel) => ({ active: document.querySelectorAll(`${sel} .is-active`).length, src: document.querySelector(`${sel} .card__media .media > img`).getAttribute('src') }), LINEN);
      check(`${tag} after picking a colour, its photo stays (no slideshow)`, picked.active === 0 && /front-pockets-2\.jpg/.test(picked.src), JSON.stringify(picked));
      await page.closeAll();

      // Reduced motion: nothing plays, nothing extra loads.
      page = await open(1280, '/collections/skirts', { reducedMotion: 'reduce' });
      const br = await photoBox(page, LINEN);
      await page.mouse.move(br.x + br.width / 2, br.y + br.height / 3);
      await page.waitForTimeout(STEP * 2 + 200);
      check(`${tag} reduced motion: no slideshow, no extra images loaded`, (await activeCount(page)) === 0 && loadedExtras(page) === 0, `${await activeCount(page)} ${loadedExtras(page)}`);
      await page.closeAll();

      // Only the collection grid: search results and the homepage keep Dawn's cards.
      for (const p of ['/search?q=skirt', '/']) {
        page = await open(1280, p);
        const n = await page.evaluate(() => document.querySelectorAll('dsr-card-slides').length);
        check(`${tag} ${p}: no slideshow outside the collection grid`, n === 0, n);
        await page.closeAll();
      }
    }

    // ---------------- Touch screens ----------------
    for (const width of TOUCH_WIDTHS) {
      if (rtl && width !== 390) continue;
      const tag = `${L} [${width} touch]`;
      const page = await open(width, '/collections/skirts', { touch: true });
      const cdp = await page.context().newCDPSession(page);
      // A real touch drag (finger down, moves, up) through Chromium's input pipeline; it scrolls
      // the way a phone does. (Input.synthesizeScrollGesture does nothing in headless here.)
      const swipe = async (x, y, dx, dy) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(x), y: Math.round(y) }] });
        const steps = 12;
        for (let i = 1; i <= steps; i++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(x + (dx * i) / steps), y: Math.round(y + (dy * i) / steps) }] });
          await new Promise((r) => setTimeout(r, 16));
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };

      await page.waitForTimeout(STEP * 2);
      check(`${tag} no autoplay`, (await activeCount(page)) === 0 && loadedExtras(page) === 0, `${await activeCount(page)} ${loadedExtras(page)}`);

      const box = await photoBox(page, LINEN);
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const hit = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return { slides: Boolean(el && el.closest('dsr-card-slides')), lifted: Boolean(document.querySelector('.dsr-card--slides')) };
      }, { x: cx, y: cy });
      check(`${tag} the photos take touches (above the card link)`, hit.slides && hit.lifted, JSON.stringify(hit));

      const state = () =>
        page.evaluate((sel) => {
          const track = document.querySelector(`${sel} .dsr-card-slides__track`);
          const slides = [...track.querySelectorAll('.dsr-card-slides__slide')];
          return {
            scroll: Math.round(track.scrollLeft),
            slide: Math.round(Math.abs(track.scrollLeft) / track.clientWidth),
            width: track.clientWidth,
            pageY: Math.round(window.scrollY),
            url: location.pathname,
            loaded: slides.filter((s) => s.querySelector('img').complete && s.querySelector('img').naturalWidth > 0).length,
            copy: (slides[0].querySelector('img').getAttribute('src') || ''),
          };
        }, LINEN);

      // Sideways swipe: the next photo, no page scroll, no navigation.
      const s0 = await state();
      const sizeBefore = await page.locator(LINEN).boundingBox();
      await swipe(cx, cy, rtl ? box.width * 0.7 : -box.width * 0.7, 0);
      await page.waitForTimeout(700);
      const s1 = await state();
      const sizeAfter = await page.locator(LINEN).boundingBox();
      check(`${tag} sideways swipe: next photo (${rtl ? 'right to left' : 'left to right'})`, s1.slide === 1 && (rtl ? s1.scroll < 0 : s1.scroll > 0), JSON.stringify(s1));
      check(`${tag} sideways swipe: no navigation, the page doesn't move`, s1.url === '/collections/skirts' && Math.abs(s1.pageY - s0.pageY) < 3, `${s1.url} ${s0.pageY}->${s1.pageY}`);
      check(`${tag} images loaded on the first touch, the first slide is the card's photo`, s1.loaded >= 3 && /front-pockets-0\.jpg/.test(s1.copy), JSON.stringify(s1));
      check(`${tag} the card's size doesn't change`, JSON.stringify(sizeBefore) === JSON.stringify(sizeAfter));

      // Up-and-down swipe on the photo: the page scrolls, the row doesn't.
      await swipe(cx, cy, 0, -300);
      await page.waitForTimeout(600);
      const s2 = await state();
      check(`${tag} vertical swipe on the photo scrolls the page, not the row`, s2.pageY - s1.pageY > 150 && s2.scroll === s1.scroll, `${s1.pageY}->${s2.pageY} ${s1.scroll}->${s2.scroll}`);

      // Badge and "+" on top of the photos. The badge lets touches through
      // (pointer-events: none), so for the paint order it is made hit-testable here.
      const top = await page.evaluate((sel) => {
        const badge = document.querySelector(`${sel} .badge`);
        const plus = document.querySelector(`${sel} .dsr-quick-add__button`);
        const layer = badge.closest('.card__content');
        const b = badge.getBoundingClientRect();
        const p = plus.getBoundingClientRect();
        const throughBadge = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        layer.style.pointerEvents = 'auto';
        badge.style.pointerEvents = 'auto';
        const onBadge = badge.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2));
        layer.style.pointerEvents = '';
        badge.style.pointerEvents = '';
        return {
          badge: onBadge,
          swipeOnBadge: Boolean(throughBadge && throughBadge.closest('dsr-card-slides')),
          plus: plus.contains(document.elementFromPoint(p.left + p.width / 2, p.top + p.height / 2)),
        };
      }, LINEN);
      check(`${tag} sale badge and "+" stay on top of the photos`, top.badge && top.plus, JSON.stringify(top));
      check(`${tag} a swipe can start on the badge too`, top.swipeOnBadge, JSON.stringify(top));

      // A picked colour: the first slide shows it and the row goes back to it.
      await page.locator(`${LINEN} .dsr-card-swatch[aria-label="Genzari"]`).click();
      await page.waitForTimeout(400);
      const s3 = await state();
      check(`${tag} picking a colour: back to the first slide, showing that colour`, s3.slide === 0 && Math.abs(s3.scroll) <= 1 && /front-pockets-2\.jpg/.test(s3.copy), JSON.stringify(s3));

      // The "+": quick add, not the product page.
      const plus = await page.locator(`${LINEN} .dsr-quick-add__button`).boundingBox();
      await page.touchscreen.tap(plus.x + plus.width / 2, plus.y + plus.height / 2);
      await page.waitForSelector('quick-add-modal[open]', { timeout: 4000 }).catch(() => {});
      const dialog = await page.evaluate(() => ({ open: Boolean(document.querySelector('quick-add-modal[open]')), url: location.pathname }));
      check(`${tag} tapping "+" opens quick add, not the product page`, dialog.open && dialog.url === '/collections/skirts', JSON.stringify(dialog));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);

      // A tap on the photo opens the product (with the picked colour).
      const b2 = await photoBox(page, LINEN);
      await Promise.all([page.waitForURL(/\/products\//, { timeout: 5000 }).catch(() => {}), page.touchscreen.tap(b2.x + b2.width / 2, b2.y + b2.height / 2)]);
      const u = new URL(page.url());
      check(`${tag} a tap on the photo opens the product`, u.pathname === '/products/linen-maxi-skirt-with-front-pockets' && u.searchParams.get('pick') === 'color', page.url());
      check(`${tag} no JS errors`, page.errors.length === 0, page.errors.join(' | '));
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
