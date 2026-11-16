// Editorial mosaic (docs/stages/editorial-mosaic.md): the home page's
// Collection list on the real index template, Arabic and English, at 360,
// 390, 430, 768, 990 and 1440px.
// usage: node tests/editorial-mosaic.test.js [themeRoot] [--shots <dir>]
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
const SECTION = 'collection_list_DJAc8Q';
const WIDTHS = [360, 390, 430, 768, 990, 1440];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

const template = readJson(path.join(root, 'templates/index.json'));
const sectionJson = template.sections[SECTION];
const handles = sectionJson.block_order.map((id) => sectionJson.blocks[id].settings.collection);

const patchSection = (fn) => (name, t) => {
  if (name !== 'index') return t;
  const copy = JSON.parse(JSON.stringify(t));
  fn(copy.sections[SECTION]);
  return copy;
};

async function main() {
  // ---------- Schema, statically ----------
  const src = fs.readFileSync(path.join(root, 'sections/collection-list.liquid'), 'utf8');
  const schema = JSON.parse(/{% schema %}([\s\S]*){% endschema %}/.exec(src)[1]);
  const ids = schema.settings.filter((s) => s.id).map((s) => s.id);
  check('schema: existing setting IDs kept', ['title', 'heading_size', 'image_ratio', 'columns_desktop', 'color_scheme', 'show_view_all', 'columns_mobile', 'swipe_on_mobile', 'padding_top', 'padding_bottom'].every((id) => ids.includes(id)));
  check('schema: mosaic settings (layout, mobile/desktop layout, gap, radius, title position, heading)', ['layout', 'mobile_layout', 'desktop_layout', 'mosaic_gap', 'mosaic_radius', 'card_title_position', 'show_heading'].every((id) => ids.includes(id)));
  const blockIds = schema.blocks[0].settings.map((s) => s.id);
  check('schema: block keeps "collection", adds featured, image override and image position', ['collection', 'featured', 'image', 'image_position'].every((id) => blockIds.includes(id)));
  check('code: no collection, image or copy of the store in the section', !/skirts|home-wear|تسوّقي|shop_images/.test(src));

  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const sizes = {};
  catalog.products.forEach((p) => p.media.forEach((m, i) => (sizes[`${p.handle}-${i}.jpg`] = m)));
  Object.entries(catalog.collections).forEach(([h, c]) => c.image && (sizes[`collection-${h}.jpg`] = c.image));
  const browser = await chromium.launch();

  const open = async ({ locale, width, templatePatch = null }) => {
    const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale, templatePatch });
    const pages = async (url) => {
      if (url.pathname !== '/') return null;
      const globals = harness.globals({ path: '/', pageType: 'index', overrides: { __collections: (h) => buildCollection(catalog, h) } });
      return harness.renderLayout(globals, await harness.renderTemplate('index', globals));
    };
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: shotsDir ? 2 : 1 });
    const page = await context.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    await page.addInitScript(() => {
      window.__shift = 0;
      new PerformanceObserver((l) => l.getEntries().forEach((e) => {
        if (!e.hadRecentInput && (e.sources || []).some((s) => s.node && s.node.closest && s.node.closest('.dsr-mosaic'))) window.__shift += e.value;
      })).observe({ type: 'layout-shift', buffered: true });
    });
    await routeTheme(page, { root, fontsDir, harness, globalsFor: () => harness.globals(), pages, imageSize: (n) => sizes[n] });
    await page.goto('http://dressar.test/');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      const m = document.querySelector('.dsr-mosaic');
      if (!m) return;
      m.scrollIntoView({ block: 'start' });
      await new Promise((r) => setTimeout(r, 400));
      m.querySelectorAll('img').forEach((i) => ((i.dataset.loading = i.getAttribute('loading')), (i.loading = 'eager')));
      await Promise.all([...m.querySelectorAll('img')].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))));
    });
    await page.waitForTimeout(300);
    return page;
  };

  const measure = (page) =>
    page.evaluate(() => {
      const m = document.querySelector('.dsr-mosaic');
      const r = (el) => el.getBoundingClientRect();
      const items = [...m.querySelectorAll(':scope > .dsr-mosaic__item')].map((li) => {
        const a = li.querySelector('a');
        const img = li.querySelector('img');
        const media = li.querySelector('.dsr-mosaic__media');
        const title = li.querySelector('.dsr-mosaic__title');
        const box = r(li);
        return {
          href: a.getAttribute('href'),
          title: title.textContent.trim(),
          featured: li.classList.contains('dsr-mosaic__item--featured'),
          rect: { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height },
          cardFills: Math.abs(r(a).height - box.height) < 1 && Math.abs(r(a).width - box.width) < 1,
          radius: getComputedStyle(a).borderTopLeftRadius,
          fit: img ? getComputedStyle(img).objectFit : null,
          imgFills: img ? Math.abs(r(img).width - r(media).width) < 1 && Math.abs(r(img).height - r(media).height) < 1 : true,
          imgLazy: img ? img.dataset.loading === 'lazy' && Boolean(img.getAttribute('srcset')) && Boolean(img.getAttribute('sizes')) : true,
          titleSize: getComputedStyle(title).fontSize,
          titleWeight: getComputedStyle(title).fontWeight,
          titleFamily: getComputedStyle(title).fontFamily,
          titleFits: title.scrollWidth <= title.clientWidth + 1 || getComputedStyle(title).textOverflow === 'ellipsis',
          arrow: Boolean(li.querySelector('svg.dsr-mosaic__arrow[aria-hidden="true"]')),
        };
      });
      const gap = getComputedStyle(m).rowGap;
      const section = m.closest('.shopify-section');
      return {
        dir: document.documentElement.dir,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        gap,
        columns: getComputedStyle(m).gridTemplateColumns.split(' ').length,
        height: r(m).height,
        width: r(m).width - parseFloat(getComputedStyle(m).paddingLeft) - parseFloat(getComputedStyle(m).paddingRight),
        left: r(m).left + parseFloat(getComputedStyle(m).paddingLeft),
        right: r(m).right - parseFloat(getComputedStyle(m).paddingRight),
        sectionHeight: r(section).height,
        heading: Boolean(section.querySelector('.collection-list-title')),
        shift: window.__shift,
        items,
      };
    });

  for (const locale of ['ar', 'en.default']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    for (const width of WIDTHS) {
      const tag = `${L} [${width}]`;
      const page = await open({ locale, width });
      const m = await measure(page);
      const it = m.items;
      const mobile = width < 750;
      const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;

      check(`${tag} every collection once, opening its own page`, it.length === handles.length && JSON.stringify(it.map((x) => x.href)) === JSON.stringify(handles.map((h) => `/collections/${h}`)), JSON.stringify(it.map((x) => x.href)));
      check(`${tag} the first collection is featured`, it[0].featured && it.filter((x) => x.featured).length === 1);
      check(`${tag} whole card is the link; 6px corners`, it.every((x) => x.cardFills && x.radius === '6px'));
      check(`${tag} images cover, fill their frame, load lazily at fitting sizes`, it.every((x) => x.fit === 'cover' && x.imgFills && x.imgLazy), JSON.stringify(it.map((x) => [x.fit, x.imgFills, x.imgLazy])));
      check(`${tag} titles ${mobile ? '14px' : '16px'} medium, with an arrow`, it.every((x) => x.titleSize === (mobile ? '14px' : '16px') && x.titleWeight === '500' && x.arrow && x.titleFits));
      if (rtl) check(`${tag} Arabic titles in Cairo`, it.every((x) => /DSR Cairo/.test(x.titleFamily)), it[0].titleFamily);
      check(`${tag} 8px gaps`, m.gap === '8px', m.gap);
      check(`${tag} no sideways scrolling`, !m.overflow);
      check(`${tag} side gutters of at least 16px`, it.every((x) => x.rect.left >= 15.5 && x.rect.right <= width - 15.5), JSON.stringify(it.map((x) => [Math.round(x.rect.left), Math.round(x.rect.right)])));
      check(`${tag} nothing moves while images load`, m.shift < 0.001, String(m.shift));
      // Reading direction: the featured card starts on the reading side.
      const featuredOnStart = rtl ? near(it[0].rect.right, m.right) : near(it[0].rect.left, m.left);
      check(`${tag} featured card on the ${rtl ? 'right' : 'left'} (reading side)`, featuredOnStart, JSON.stringify([it[0].rect.left, it[0].rect.right, m.left, m.right]));
      if (mobile) {
        const [f, a, b, ...rest] = it;
        check(`${tag} featured: half the width, two rows tall`, near(f.rect.width, (m.width - 8) / 2) && near(f.rect.height, a.rect.height + b.rect.height + 8), JSON.stringify([f.rect.width, f.rect.height, a.rect.height, b.rect.height]));
        check(`${tag} the next two stacked beside it`, near(a.rect.top, f.rect.top) && near(b.rect.top, a.rect.bottom + 8) && near(a.rect.left, b.rect.left) && !near(a.rect.left, f.rect.left, 20));
        check(`${tag} square small cards`, near(a.rect.height, a.rect.width, 2), `${a.rect.width}x${a.rect.height}`);
        const rows = rest.length === 3 ? [[rest[0], rest[1]], [rest[2]]] : [];
        check(`${tag} the rest in balanced rows (pair, then a full-width card)`, rows.length === 2 && near(rows[0][0].rect.top, rows[0][1].rect.top) && near(rows[0][0].rect.height, rows[0][1].rect.height) && near(rows[1][0].rect.width, m.width), JSON.stringify(rest.map((x) => [Math.round(x.rect.width), Math.round(x.rect.height)])));
        check(`${tag} compact: the grid at most 2.1 screen widths tall`, m.height <= m.width * 2.1, `${Math.round(m.height)} for ${Math.round(m.width)}`);
      } else {
        const [f, a, b, c, d, e] = it;
        const col = (m.width - 3 * 8) / 4;
        check(`${tag} 4 columns: featured 2×2`, m.columns === 4 && near(f.rect.width, 2 * col + 8) && near(f.rect.height, 2 * col + 8, 2), JSON.stringify([f.rect.width, f.rect.height, col]));
        check(`${tag} then a tall card and two squares`, near(a.rect.height, f.rect.height) && near(b.rect.width, col) && near(b.rect.height, col, 2) && near(c.rect.top, b.rect.bottom + 8));
        check(`${tag} the rest as a wide pair`, near(d.rect.width, 2 * col + 8) && near(e.rect.width, 2 * col + 8) && near(d.rect.top, e.rect.top));
      }
      check(`${tag} no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      if (shotsDir) {
        await page.evaluate(() => {
          const s = document.querySelector('.dsr-mosaic').closest('.shopify-section');
          window.scrollTo(0, s.getBoundingClientRect().top + scrollY - (window.innerWidth < 750 ? 110 : 60));
        });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(shotsDir, `mosaic-${rtl ? 'ar' : 'en'}-${width}.png`) });
      }
      await page.context().close();
    }

    // Settings: a chosen featured collection leads; even layouts; title below; heading hidden; classic grid.
    {
      const page = await open({
        locale,
        width: 390,
        templatePatch: patchSection((s) => {
          s.blocks[s.block_order[3]].settings.featured = true;
          s.settings.show_heading = false;
          s.settings.card_title_position = 'below';
        }),
      });
      const m = await measure(page);
      check(`${L} "Feature this collection": that one leads, the others keep their order`, JSON.stringify(m.items.map((x) => x.href)) === JSON.stringify([handles[3], handles[0], handles[1], handles[2], handles[4], handles[5]].map((h) => `/collections/${h}`)), JSON.stringify(m.items.map((x) => x.href)));
      check(`${L} heading can be hidden`, !m.heading);
      check(`${L} title below the image`, await page.evaluate(() => {
        const li = document.querySelector('.dsr-mosaic__item:nth-child(2)');
        return li.querySelector('.dsr-mosaic__label').getBoundingClientRect().top >= li.querySelector('.dsr-mosaic__media').getBoundingClientRect().bottom - 1;
      }));
      await page.context().close();
    }
    {
      const page = await open({ locale, width: 390, templatePatch: patchSection((s) => (s.settings.mobile_layout = 'even')) });
      const m = await measure(page);
      check(`${L} even mobile layout: two equal columns`, m.items.slice(0, 4).every((x) => Math.abs(x.rect.width - m.items[0].rect.width) < 1 && Math.abs(x.rect.height - m.items[0].rect.height) < 1));
      await page.context().close();
    }
    {
      const page = await open({ locale, width: 390, templatePatch: patchSection((s) => (s.settings.layout = 'classic')) });
      const classic = await page.evaluate(() => ({ mosaic: Boolean(document.querySelector('.dsr-mosaic')), dawn: document.querySelectorAll('.collection-list .card-wrapper, .collection-list .card').length }));
      check(`${L} "Classic grid" brings back Dawn's collection list`, !classic.mosaic && classic.dawn > 0, JSON.stringify(classic));
      await page.context().close();
    }
  }
  await browser.close();

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok || !r.detail ? '' : `  -> ${r.detail}`}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
