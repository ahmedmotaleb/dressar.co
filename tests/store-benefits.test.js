// Store benefits (docs/stages/store-benefits.md): the "Icons with text" block
// on the real home template, Arabic and English, at 360, 390, 430 and 1440px.
// usage: node tests/store-benefits.test.js [themeRoot] [--shots <dir>]
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
const SECTION = '1783546806decc8eee';
const WIDTHS = [360, 390, 430, 1440];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

const template = readJson(path.join(root, 'templates/index.json'));
const blockId = Object.keys(template.sections[SECTION].blocks)[0];
const merchant = template.sections[SECTION].blocks[blockId].settings;
const merchantTitles = [1, 2, 3, 4, 5, 6].filter((i) => merchant[`item_${i}_enabled`]).map((i) => merchant[`title_${i}`]);

// Nested "Benefit" blocks, as the theme editor saves them.
const withCards = (cards) => (name, t) => {
  if (name !== 'index') return t;
  const copy = JSON.parse(JSON.stringify(t));
  const b = copy.sections[SECTION].blocks[blockId];
  b.blocks = Object.fromEntries(cards.map((c, i) => [`card${i}`, { type: '_dsr-benefit', settings: c }]));
  b.block_order = cards.map((_, i) => `card${i}`);
  return copy;
};

