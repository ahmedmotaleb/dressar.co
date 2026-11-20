// Product description layout (snippets/dsr-product-description.liquid,
// docs/stages/arabic-mobile.md): readable typography, the merchant's own
// paragraphs grouped (introduction, details, size guidance), the WhatsApp line
// as the compact size-help button, and anything that isn't plain paragraphs
// shown exactly as written. Arabic and English, 320 to 1440px.
// usage: node tests/pdp-description.test.js [themeRoot]
'use strict';

const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const WIDTHS = [320, 375, 390, 430, 768, 1440];
const NUMBER = '01020676173';

// The store's current description pattern (four paragraphs), in each language.
const STORE = {
  ar: [
    'جيبة أوف وايت بطبقات من قطن أنجليز بيتنفس، بتطريز رقيق وحافة سكالوب.',
    'وسط أستك وقصّة انسيابية للوك محتشم كلاسيك، وبتليق على التوبات السوداء والكحلي والبيج.',
    'القياسات مناسبة لطول 155–170 سم.',
    `مش متأكدة من مقاسك؟ كلّمينا واتساب <strong>${NUMBER}</strong>.`,
  ],
  'en.default': [
    'Off-white tiered maxi skirt in breathable cotton eyelet, with delicate embroidery and a scalloped hem.',
    'An elastic waist and flowy silhouette for a timeless modest look — fresh with black, navy or beige tops.',
    'Sized for heights 155–170 cm.',
    `Not sure about your size? WhatsApp us on <strong>${NUMBER}</strong>.`,
  ],
};
const STRUCTURED = 'linen-suit';
const TABLE = 'linen-maxi-skirt-with-front-pockets';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });
const strip = (html) => html.replace(/<[^>]+>/g, '').trim();

