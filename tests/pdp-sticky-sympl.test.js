// PDP harness: sticky add-to-cart bar and Sympl variant swap, built from the real
// theme files and run in Chromium at phone, tablet and desktop widths.
// usage: node tests/pdp-sticky-sympl.test.js [themeRoot]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = process.argv[2] || path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// Pre-render the few Liquid expressions dsr-product-boost uses.
let boost = read('sections/dsr-product-boost.liquid')
  .replace(/{%-?\s*comment\s*-?%}[\s\S]*?{%-?\s*endcomment\s*-?%}/g, '')
  .replace(/{%\s*schema\s*%}[\s\S]*?{%\s*endschema\s*%}/, '')
  // The bar's photo: the selected variant's (here a placeholder).
  .replace(/{%-?\s*liquid\s+assign sticky_media[\s\S]*?-?%}/, '')
  .replace(/{%-?\s*if sticky_media\s*-?%}[\s\S]*?{%-?\s*endif\s*-?%}/, '<img class="dsr-sticky-atc__thumb" data-dsr-sticky-thumb src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" width="48" height="64">')
  .replace(/{%-?\s*if product\s*-?%}/, '').replace(/{%-?\s*endif\s*-?%}/, '')
  .replace('{{ product.title | escape }}', 'Full-Length Evasé Skirt')
  .replace("{{- 'dressar.product.change' | t -}}", 'تغيير')
  .replace("{{- 'icon-cart-empty.svg' | inline_asset_content -}}", read('assets/icon-cart-empty.svg'))
  .replace("{{ 'products.product.add_to_cart' | t }}", 'أضيفي للسلة')
  .replace("{{ 'dressar.product.pick_size' | t | json }}", JSON.stringify('اختاري مقاسك'))
  .replace('{% style %}', '<style>').replace('{% endstyle %}', '</style>');
