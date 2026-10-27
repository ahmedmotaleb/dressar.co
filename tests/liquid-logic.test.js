// Logic tests for DRESSAR snippets with LiquidJS. Shopify-only tags and filters are
// stubbed, so this checks branching and maths, not Shopify's exact output.
// usage: node tests/liquid-logic.test.js [themeRoot]
const fs = require('fs');
const path = require('path');
const { Liquid } = require('liquidjs');
const root = process.argv[2] || path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const loadLocale = (file) => JSON.parse(read(file).replace(/^\s*\/\*[\s\S]*?\*\//, ''));
// Arabic is the storefront's main language; English is checked separately below.
const locales = { ar: loadLocale('locales/ar.json'), en: loadLocale('locales/en.default.json') };
let locale = locales.ar;

const engine = new Liquid({ root: [path.join(root, 'snippets')], extname: '.liquid' });
for (const tag of ['doc', 'stylesheet', 'comment']) {
  engine.registerTag(tag, { parse(token, remain) { this.tpls = []; let t; while ((t = remain.shift())) if (t.name === 'end' + tag) return; }, render() { return ''; } });
}
engine.registerFilter('t', (key, ...args) => {
  // LiquidJS hands named filter args over as [name, value] pairs.
  const vars = Object.fromEntries(args.filter(Array.isArray));
  let v = key.split('.').reduce((o, k) => (o || {})[k], locale);
  if (typeof v !== 'string') return `translation missing: ${key}`;
  return v.replace(/{{\s*(\w+)\s*}}/g, (_, k) => vars[k] ?? '');
});
engine.registerFilter('base64_encode', (s) => Buffer.from(String(s)).toString('base64'));
engine.registerFilter('escape', (s) => String(s).replace(/"/g, '&quot;'));

const cases = [];
const test = async (name, tpl, ctx, assert) => {
  // Shopify exposes `settings` globally, including inside rendered snippets.
  const out = (await engine.parseAndRender(tpl, ctx, { globals: { settings: ctx.settings || {}, product: ctx.product } })).replace(/\s+/g, ' ').trim();
  let ok = false; try { ok = assert(out); } catch (e) {}
  cases.push({ name, ok, out });
};

(async () => {
  const on = { sympl_enabled: true, sympl_store_code: 'STR-983' };
  // --- sympl-widget
  await test('cart total 1149 EGP -> plain decimal, isCart', "{% render 'sympl-widget', amount: 114900, is_cart: true %}", { settings: on },
    (o) => /productprice="1149(\.0)?"/.test(o) && o.includes('isCart="true"') && o.includes('storecode="STR-983"') && !o.includes('product='));
  await test('PDP: id + product attr, no isCart', "{% render 'sympl-widget', amount: 54900, sympl_product: p, id: 'main' %}", { settings: on, p: { title: 'Skirt' } },
    (o) => o.includes('id="Sympl-main"') && o.includes('data-dsr-sympl-product') && o.includes('product="') && !o.includes('isCart'));
  await test('disabled in settings -> nothing', "{% render 'sympl-widget', amount: 114900, is_cart: true %}", { settings: { sympl_enabled: false, sympl_store_code: 'STR-983' } }, (o) => o === '');
  await test('empty store code -> nothing', "{% render 'sympl-widget', amount: 114900 %}", { settings: { sympl_enabled: true, sympl_store_code: '' } }, (o) => o === '');
  await test('zero amount (empty cart) -> nothing', "{% render 'sympl-widget', amount: 0, is_cart: true %}", { settings: on }, (o) => o === '');

  // --- dsr-model-size
  await test('model size set -> sentence with size', "{% render 'dsr-model-size', product: p %}", { p: { metafields: { custom: { model_size: { value: 'XL' } } } } },
    (o) => o.includes('XL') && o.includes('<p class="product__text dsr-model-size">') && !o.includes('missing'));
  await test('model size empty -> nothing', "{% render 'dsr-model-size', product: p %}", { p: { metafields: { custom: {} } } }, (o) => o === '');

  // --- card badge (snippets/dsr-card-badge.liquid, used for both of Dawn's badge copies)
  const tpl = "{% render 'dsr-card-badge', card_product: card_product, id: 'Badge-s-1' %}";
  const card = read('snippets/card-product.liquid');
  cases.push({ name: 'card-product renders both badge copies with the shared snippet', ok: (card.match(/render 'dsr-card-badge'/g) || []).length === 2 && !card.includes("'products.product.on_sale' | t"), out: '' });
  await test('1149 -> 549 shows 52% (floor, never rounds up)', tpl, { card_product: { compare_at_price: 114900, price: 54900, id: 1, available: true }, settings: { sale_badge_color_scheme: 'scheme-4' }, section_id: 's' },
    (o) => o.includes('خصم 52%') && o.includes('class="badge badge--bottom-left color-scheme-4"'));
  await test('tiny markdown (<1%) falls back to plain sale label', tpl, { card_product: { compare_at_price: 50000, price: 49900, id: 1, available: true }, settings: { sale_badge_color_scheme: 'scheme-4' }, section_id: 's' },
    (o) => o.includes('>خصم<') && !o.includes('%'));
  await test('badge never reads the page-level product', tpl, { product: { compare_at_price: 999900, price: 100 }, card_product: { compare_at_price: 49900, price: 39900, id: 1, available: true }, settings: { sale_badge_color_scheme: 'scheme-4' }, section_id: 's' },
    (o) => o.includes('خصم 20%'));
  await test('sold out wins over sale', tpl, { card_product: { compare_at_price: 49900, price: 39900, id: 1, available: false }, settings: { sale_badge_color_scheme: 'scheme-4', sold_out_badge_color_scheme: 'scheme-3' } },
    (o) => o.includes('color-scheme-3') && o.includes('نفذت الكمية') && !o.includes('%'));
  await test('no markdown, in stock -> no badge', tpl, { card_product: { compare_at_price: null, price: 39900, id: 1, available: true }, settings: {} }, (o) => o === '');

  locale = locales.en;
  await test('English storefront: badge reads "52% off"', tpl, { card_product: { compare_at_price: 114900, price: 54900, id: 1, available: true }, settings: { sale_badge_color_scheme: 'scheme-4' }, section_id: 's' },
    (o) => o.includes('>52% off<'));
  await test('English storefront: model size sentence', "{% render 'dsr-model-size', product: p %}", { p: { metafields: { custom: { model_size: { value: 'L' } } } } },
    (o) => o.includes('The model is wearing size L'));
  locale = locales.ar;

  let failed = 0;
  for (const c of cases) { if (!c.ok) failed++; console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : '\n      got: ' + c.out}`); }
  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  process.exit(failed ? 1 : 0);
})();