async function main() {
  const fs = require('fs');
  const src = fs.readFileSync(path.join(root, 'sections/main-product.liquid'), 'utf8');
  const schema = JSON.parse(/{% schema %}([\s\S]*){% endschema %}/.exec(src)[1]);
  const block = schema.blocks.find((b) => b.type === 'description');
  const ids = (block.settings || []).map((s) => `${s.id}=${s.default}`);
  check('description block: "Structured layout" and "WhatsApp line as a button" settings, both on by default', ids.includes('dsr_structured=true') && ids.includes('dsr_whatsapp_button=true'), ids.join());
  const snippet = fs.readFileSync(path.join(root, 'snippets/dsr-product-description.liquid'), 'utf8');
  check('snippet: falls back to the description exactly as written', snippet.includes('{{ product.description }}'));

  const browser = await chromium.launch();
  for (const locale of ['ar', 'en.default']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    const strings = readJson(path.join(root, 'locales', `${locale}.json`));
    const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
    catalog.products.find((p) => p.handle === STRUCTURED).description = STORE[locale].map((t) => `<p>${t}</p>`).join('');
    const tableOriginal = catalog.products.find((p) => p.handle === TABLE).description;

    for (const [label, patch] of [['default', null], ['settings off', (name, t) => { if (name === 'product') { const b = t.sections.main.blocks.description; b.settings = { dsr_structured: false, dsr_whatsapp_button: false }; } return t; }]]) {
      const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale, templatePatch: patch });
      for (const width of label === 'default' ? WIDTHS : [390]) {
        const tag = `${L} [${width}]${label === 'default' ? '' : ' [settings off]'}`;
        const sf = storefront({ root, harness, catalog });
        const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 750, hasTouch: width < 750 });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await routeTheme(page, { root, fontsDir, harness, imageSize: sf.imageSize, globalsFor: () => sf.globalsFor(), cartSection: sf.cartSection, cartJson: sf.cartJson, pages: (url) => sf.pages(url) });

        await page.goto(`http://dressar.test/products/${STRUCTURED}`);
        await page.waitForTimeout(500);
        const m = await page.evaluate((NUMBER) => {
          const d = document.querySelector('.product__description .dsr-desc');
          if (!d) return null;
          const ps = [...d.querySelectorAll('p')].filter((p) => !p.classList.contains('dsr-desc__label'));
          const p0 = ps[0];
          const cs = getComputedStyle(p0);
          const range = document.createRange();
          range.selectNodeContents(p0);
          const tr = range.getBoundingClientRect();
          const box = p0.getBoundingClientRect();
          const help = d.querySelector('.dsr-desc__help a');
          const gaps = ps.slice(0, -1).map((p, i) => Math.round(ps[i + 1].getBoundingClientRect().top - p.getBoundingClientRect().bottom));
          const textOnly = [...d.childNodes].filter((n) => !(n.classList && n.classList.contains('dsr-desc__help'))).map((n) => n.textContent).join(' ');
          return {
            structured: d.classList.contains('dsr-desc--structured'),
            intro: d.querySelector('.dsr-desc__intro') && d.querySelector('.dsr-desc__intro').textContent.trim(),
            body: d.querySelector('.dsr-desc__body') && d.querySelector('.dsr-desc__body').textContent.trim(),
            fitLabel: d.querySelector('.dsr-desc__label') && d.querySelector('.dsr-desc__label').textContent.trim(),
            fit: d.querySelector('.dsr-desc__fit-text') && d.querySelector('.dsr-desc__fit-text').textContent.trim(),
            numberInText: textOnly.includes(NUMBER),
            allText: d.textContent.replace(/\s+/g, ' '),
            help: help && { href: help.getAttribute('href'), h: Math.round(help.getBoundingClientRect().height), text: help.textContent.trim(), target: help.target },
            font: parseFloat(cs.fontSize),
            body0: parseFloat(getComputedStyle(ps[1] || p0).fontSize),
            lh: parseFloat(getComputedStyle(ps[1] || p0).lineHeight) / parseFloat(getComputedStyle(ps[1] || p0).fontSize),
            align: cs.textAlign,
            startGap: Math.round(document.documentElement.dir === 'rtl' ? box.right - tr.right : tr.left - box.left),
            gaps,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        }, NUMBER);
        if (!m) {
          check(`${tag} description rendered`, false, 'no .dsr-desc');
          await context.close();
          continue;
        }
        const paras = STORE[locale].map(strip);
        if (label === 'default') {
          check(`${tag} grouped: introduction first, then details, then size guidance`, m.structured && m.intro === paras[0] && m.body === paras[1] && m.fit && m.fit.includes(paras[2]), JSON.stringify([m.intro, m.body, m.fit]));
          check(`${tag} "${strings.dressar.product.description_fit}" label over the measurement`, m.fitLabel === strings.dressar.product.description_fit, m.fitLabel);
          check(`${tag} no raw phone number in the text; the WhatsApp line is the size-help button`, !m.numberInText && m.help && /^https:\/\/wa\.me\/\d+\?text=/.test(m.help.href) && m.help.target === '_blank', JSON.stringify(m.help));
          check(`${tag} WhatsApp button: compact one-line pill, 44px target, localized`, m.help && m.help.h >= 44 && m.help.h <= 48 && m.help.text.includes(strings.dressar.product.size_help_short), JSON.stringify(m.help));
          check(`${tag} nothing lost: every other paragraph is shown word for word`, paras.slice(0, 3).every((t) => m.allText.includes(t)), m.allText.slice(0, 200));
          const mobile = width < 750;
          check(`${tag} body text ${mobile ? '14.5' : '15.5'}px`, Math.abs(m.body0 - (mobile ? 14.5 : 15.5)) < 0.3, String(m.body0));
          check(`${tag} line height ${rtl ? '1.8 (Arabic)' : '1.65'}`, rtl ? m.lh >= 1.7 && m.lh <= 1.85 : m.lh >= 1.6 && m.lh <= 1.7, m.lh.toFixed(2));
          check(`${tag} paragraphs 12px apart; the size guidance group starts after a hairline, under 50px down`, m.gaps[0] >= 10 && m.gaps[0] <= 14 && m.gaps.slice(1).every((g) => g >= 10 && g <= 50), JSON.stringify(m.gaps));
          check(`${tag} aligned to the reading start (${rtl ? 'right' : 'left'}), not centred`, m.align === 'start' && m.startGap <= 1, JSON.stringify([m.align, m.startGap]));
        } else {
          check(`${tag} settings off: plain paragraphs as written, number kept, no button`, !m.structured && m.numberInText && !m.help, JSON.stringify([m.structured, m.numberInText, !!m.help]));
        }
        check(`${tag} no sideways scrolling`, !m.overflow);

        if (label === 'default') {
          await page.goto(`http://dressar.test/products/${TABLE}`);
          await page.waitForTimeout(400);
          const t = await page.evaluate(() => { const d = document.querySelector('.product__description .dsr-desc'); return d && { structured: d.classList.contains('dsr-desc--structured'), table: !!d.querySelector('table'), h4: !!d.querySelector('h4'), text: d.textContent.replace(/\s+/g, ' ').trim(), overflow: document.documentElement.scrollWidth > innerWidth }; });
          const want = strip(tableOriginal).replace(/\s+/g, ' ').trim();
          check(`${tag} a description with a size table is shown exactly as written`, t && !t.structured && t.table && t.h4 && t.text === want, t && t.text.slice(0, 80));
          check(`${tag} size table page: no sideways scrolling`, t && !t.overflow);
        }
        check(`${tag} no JS errors`, errors.length === 0, errors.join(' | '));
        await context.close();
      }
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