if (/{[{%]/.test(boost)) throw new Error('unrendered Liquid left in boost section: ' + boost.match(/{[{%].{0,40}/)[0]);

// The floating button's real CSS (its {% style %} block), as the storefront renders it.
const waStyle = '<style>' + read('snippets/whatsapp-button.liquid').split('{%- style -%}')[1].split('{%- endstyle -%}')[0] + '</style>';

const pdp = (priceText, symplPrice) => `
  <product-info id="MainProduct-main" data-section="main">
    <div class="product__title"><h1>Full-Length Evasé Skirt</h1></div>
    <div id="price-main" role="status"><div class="price"><div class="price__regular"><span class="price-item price-item--regular">${priceText}</span></div></div></div>
    <div class="dsr-sympl" id="Sympl-main" data-dsr-sympl-product><sympl-widget productprice="${symplPrice}" storecode="STR-983"></sympl-widget></div>
    <variant-selects>
      <fieldset><legend>Size</legend>
        <input type="radio" id="s-m" name="Size" value="M" checked><label for="s-m">M</label>
        <input type="radio" id="s-l" name="Size" value="L"><label for="s-l">L</label>
      </fieldset>
    </variant-selects>
    <product-form><form><input type="hidden" name="id" value="1">
      <button type="submit" name="add" class="product-form__submit button"><span>أضيفي للسلة</span></button>
    </form></product-form>
  </product-info>`;

const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
  <script>${read('assets/constants.js')}</script>
  <script>${read('assets/pubsub.js')}</script>
  </head><body>
  <div style="height:300px">gallery</div>
  ${pdp('549 ج.م', '549.0')}
  <div style="height:3000px">description, reviews…</div>
  <a class="dsr-wa dsr-wa--right">wa</a>
  ${waStyle}
  ${boost}
  <script>${read('assets/product-form.js')}</script>
  </body></html>`;

(async () => {
  const browser = await chromium.launch();
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok, detail });
  for (const width of [360, 390, 430, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 740 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.setContent(html, { waitUntil: 'load' });
    const t = `[${width}px]`;

    check(`${t} no duplicate injected bar`, (await page.locator('.dressar-sticky-atc').count()) === 0);
    check(`${t} exactly one sticky bar`, (await page.locator('[data-dsr-sticky-atc]').count()) === 1);

    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(400);
    const vis = await page.evaluate(() => {
      const bar = document.querySelector('[data-dsr-sticky-atc]');
      const cs = getComputedStyle(bar);
      return {
        display: cs.display,
        visibility: cs.visibility,
        cls: bar.className,
        btn: bar.querySelector('[data-dsr-sticky-btn]').textContent.trim(),
        thumb: Boolean(bar.querySelector('[data-dsr-sticky-thumb]')),
        title: (bar.querySelector('.dsr-sticky-atc__title') || {}).textContent,
        change: (bar.querySelector('[data-dsr-sticky-change]') || {}).textContent,
        meta: bar.querySelector('[data-dsr-sticky-meta]').textContent,
        height: bar.offsetHeight,
        padding: parseFloat(getComputedStyle(document.body).paddingBottom),
      };
    });
    if (width < 990) {
      check(`${t} bar shown after scrolling past the form`, vis.display !== 'none' && vis.visibility === 'visible' && vis.cls.includes('is-visible'), JSON.stringify(vis));
      check(`${t} bar asks for a size before one is picked`, vis.btn === 'اختاري مقاسك', vis.btn);
      check(`${t} bar shows the photo, the name and "Change"`, vis.thumb && vis.title === 'Full-Length Evasé Skirt' && vis.change.trim() === 'تغيير', JSON.stringify(vis));
      check(`${t} no size shown before one is picked`, vis.meta === '', vis.meta);
      check(`${t} the page keeps clear of the bar (bottom padding = its height)`, vis.height > 0 && Math.abs(vis.padding - vis.height) <= 1, `${vis.padding} ${vis.height}`);

      // "Change": back to the size choice.
      await page.evaluate(() => window.scrollTo(0, 2000));
      await page.click('[data-dsr-sticky-change]');
      await page.waitForTimeout(700);
      const back = await page.evaluate(() => { const r = document.querySelector('variant-selects').getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
      check(`${t} "Change" brings the size choice into view`, back);
      await page.evaluate(() => window.scrollTo(0, 2000));
      await page.waitForTimeout(400);

      // Modal / drawer open -> bar must hide.
      await page.evaluate(() => document.body.classList.add('overflow-hidden'));
      await page.waitForTimeout(400);
      check(`${t} bar hidden while a dialog locks the page`, (await page.evaluate(() => getComputedStyle(document.querySelector('[data-dsr-sticky-atc]')).visibility)) === 'hidden');
      await page.evaluate(() => document.body.classList.remove('overflow-hidden'));

      // Pick a size -> label mirrors the real button.
      await page.evaluate(() => { const r = document.getElementById('s-l'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
      await page.waitForTimeout(100);
      check(`${t} after picking, bar mirrors the real button`, (await page.locator('[data-dsr-sticky-btn]').textContent()).trim() === 'أضيفي للسلة');
      check(`${t} after picking, bar shows the chosen size`, (await page.locator('[data-dsr-sticky-meta]').textContent()) === 'L', await page.locator('[data-dsr-sticky-meta]').textContent());

      // Sold-out variant -> aria-disabled, no add.
      await page.evaluate(() => { const b = document.querySelector('.product-form__submit'); b.disabled = true; b.querySelector('span').textContent = 'نفذت الكمية'; });
      await page.waitForTimeout(150);
      const sold = await page.evaluate(() => { const b = document.querySelector('[data-dsr-sticky-btn]'); return { label: b.textContent.trim(), aria: b.getAttribute('aria-disabled') }; });
      check(`${t} sold-out variant shown as disabled`, sold.label === 'نفذت الكمية' && sold.aria === 'true', JSON.stringify(sold));

      // WhatsApp button lifted above the bar.
      const wa = await page.evaluate(() => ({
        bottom: parseFloat(getComputedStyle(document.querySelector('.dsr-wa')).bottom),
        bar: document.querySelector('[data-dsr-sticky-atc]').offsetHeight,
      }));
      check(`${t} WhatsApp button lifted above the bar`, wa.bottom > wa.bar, JSON.stringify(wa));
    } else {
      check(`${t} no sticky bar on desktop`, vis.display === 'none', JSON.stringify(vis));
    }

    // Sympl: simulate Dawn's variantChange with the re-rendered section.
    await page.evaluate(() => {
      const doc = new DOMParser().parseFromString('<div class="dsr-sympl" id="Sympl-main" data-dsr-sympl-product><sympl-widget productprice="599.0" storecode="STR-983"></sympl-widget></div>', 'text/html');
      publish(PUB_SUB_EVENTS.variantChange, { data: { sectionId: 'main', html: doc, variant: { id: 2 } } });
    });
    const sympl = await page.evaluate(() => [...document.querySelectorAll('sympl-widget')].map((w) => w.getAttribute('productprice')));
    check(`${t} Sympl follows the selected variant price`, sympl.length === 1 && sympl[0] === '599.0', JSON.stringify(sympl));
    check(`${t} no JS errors`, errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // Arriving from a link that names a variant: an ad link (?variant=) counts as
  // a size choice; a product card's colour swatch (?variant=&pick=color) does not.
  for (const [query, expected, what] of [
    ['?variant=1', 'أضيفي للسلة', 'variant link: size counts as chosen'],
    ['?variant=1&pick=color', 'اختاري مقاسك', 'colour-swatch link: size still asked for'],
  ]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 740 } });
    await page.route('**/*', (route) => route.fulfill({ body: html, contentType: 'text/html; charset=utf-8' }));
    await page.goto(`http://dressar.test/products/skirt${query}`);
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(400);
    const label = (await page.locator('[data-dsr-sticky-btn]').textContent()).trim();
    check(`[390px] ${what}`, label === expected, label);
    await page.close();
  }
  await browser.close();
  let failed = 0;
  for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`); }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
