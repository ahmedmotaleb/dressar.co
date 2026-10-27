// Stage 4 collection page and product card tests: the theme's real collection
// template (Dawn banner, grid, facets, pagination, cards), rendered by
// tests/lib/theme-harness.js from tests/fixtures/catalog.json and driven in
// Chromium. Filters, sort and pages go through Dawn's own facets.js and the
// Section Rendering API, served by the harness.
// usage: node tests/collection.test.js [themeRoot] [--shots <dir>]
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { buildCollection } = require('./lib/catalog');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const shotsArg = process.argv.indexOf('--shots');
const shotsDir = shotsArg > -1 ? process.argv[shotsArg + 1] : null;
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const locale = process.env.LOCALE || 'en.default';
const WIDTHS = [360, 390, 430, 768, 990, 1280, 1440];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

async function main() {
  const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const sizes = {};
  catalog.products.forEach((p) => p.media.forEach((m, i) => (sizes[`${p.handle}-${i}.jpg`] = m)));
  const t = (key, vars = {}) => {
    const strings = readJson(path.join(root, 'locales', `${locale}.json`));
    let v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), strings);
    if (v && typeof v === 'object') v = v[new Intl.PluralRules(locale === 'en.default' ? 'en' : locale).select(vars.count)] ?? v.other;
    return String(v).replace(/{{\s*(\w+)\s*}}/g, (_, k) => vars[k] ?? '');
  };

  const pages = async (url) => {
    if (url.pathname === '/search') {
      // Search results reuse the collection machinery: same cards, same filters.
      const results = buildCollection(catalog, 'skirts', url.searchParams);
      const search = {
        performed: true,
        terms: url.searchParams.get('q'),
        results: results.products.map((p) => Object.assign(p, { object_type: 'product' })),
        results_count: results.products_count,
        products_count: results.products_count,
        all_products_count: results.all_products_count,
        filters: results.filters,
        sort_options: results.sort_options,
        sort_by: results.sort_by,
        default_sort_by: 'relevance',
        url: '/search',
      };
      const globals = harness.globals({ path: '/search', pageType: 'search', overrides: { search, __query: url.search.slice(1), __path: '/search' } });
      return harness.renderLayout(globals, await harness.renderTemplate('search', globals));
    }
    const m = /^\/collections\/([\w-]+)$/.exec(url.pathname);
    if (!m) return null;
    const collection = buildCollection(catalog, m[1], url.searchParams);
    const globals = harness.globals({
      path: url.pathname,
      pageType: 'collection',
      overrides: { collection, __query: url.search.slice(1), __path: url.pathname },
    });
    const sid = url.searchParams.get('section_id');
    if (sid) return harness.renderTemplate('collection', globals, { only: sid });
    return harness.renderLayout(globals, await harness.renderTemplate('collection', globals));
  };

  const browser = await chromium.launch();
  const open = async (width, pagePath = '/collections/skirts', { touch = false } = {}) => {
    const context = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: touch, isMobile: touch });
    const page = await context.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    page.on('console', (msg) => msg.type() === 'error' && page.errors.push(msg.text()));
    await routeTheme(page, { root, fontsDir, harness, globalsFor: () => harness.globals(), pages, imageSize: (n) => sizes[n] });
    await page.goto(`http://dressar.test${pagePath}`);
    await page.waitForTimeout(500);
    page.closeAll = () => context.close();
    return page;
  };
  const shot = async (page, name, opts = {}) => shotsDir && page.screenshot({ path: path.join(shotsDir, `${name}.png`), ...opts });
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
  const cardFor = (handle) => `#product-grid > li:has(a[href^="/products/${handle}"])`;
  const waitForGrid = (page) => page.waitForFunction(() => !document.querySelector('#ProductGridContainer .collection.loading'), null, { timeout: 4000 }).catch(() => {});

  // ---------- Server side: every product reachable, no cap ----------
  {
    const collection = buildCollection(catalog, 'skirts');
    let seen = 0;
    let pagesCount = 0;
    for (let n = 1; n <= 20; n++) {
      const html = await pages(new URL(`http://dressar.test/collections/skirts?section_id=template--1__product-grid&page=${n}`));
      const count = (html.match(/<li\s+class="grid__item/g) || []).length;
      if (!count) break;
      seen += count;
      pagesCount = n;
      // Dawn's "next" arrow is the one labelled next page (its class names are swapped).
      if (!html.includes(`aria-label="${t('general.pagination.next')}"`)) break;
    }
    check('skirts: all 152 products reachable across pages (no 50 cap)', seen === collection.all_products_count && seen === 152, `${seen} over ${pagesCount} pages`);
    check('skirts: 16 per page, 10 pages', pagesCount === 10, String(pagesCount));
  }

  for (const width of WIDTHS) {
    const tag = `[${width}]`;
    const desktop = width >= 990;
    const page = await open(width);

    const basics = await page.evaluate(() => ({
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
      count: (document.getElementById('ProductCount') || document.getElementById('ProductCountDesktop') || {}).textContent,
      cards: document.querySelectorAll('#product-grid > li').length,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      aiGrid: Boolean(document.querySelector('[class*="ai-product-grid"], [data-product-card][class*="ai-product-card"]')),
    }));
    check(`${tag} one H1, the collection title`, basics.h1.length === 1 && basics.h1[0].endsWith('Skirts'), basics.h1.join(' | '));
    check(`${tag} product count shown`, /152/.test(basics.count || ''), basics.count);
    check(`${tag} 16 cards on page 1, AI grid gone`, basics.cards === 16 && !basics.aiGrid, `${basics.cards} ai=${basics.aiGrid}`);
    check(`${tag} no horizontal overflow`, !basics.overflow);

    const grid = await page.evaluate(() => {
      const items = [...document.querySelectorAll('#product-grid > li')];
      // offsetTop, not the bounding box: scroll-reveal animations move cards while they run.
      const tops = items.map((li) => li.offsetTop);
      const media = items.map((li) => li.querySelector('.card__inner'));
      const imgs = items.map((li) => li.querySelector('.card__media img'));
      return {
        columns: tops.filter((top) => top === tops[0]).length,
        ratios: media.map((m) => m.getBoundingClientRect().height / m.getBoundingClientRect().width),
        cover: imgs.every((i) => getComputedStyle(i).objectFit === 'cover'),
        attrs: imgs.every((i) => i.getAttribute('srcset') && i.getAttribute('sizes') && i.getAttribute('width') && i.getAttribute('height')),
        eager: imgs.slice(0, 2).every((i) => i.getAttribute('loading') !== 'lazy'),
        lazy: imgs.slice(2).every((i) => i.getAttribute('loading') === 'lazy'),
      };
    });
    check(`${tag} grid columns (${desktop ? 4 : 2})`, grid.columns === (desktop ? 4 : 2), String(grid.columns));
    check(`${tag} every card photo is 3:4`, grid.ratios.every((r) => Math.abs(r - 4 / 3) < 0.01), grid.ratios.map((r) => r.toFixed(3)).join(','));
    check(`${tag} photos cropped, not stretched (object-fit: cover)`, grid.cover);
    check(`${tag} photos have srcset, sizes, width and height`, grid.attrs);
    check(`${tag} first two photos load eagerly, the rest lazily`, grid.eager && grid.lazy);

    // Badges and prices, as the shopper sees them.
    const cards = await page.evaluate(() =>
      [...document.querySelectorAll('#product-grid > li')].map((li) => {
        const shown = (el) => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
        const badges = [...li.querySelectorAll('.card__badge .badge')].filter(shown).map((b) => b.textContent.trim());
        const num = (s) => Number((s || '').replace(/[^\d]/g, '')) || null;
        const priceEl = li.querySelector('.price');
        const sale = priceEl.classList.contains('price--on-sale');
        const current = sale ? li.querySelector('.price__sale .price-item--last') : li.querySelector('.price__regular .price-item--regular');
        return {
          href: li.querySelector('a').getAttribute('href'),
          badges,
          price: num(current.textContent),
          compare: sale && li.querySelector('.price__sale s.price-item--regular') ? num(li.querySelector('.price__sale s.price-item--regular').textContent) : null,
          onSale: sale,
          from: /from|من/i.test(current.textContent),
          title: li.querySelector('.card__heading.h5 a'),
        };
      }).map(({ title, ...rest }) => rest)
    );
    const byHandle = (h) => cards.find((c) => c.href === `/products/${h}`);
    const skirt = byHandle('linen-maxi-skirt-with-front-pockets');
    const suit = byHandle('linen-suit');
    check(`${tag} one visible badge per card at most`, cards.every((c) => c.badges.length <= 1), JSON.stringify(cards.map((c) => c.badges)));
    // Dawn prints no struck price when only the compare-at price varies by size;
    // then the badge is checked against the product's lowest compare-at price.
    const data = Object.fromEntries(buildCollection(catalog, 'skirts').products.map((p) => [p.url, p]));
    const onSale = cards.filter((c) => c.onSale && data[c.href].available);
    const honest = onSale.every((c) => {
      const compare = c.compare || data[c.href].compare_at_price / 100;
      const pct = Math.floor(((compare - c.price) * 100) / compare);
      return c.badges.length === 1 && (c.badges[0].includes(`${pct}%`) || (pct < 1 && !c.badges[0].includes('%')));
    });
    check(`${tag} visible sale badge = markdown on the card (floored)`, onSale.length >= 8 && honest, JSON.stringify(onSale.map((c) => [c.price, c.compare, c.badges[0]])));
    check(`${tag} skirt: 28% off, "From" price (sizes cost more)`, skirt && skirt.badges[0].includes('28%') && skirt.from && skirt.price === 249, JSON.stringify(skirt));
    check(`${tag} sold-out product says sold out, no sale %`, suit && suit.badges.length === 1 && !suit.badges[0].includes('%') && suit.badges[0] === t('products.product.sold_out'), JSON.stringify(suit));

    // Colour swatches from Shopify's swatch data.
    const sw = await page.evaluate((sel) => {
      const li = document.querySelector(sel);
      return [...li.querySelectorAll('.dsr-card-swatch')].map((b) => ({
        tag: b.tagName,
        label: b.getAttribute('aria-label'),
        pressed: b.getAttribute('aria-pressed'),
        soldOut: b.classList.contains('dsr-card-swatch--sold-out'),
        color: getComputedStyle(b.querySelector('.swatch')).backgroundColor,
        size: Math.round(b.getBoundingClientRect().width),
      }));
    }, cardFor('linen-maxi-skirt-with-front-pockets'));
    check(`${tag} skirt: 4 swatches in the merchant's colours`, sw.length === 4 && sw.map((s) => s.color).join() === 'rgb(115, 100, 22),rgb(14, 127, 139),rgb(167, 117, 46),rgb(5, 170, 61)', JSON.stringify(sw));
    check(`${tag} swatch tap target >= 24px`, sw.every((s) => s.size >= 24), sw.map((s) => s.size).join());
    check(`${tag} colour with no stock marked sold out (Green)`, sw[3] && sw[3].soldOut && sw[3].label.includes('Green') && !sw[0].soldOut, JSON.stringify(sw[3]));
    const single = await page.evaluate((sel) => document.querySelector(sel).querySelectorAll('.dsr-card-swatches, .dsr-card-colors').length, cardFor('510'));
    check(`${tag} one-colour product shows no swatches`, single === 0);
    const counted = await page.evaluate((sel) => (document.querySelector(`${sel} .dsr-card-colors`) || {}).textContent, cardFor('471'));
    check(`${tag} colours without swatch data show a count`, counted && counted.trim() === t('dressar.card.colors_count', { count: 2 }), counted);

    // Sizes in stock.
    const sizesOf = (h) =>
      page.evaluate((sel) => {
        const li = document.querySelector(sel);
        return li ? [...li.querySelectorAll('.dsr-card-sizes__size')].map((s) => (s.classList.contains('dsr-card-sizes__size--unavailable') ? `-${s.firstElementChild.textContent}` : s.textContent.trim())) : null;
      }, cardFor(h));
    const shirtSizes = await sizesOf('long-linen-shirt');
    check(`${tag} sizes follow variant stock (long linen shirt: M, XL in stock)`, shirtSizes && shirtSizes.join() === 'M,-L,XL,-XXL,-3XL', String(shirtSizes));
    const upperSizes = await sizesOf('476');
    check(`${tag} size option found whatever its case ("SIZE")`, upperSizes && upperSizes.length === 5 && upperSizes.every((s) => !s.startsWith('-')), String(upperSizes));
    const soldOutSizes = await sizesOf('linen-suit');
    check(`${tag} sold-out product lists no sizes`, soldOutSizes && soldOutSizes.length === 0, String(soldOutSizes));
    const oddOrder = await sizesOf('381');
    check(`${tag} sizes keep the product's own order`, oddOrder && oddOrder.join() === 'L,XL,XXL,M,3XL', String(oddOrder));

    // Long titles: two lines at most, no overflow.
    const long = await page.evaluate((sel) => {
      const a = document.querySelector(`${sel} .card__heading.h5 a`);
      const lh = parseFloat(getComputedStyle(a).lineHeight);
      // The text's own boxes, not scrollWidth: on rtl pages Chromium counts hanging spaces in scrollWidth.
      const box = a.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(a);
      const fits = [...range.getClientRects()].every((r) => r.left >= box.left - 1 && r.right <= box.right + 1);
      return { lines: Math.round(box.height / lh), fits };
    }, cardFor('linen-suit'));
    check(`${tag} long title stops at 2 lines`, long.lines <= 2 && long.fits, JSON.stringify(long));

    // Picking a colour.
    const genzari = `${cardFor('linen-maxi-skirt-with-front-pockets')} .dsr-card-swatch[aria-label="Genzari"]`;
    await page.locator(genzari).scrollIntoViewIfNeeded();
    await page.focus(genzari);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const picked = await page.evaluate((sel) => {
      const li = document.querySelector(sel);
      return {
        src: li.querySelector('.card__media img').getAttribute('src'),
        hrefs: [...li.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
        pressed: [...li.querySelectorAll('.dsr-card-swatch')].map((b) => b.getAttribute('aria-pressed')).join(),
      };
    }, cardFor('linen-maxi-skirt-with-front-pockets'));
    const genzariId = buildCollection(catalog, 'skirts').products[0].variants.find((v) => v.option1 === 'Genzari' && v.available).id;
    check(`${tag} keyboard: swatch shows its colour's photo`, /linen-maxi-skirt-with-front-pockets-2\.jpg/.test(picked.src), picked.src);
    check(`${tag} card links open that colour, size still to pick`, picked.hrefs.every((h) => h.includes(`variant=${genzariId}`) && h.includes('pick=color')), picked.hrefs.join(' '));
    check(`${tag} pressed state follows the pick`, picked.pressed === 'false,true,false,false', picked.pressed);

    if (desktop) {
      // Second photo on hover (mouse), only for products that have one.
      const shirt = cardFor('long-linen-shirt');
      await page.hover(`${shirt} .card__media`, { force: true });
      await page.waitForTimeout(450);
      const hover = await page.evaluate((sel) => {
        const imgs = document.querySelectorAll(`${sel} .card__media img`);
        return [...imgs].map((i) => getComputedStyle(i).opacity);
      }, shirt);
      check(`${tag} hover shows the second photo`, hover.length === 2 && hover[0] === '0' && hover[1] === '1', hover.join());
      const oneImage = await page.evaluate((sel) => document.querySelectorAll(`${sel} .card__media img`).length, cardFor('510'));
      check(`${tag} product with one photo has no hover photo`, oneImage === 1, String(oneImage));
      await page.hover(`${cardFor('linen-maxi-skirt-with-front-pockets')} .card__media`, { force: true });
      await page.waitForTimeout(450);
      const keep = await page.evaluate((sel) => [...document.querySelectorAll(`${sel} .card__media img`)].map((i) => getComputedStyle(i).opacity + ':' + getComputedStyle(i).display), cardFor('linen-maxi-skirt-with-front-pockets'));
      check(`${tag} after picking a colour, hover keeps that photo`, keep[0] === '1:block' && (!keep[1] || keep[1].endsWith('none')), keep.join());
    }

    // Filters.
    if (width < 750) {
      await page.click('.mobile-facets__open-wrapper');
      await page.waitForTimeout(400);
      const drawer = await page.evaluate(() => ({
        open: document.querySelector('.mobile-facets__disclosure').hasAttribute('open'),
        locked: /overflow-hidden/.test(document.body.className),
        focusInside: Boolean(document.activeElement && document.activeElement.closest('.mobile-facets__disclosure')),
        inView: (() => { const r = document.querySelector('.mobile-facets__inner').getBoundingClientRect(); return r.left >= -1 && r.right <= window.innerWidth + 1; })(),
      }));
      check(`${tag} filter drawer opens, locks the page, takes focus`, drawer.open && drawer.locked && drawer.focusInside && drawer.inView, JSON.stringify(drawer));
      await shot(page, `filters-drawer-${width}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      const closed = await page.evaluate(() => ({
        open: document.querySelector('.mobile-facets__disclosure').hasAttribute('open'),
        locked: /overflow-hidden/.test(document.body.className),
        focus: document.activeElement && document.activeElement.classList.contains('mobile-facets__open-wrapper'),
      }));
      check(`${tag} Escape closes the drawer, focus back on its button`, !closed.open && !closed.locked && closed.focus, JSON.stringify(closed));

      // Apply "In stock" from the drawer.
      await page.click('.mobile-facets__open-wrapper');
      await page.waitForTimeout(400);
      await page.click('details[id^="Details-Mobile-filter.v.availability"] > summary');
      await page.waitForTimeout(350);
      await page.click('details[id^="Details-Mobile-filter.v.availability"] label:has(input[value="1"])');
      // facets.js waits for typing to settle before it fetches.
      await page.waitForTimeout(1200);
      await waitForGrid(page);
      await page.waitForTimeout(300);
    } else {
      const availability = 'details[id^="Details-filter.v.availability-"]';
      await page.click(`${availability} > summary`);
      await page.waitForTimeout(250);
      const panel = await page.evaluate((sel) => {
        const r = document.querySelector(`${sel} .facets__display`).getBoundingClientRect();
        return r.left >= 0 && r.right <= window.innerWidth && r.height > 0;
      }, availability);
      check(`${tag} filter panel opens inside the viewport`, panel);
      await shot(page, `filters-${width}`, { clip: { x: 0, y: 150, width, height: 520 } });
      await page.click(`${availability} label:has(input[value="1"])`);
      await page.waitForTimeout(1200);
      await waitForGrid(page);
      await page.waitForTimeout(300);
    }
    const filtered = await page.evaluate(() => ({
      url: location.search,
      count: (document.getElementById('ProductCount') || {}).textContent || (document.getElementById('ProductCountDesktop') || {}).textContent,
      soldOut: [...document.querySelectorAll('#product-grid .card__badge .badge')].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim()),
      pills: document.querySelectorAll('.active-facets__button:not(.active-facets__button-remove), facet-remove .active-facets__button').length,
    }));
    const inStock = buildCollection(catalog, 'skirts', new URLSearchParams('filter.v.availability=1')).products_count;
    check(`${tag} "In stock" filter: URL, count and grid update in place`, /filter\.v\.availability=1/.test(filtered.url) && (filtered.count || '').includes(String(inStock)) && !filtered.soldOut.includes(t('products.product.sold_out')), JSON.stringify(filtered));
    check(`${tag} active filter shown as a removable pill`, filtered.pills >= 1, String(filtered.pills));
    await page.closeAll();

    // Sort and empty result, straight from URLs.
    const sorted = await open(width, '/collections/skirts?sort_by=price-ascending');
    const prices = await sorted.evaluate(() => [...document.querySelectorAll('#product-grid .price')].slice(0, 8).map((p) => Number(((p.querySelector('.price__sale .price-item--last') && p.classList.contains('price--on-sale') ? p.querySelector('.price__sale .price-item--last') : p.querySelector('.price__regular .price-item--regular')).textContent).replace(/[^\d]/g, ''))));
    check(`${tag} sort price low to high`, prices.length === 8 && prices.every((p, i) => i === 0 || p >= prices[i - 1]), prices.join());
    const selected = await sorted.evaluate(() => [...document.querySelectorAll('select[name="sort_by"]')].map((s) => s.value));
    check(`${tag} sort select shows the active sort`, selected.length && selected.every((v) => v === 'price-ascending'), selected.join());
    await sorted.closeAll();

    const empty = await open(width, '/collections/skirts?filter.v.availability=1&filter.v.option.color=Green');
    const emptyState = await empty.evaluate(() => {
      const box = document.querySelector('.collection--empty');
      return { text: box && box.textContent.replace(/\s+/g, ' ').trim(), link: box && box.querySelector('a') && box.querySelector('a').getAttribute('href') };
    });
    check(`${tag} empty filter result explains and offers a way back`, emptyState.text && emptyState.text.includes(t('sections.collection_template.empty')) && emptyState.link === '/collections/skirts', JSON.stringify(emptyState));
    check(`${tag} no JS errors`, empty.errors.length === 0, empty.errors.join(' | '));
    await empty.closeAll();

    const last = await open(width, '/collections/skirts?page=10');
    const lastPage = await last.evaluate(() => ({
      cards: document.querySelectorAll('#product-grid > li').length,
      current: (document.querySelector('.pagination__item--current') || {}).textContent,
    }));
    check(`${tag} last page holds the remaining 8`, lastPage.cards === 8 && /10/.test(lastPage.current || ''), JSON.stringify(lastPage));
    await last.closeAll();

    // Long description folds behind "Read more".
    const hw = await open(width, '/collections/home-wear');
    const before = await hw.evaluate(() => {
      const d = document.querySelector('.collection-hero__description');
      const b = document.querySelector('.dsr-read-more__toggle');
      return { h: d.getBoundingClientRect().height, full: d.scrollHeight, hidden: b.hidden, expanded: b.getAttribute('aria-expanded'), controls: b.getAttribute('aria-controls') === d.id, label: b.textContent.trim() };
    });
    check(`${tag} long description collapsed behind "Read more"`, !before.hidden && before.h < before.full && before.expanded === 'false' && before.controls && before.label === t('dressar.collection.read_more'), JSON.stringify(before));
    const cardTop = await hw.evaluate(() => document.querySelector('#product-grid > li').getBoundingClientRect().top);
    check(`${tag} first products start within the first screen`, cardTop < 800 - 150, String(Math.round(cardTop)));
    await shot(hw, `banner-${width}`, { clip: { x: 0, y: 0, width, height: 800 } });
    await hw.click('.dsr-read-more__toggle');
    const after = await hw.evaluate(() => {
      const d = document.querySelector('.collection-hero__description');
      const b = document.querySelector('.dsr-read-more__toggle');
      return { h: Math.round(d.getBoundingClientRect().height), full: d.scrollHeight, expanded: b.getAttribute('aria-expanded'), label: b.textContent.trim() };
    });
    check(`${tag} "Read more" expands the full description`, after.expanded === 'true' && after.h >= after.full - 1 && after.label === t('dressar.collection.read_less'), JSON.stringify(after));
    check(`${tag} no JS errors`, hw.errors.length === 0, hw.errors.join(' | '));
    await hw.closeAll();

    const pants = await open(width, '/collections/pants');
    const short = await pants.evaluate(() => (document.querySelector('.dsr-read-more__toggle') || { hidden: true }).hidden);
    check(`${tag} short description: no "Read more"`, short === true);
    await pants.closeAll();
  }

  // Touch screens: no stuck hover photo.
  const tablet = await open(1024, '/collections/skirts', { touch: true });
  // A tap on a touch screen leaves the card in :hover; a pointer move reproduces that without navigating.
  const touchQuery = await tablet.evaluate(() => matchMedia('(hover: none)').matches);
  await tablet.hover(`${cardFor('long-linen-shirt')} .card__media`, { force: true });
  await tablet.waitForTimeout(450);
  const touchImgs = await tablet.evaluate((sel) => [...document.querySelectorAll(`${sel} .card__media img`)].map((i) => getComputedStyle(i).opacity), cardFor('long-linen-shirt'));
  check('[1024 touch] no second-photo swap on touch screens', touchQuery && touchImgs[0] === '1', `${touchQuery} ${touchImgs.join()}`);
  await tablet.closeAll();

  // Search results use the same card.
  for (const width of [390, 1280]) {
    const sp = await open(width, '/search?q=linen');
    const res = await sp.evaluate(() => {
      const items = [...document.querySelectorAll('.product-grid > li')];
      return {
        cards: items.length,
        ratios: items.map((li) => li.querySelector('.card__inner').getBoundingClientRect().height / li.querySelector('.card__inner').getBoundingClientRect().width),
        swatches: document.querySelectorAll('.product-grid .dsr-card-swatch').length,
        badges: [...document.querySelectorAll('.product-grid .card__badge .badge')].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim()),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    check(`[${width}] search results: same 3:4 card with swatches and % badges`, res.cards > 0 && res.ratios.every((r) => Math.abs(r - 4 / 3) < 0.01) && res.swatches > 0 && res.badges.some((b) => b.includes('%')) && !res.overflow, JSON.stringify({ ...res, ratios: undefined }));
    check(`[${width}] search results: no JS errors`, sp.errors.length === 0, sp.errors.join(' | '));
    await sp.closeAll();
  }

  // Empty collection.
  const none = await open(390, '/collections/empty');
  const noneText = await none.evaluate(() => (document.querySelector('.collection--empty') || {}).textContent || '');
  check('[390] empty collection says so', noneText.includes(t('sections.collection_template.empty')), noneText.trim());
  await none.closeAll();

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