async function main() {
  // ---------- Schema, statically ----------
  const src = fs.readFileSync(path.join(root, 'blocks/ai_gen_block_c719b9a.liquid'), 'utf8');
  const schema = JSON.parse(/{% schema %}([\s\S]*){% endschema %}/.exec(src)[1]);
  const ids = schema.settings.filter((s) => s.id).map((s) => s.id);
  const kept = ['desktop_width_percent', 'columns_desktop', 'columns_mobile', 'layout', 'alignment', 'stack_on_mobile', 'spacing', 'section_padding', 'item_padding', 'item_background_color', 'item_border_radius', 'icon_text_gap', 'icon_size', 'icon_color', 'icon_background_color', 'icon_border_radius', 'title_size', 'title_weight', 'title_color', 'title_spacing', 'description_size', 'description_color'];
  for (let i = 1; i <= 6; i++) kept.push(`item_${i}_enabled`, `icon_${i}`, `title_${i}`, `description_${i}`);
  check('schema: every existing setting ID kept', kept.every((id) => ids.includes(id)), kept.filter((id) => !ids.includes(id)).join());
  const byId = Object.fromEntries(schema.settings.filter((s) => s.id).map((s) => [s.id, s]));
  check(
    'schema: mobile card settings with the brief\'s defaults',
    byId.mobile_cards.default === true && /F7F5F2/i.test(byId.mobile_section_background.default) && /FFFFFF/i.test(byId.mobile_card_background.default) &&
      byId.mobile_card_radius.default === 10 && byId.mobile_gap.default === 10 && byId.mobile_section_padding.default === 16 && byId.mobile_card_padding.default === 12
  );
  check('schema: icons truck, wallet, inspection, exchange offered', ['shipping', 'wallet', 'inspection', 'exchange'].every((v) => byId.icon_1.options.some((o) => o.value === v)));
  check('schema: nested Benefit blocks (number and order of cards)', JSON.stringify(schema.blocks) === JSON.stringify([{ type: '_dsr-benefit' }]));
  check('schema: the preset holds the four demo cards', schema.presets[0].blocks.length === 4 && schema.presets[0].blocks.map((b) => b.settings.icon).join() === 'shipping,wallet,inspection,exchange');
  check('block code: no store copy in the Liquid', !/[؀-ۿ]/.test(src.slice(0, src.indexOf('{% schema %}'))));

  const browser = await chromium.launch();
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const sizes = {};
  catalog.products.forEach((p) => p.media.forEach((m, i) => (sizes[`${p.handle}-${i}.jpg`] = m)));
  Object.entries(catalog.collections).forEach(([h, c]) => c.image && (sizes[`collection-${h}.jpg`] = c.image));

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
    await routeTheme(page, { root, fontsDir, harness, globalsFor: () => harness.globals(), pages, imageSize: (n) => sizes[n] });
    await page.goto('http://dressar.test/');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    return page;
  };

  const measure = (page) =>
    page.evaluate((SECTION) => {
      const section = document.getElementById(`shopify-section-template--1__${SECTION}`);
      const box = section.querySelector('[class^="ai-icon-text-container-"]');
      const grid = box.querySelector('[class^="ai-icon-text-grid-"]');
      const cs = (el) => getComputedStyle(el);
      const r = (el) => el.getBoundingClientRect();
      const cards = [...grid.querySelectorAll('.dsr-benefit')].map((c) => {
        const icon = c.querySelector('.dsr-benefit__icon');
        const title = c.querySelector('.dsr-benefit__title');
        const text = c.querySelector('.dsr-benefit__text');
        return {
          rect: r(c).toJSON(),
          bg: cs(c).backgroundColor,
          radius: cs(c).borderTopLeftRadius,
          padding: cs(c).paddingTop,
          shadow: cs(c).boxShadow,
          icon: [r(icon).width, r(icon).height, r(icon.querySelector('svg')).width],
          iconCentre: Math.abs(r(icon).left + r(icon).width / 2 - (r(c).left + r(c).width / 2)),
          iconToTitle: title ? r(title).top - r(icon).bottom : null,
          titleToText: title && text ? r(text).top - r(title).bottom : null,
          title: title && { text: title.textContent.trim(), size: cs(title).fontSize, weight: cs(title).fontWeight, family: cs(title).fontFamily },
          text: text && { size: cs(text).fontSize, weight: cs(text).fontWeight, bidi: cs(text).unicodeBidi },
          fits: [c, title, text].filter(Boolean).every((el) => el.scrollWidth <= el.clientWidth + 1) && r(c).right <= window.innerWidth && r(c).left >= 0,
        };
      });
      // The nearest content above and below (the neighbouring sections' text or images).
      const visibleEdge = (sec, edge) => {
        const els = [...sec.querySelectorAll('h1,h2,h3,p,img,a,li,button,.slider-counter,.card,.multicolumn-card,[class*="jdgm"]')].filter((e) => r(e).height > 0 && cs(e).visibility !== 'hidden');
        if (!els.length) return null;
        return edge === 'bottom' ? Math.max(...els.map((e) => r(e).bottom)) : Math.min(...els.map((e) => r(e).top));
      };
      let prev = section.previousElementSibling;
      while (prev && !(r(prev).height > 0)) prev = prev.previousElementSibling;
      return {
        dir: document.documentElement.dir,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        sectionBg: cs(box).backgroundColor,
        sectionPadding: cs(box).paddingTop,
        boxRect: r(box).toJSON(),
        gap: cs(grid).rowGap,
        columns: cs(grid).gridTemplateColumns.split(' ').length,
        cards,
        // The neighbour's content box: its padded wrapper's bottom less its bottom padding.
        above: prev
          ? (() => {
              const pad = prev.querySelector('[class*="-padding"]') || prev;
              return r(box).top - (r(prev).bottom - parseFloat(cs(pad).paddingBottom));
            })()
          : null,
        legacyItems: grid.querySelectorAll(':scope > .dsr-benefit:not([data-block-id])').length,
      };
    }, SECTION);

  for (const locale of ['ar', 'en.default']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    for (const width of WIDTHS) {
      const tag = `${L} [${width}]`;
      const page = await open({ locale, width });
      const m = await measure(page);
      const mobile = width < 750;
      check(`${tag} the merchant's cards, in order`, JSON.stringify(m.cards.map((c) => c.title && c.title.text)) === JSON.stringify(merchantTitles), JSON.stringify(m.cards.map((c) => c.title && c.title.text)));
      check(`${tag} text fits its card`, m.cards.every((c) => c.fits));
      check(`${tag} each line keeps its own direction (punctuation in place)`, m.cards.every((c) => c.text.bidi === 'plaintext'));
      check(`${tag} no sideways scrolling`, !m.overflow);
      if (mobile) {
        check(`${tag} section background #F7F5F2, 16px padding`, m.sectionBg === 'rgb(247, 245, 242)' && m.sectionPadding === '16px', `${m.sectionBg} ${m.sectionPadding}`);
        check(`${tag} 2 columns, 10px gap`, m.columns === 2 && m.gap === '10px', `${m.columns} ${m.gap}`);
        const rows = [m.cards.slice(0, 2), m.cards.slice(2, 4)];
        check(`${tag} two rows of two`, m.cards.length === 4 && rows.every((row) => Math.abs(row[0].rect.top - row[1].rect.top) < 1));
        check(`${tag} equal heights in each row`, rows.every((row) => Math.abs(row[0].rect.height - row[1].rect.height) < 1), JSON.stringify(m.cards.map((c) => Math.round(c.rect.height))));
        check(`${tag} white cards, 10px corners, 12px padding, no shadow`, m.cards.every((c) => c.bg === 'rgb(255, 255, 255)' && c.radius === '10px' && c.padding === '12px' && c.shadow === 'none'));
        check(`${tag} 24px icon, centred`, m.cards.every((c) => c.icon.every((v) => v === 24) && c.iconCentre < 1), JSON.stringify(m.cards.map((c) => [c.icon, c.iconCentre])));
        check(`${tag} title 13px semibold, description 11px regular`, m.cards.every((c) => c.title.size === '13px' && c.title.weight === '600' && c.text.size === '11px' && c.text.weight === '400'));
        check(`${tag} icon to title 8px, title to description 5px`, m.cards.every((c) => Math.abs(c.iconToTitle - 8) < 0.6 && Math.abs(c.titleToText - 5) < 0.6), JSON.stringify(m.cards.map((c) => [c.iconToTitle, c.titleToText])));
        const tallest = Math.max(...m.cards.map((c) => c.rect.height));
        check(`${tag} compact: cards at most 116px tall, section at most 280px`, tallest <= 116 && m.boxRect.height <= 280, `${tallest} ${m.boxRect.height}`);
        check(`${tag} about 24px from the section above`, m.above != null && Math.abs(m.above - 24) <= 4, String(m.above));
        if (rtl) check(`${tag} Arabic text in Cairo`, m.cards.every((c) => /DSR Cairo/.test(c.title.family)), m.cards[0].title.family);
      } else {
        // Desktop: as before (the block's own settings).
        check(`${tag} desktop unchanged: ${merchant.columns_desktop} columns, ${merchant.spacing}px gap, ${merchant.section_padding}px padding, no background`, m.columns === merchant.columns_desktop && m.gap === `${merchant.spacing}px` && m.sectionPadding === `${merchant.section_padding}px` && m.sectionBg === 'rgba(0, 0, 0, 0)', JSON.stringify([m.columns, m.gap, m.sectionPadding, m.sectionBg]));
        check(`${tag} desktop unchanged: ${merchant.icon_size}px icons, ${merchant.title_size}px titles`, m.cards.every((c) => c.icon[0] === merchant.icon_size && c.title.size === `${merchant.title_size}px` && c.text.size === `${merchant.description_size}px`));
      }
      check(`${tag} no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      if (shotsDir) {
        await page.evaluate((SECTION) => {
          const s = document.getElementById(`shopify-section-template--1__${SECTION}`);
          window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 160);
        }, SECTION);
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(shotsDir, `benefits-${rtl ? 'ar' : 'en'}-${width}.png`) });
      }
      await page.context().close();
    }

    // Nested Benefit blocks: they replace the item slots, in their own order and number.
    {
      const cards = [
        { icon: 'exchange', title: 'Card A', description: 'First' },
        { icon: 'shipping', title: 'Card B', description: 'Second' },
        { icon: 'wallet', title: 'Card C', description: 'Third' },
      ];
      const page = await open({ locale, width: 390, templatePatch: withCards(cards) });
      const m = await measure(page);
      check(`${L} Benefit blocks: shown in their order, item slots hidden`, JSON.stringify(m.cards.map((c) => c.title.text)) === '["Card A","Card B","Card C"]' && m.legacyItems === 0, JSON.stringify([m.cards.map((c) => c.title.text), m.legacyItems]));
      check(`${L} Benefit blocks: three cards, still two columns, first row equal`, m.columns === 2 && Math.abs(m.cards[0].rect.height - m.cards[1].rect.height) < 1);
      check(`${L} Benefit blocks: the chosen icons`, await page.evaluate(() => [...document.querySelectorAll('.dsr-benefit__icon svg')].length === 3));
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
