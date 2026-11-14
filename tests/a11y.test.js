// Stage 8 accessibility tests: axe-core (WCAG 2.0/2.1/2.2 A and AA, plus
// best practices) on the theme's real pages and open drawers, rendered by
// tests/lib/theme-harness.js, plus keyboard and reduced-motion checks.
// usage: node tests/a11y.test.js [themeRoot]
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const locale = process.env.LOCALE || 'en.default';
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

const PAGES = ['/', '/collections/skirts', '/products/linen-maxi-skirt-with-front-pockets', '/search?q=linen', '/cart'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
// Dawn's sliders whose slides hold no links (the home wear slideshow, "Why
// Dressar" on phones) are scroll containers without focusable content. They
// keep keyboard-operable previous/next buttons, and Chromium (130+) and Firefox
// make such scrollers focusable themselves, so this rule is not counted.
const ALLOWED = { 'scrollable-region-focusable': 'Dawn sliders with previous/next buttons' };

async function main() {
  const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale });
  const sf = storefront({ root, harness, cartLines: [{ handle: 'linen-maxi-skirt-with-front-pockets', title: 'Linen Skirt', price: 24900, quantity: 1 }] });
  const browser = await chromium.launch();

  const open = async (width, pagePath) => {
    const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    await routeTheme(page, { root, fontsDir, harness, globalsFor: () => sf.globalsFor(), pages: sf.pages, imageSize: sf.imageSize, cartSection: sf.cartSection, cartJson: sf.cartJson });
    await page.goto(`http://dressar.test${pagePath}`);
    await page.waitForTimeout(600);
    page.closeAll = () => context.close();
    return page;
  };
  const axe = async (page, include) => {
    if (!(await page.evaluate(() => Boolean(window.axe)))) await page.addScriptTag({ content: axeSource });
    return page.evaluate(
      async ({ tags, include }) => {
        const r = await window.axe.run(include ? { include: [include] } : document, { runOnly: { type: 'tag', values: tags } });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 3) }));
      },
      { tags: TAGS, include }
    );
  };
  const report = (violations) => {
    const counted = violations.filter((v) => !ALLOWED[v.id]);
    return {
      blocking: counted.filter((v) => v.impact === 'critical' || v.impact === 'serious'),
      other: counted.filter((v) => v.impact !== 'critical' && v.impact !== 'serious'),
    };
  };
  const fmt = (list) => list.map((v) => `${v.impact} ${v.id}: ${v.nodes.join(' , ')}`).join(' | ');

  for (const width of [390, 1280]) {
    for (const pagePath of PAGES) {
      const tag = `[${width}] ${pagePath}`;
      const page = await open(width, pagePath);
      // Scroll once through, as a shopper would: lazy images and scroll reveals settle.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 50));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(300);
      const { blocking, other } = report(await axe(page));
      check(`${tag} axe: no critical or serious violations`, blocking.length === 0, fmt(blocking));
      check(`${tag} axe: no moderate or minor violations`, other.length === 0, fmt(other));

      const page2 = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        // Visible ones: Dawn's cart keeps a hidden "Your cart is empty" H1 for when it empties.
        h1: [...document.querySelectorAll('h1')].filter((h) => h.getClientRects().length).length,
        infinite: document
          .getAnimations()
          .filter((a) => a.playState === 'running' && a.effect && a.effect.getTiming().iterations === Infinity)
          .map((a) => (a.effect.target && a.effect.target.className) || a.animationName),
      }));
      const lang = locale.slice(0, 2);
      check(`${tag} <html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`, page2.lang === lang && page2.dir === (lang === 'ar' ? 'rtl' : 'ltr'), `${page2.lang} ${page2.dir}`);
      check(`${tag} one H1`, page2.h1 === 1, String(page2.h1));
      check(`${tag} reduced motion: nothing animates forever`, page2.infinite.length === 0, page2.infinite.join(', '));

      // Keyboard: the first Tab lands on "Skip to content", and focus is visible.
      await page.keyboard.press('Tab');
      const skip = await page.evaluate(() => {
        const a = document.activeElement;
        const cs = getComputedStyle(a);
        return {
          skip: a.classList.contains('skip-to-content-link'),
          href: a.getAttribute('href'),
          visible: a.getBoundingClientRect().width > 1 && (cs.outlineStyle !== 'none' || cs.boxShadow !== 'none'),
        };
      });
      check(`${tag} first Tab: visible "Skip to content" link`, skip.skip && skip.href === '#MainContent' && skip.visible, JSON.stringify(skip));
      check(`${tag} no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.closeAll();
    }
  }

  // Open drawers and dialogs, checked while open.
  {
    const page = await open(390, '/collections/skirts');
    await page.click('header-drawer summary');
    await page.waitForTimeout(400);
    let r = report(await axe(page, '#menu-drawer'));
    check('[390] menu drawer open: no axe violations', r.blocking.length + r.other.length === 0, fmt([...r.blocking, ...r.other]));
    // Dawn keeps focus on the toggle (now "Close menu") and traps Tab inside the drawer.
    const onToggle = await page.evaluate(() => document.activeElement.matches('header-drawer summary'));
    await page.keyboard.press('Tab');
    const inDrawer = await page.evaluate(() => Boolean(document.activeElement.closest('#menu-drawer')));
    check('[390] menu drawer open: focus on its toggle, then Tab enters the menu', onToggle && inDrawer, `${onToggle} ${inDrawer}`);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const back = await page.evaluate(() => document.activeElement.matches('header-drawer summary'));
    check('[390] Escape closes the menu drawer and returns focus to its button', back);

    await page.click('#FacetFiltersFormMobile summary, .mobile-facets__open');
    await page.waitForTimeout(500);
    r = report(await axe(page, '.mobile-facets__inner'));
    check('[390] filter drawer open: no axe violations', r.blocking.length + r.other.length === 0, fmt([...r.blocking, ...r.other]));
    await page.closeAll();
  }
  {
    const page = await open(390, '/');
    await page.click('#cart-icon-bubble');
    await page.waitForTimeout(600);
    const r = report(await axe(page, 'cart-drawer'));
    check('[390] cart drawer open: no axe violations', r.blocking.length + r.other.length === 0, fmt([...r.blocking, ...r.other]));
    const inDrawer = await page.evaluate(() => Boolean(document.activeElement.closest('cart-drawer')));
    check('[390] cart drawer open: focus moves into it', inDrawer);
    await page.closeAll();
  }
  {
    const page = await open(1280, '/');
    await page.click('details-modal.header__search summary');
    await page.waitForTimeout(400);
    const r = report(await axe(page, '.search-modal'));
    check('[1280] search dialog open: no axe violations', r.blocking.length + r.other.length === 0, fmt([...r.blocking, ...r.other]));
    const focused = await page.evaluate(() => document.activeElement.matches('input[type="search"]'));
    check('[1280] search dialog open: focus in the search field', focused);
    await page.closeAll();
  }

  await browser.close();
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`);
  }
  console.log(`\nNot counted: ${Object.entries(ALLOWED).map(([k, v]) => `${k} (${v})`).join('; ')}`);
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`);
  console.error(e);
  process.exit(1);
});
