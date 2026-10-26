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
  .replace(/{%-?\s*if product\s*-?%}/, '').replace(/{%-?\s*endif\s*-?%}/, '')
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
      return { display: cs.display, visibility: cs.visibility, cls: bar.className, btn: bar.querySelector('button').textContent.trim() };
    });
    if (width < 990) {
      check(`${t} bar shown after scrolling past the form`, vis.display !== 'none' && vis.visibility === 'visible' && vis.cls.includes('is-visible'), JSON.stringify(vis));
      check(`${t} bar asks for a size before one is picked`, vis.btn === 'اختاري مقاسك', vis.btn);

      // Modal / drawer open -> bar must hide.
      await page.evaluate(() => document.body.classList.add('overflow-hidden'));
      await page.waitForTimeout(400);
      check(`${t} bar hidden while a dialog locks the page`, (await page.evaluate(() => getComputedStyle(document.querySelector('[data-dsr-sticky-atc]')).visibility)) === 'hidden');
      await page.evaluate(() => document.body.classList.remove('overflow-hidden'));

      // Pick a size -> label mirrors the real button.
      await page.evaluate(() => { const r = document.getElementById('s-l'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
      await page.waitForTimeout(100);
      check(`${t} after picking, bar mirrors the real button`, (await page.locator('[data-dsr-sticky-btn]').textContent()).trim() === 'أضيفي للسلة');

      // Sold-out variant -> aria-disabled, no add.
      await page.evaluate(() => { const b = document.querySelector('.product-form__submit'); b.disabled = true; b.querySelector('span').textContent = 'نفذت الكمية'; });
      await page.waitForTimeout(150);
      const sold = await page.evaluate(() => { const b = document.querySelector('[data-dsr-sticky-btn]'); return { label: b.textContent.trim(), aria: b.getAttribute('aria-disabled') }; });
      check(`${t} sold-out variant shown as disabled`, sold.label === 'نفذت الكمية' && sold.aria === 'true', JSON.stringify(sold));

      // WhatsApp button lifted above the bar.
      const waBottom = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.dsr-wa')).bottom));
      check(`${t} WhatsApp button lifted above the bar`, waBottom > 60, `bottom=${waBottom}px`);
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
  await browser.close();
  let failed = 0;
  for (const r of results) { if (!r.ok) failed++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`); }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
