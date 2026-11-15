// Video Stories (sections/dsr-video-stories.liquid, assets/dsr-video-stories.js,
// docs/stages/video-stories.md), on the theme's real Liquid, CSS and JS in Chromium
// (tests/lib/theme-harness.js), Arabic (right to left) and English, at 360, 390, 430
// and 1440px. Two Video Stories sections are put on the home page, with small 9:16
// test clips (tests/fixtures/videos, WebM: this Chromium has no H.264) standing in
// for Shopify-hosted videos, and fixture products linked to them.
// usage: node tests/video-stories.test.js [themeRoot]
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createHarness, routeTheme, readJson } = require('./lib/theme-harness');
const { storefront } = require('./lib/pages');
const { buildProduct, MediaDrop } = require('./lib/catalog');

const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..'));
const fontsDir = process.env.FONTS_DIR || path.join(path.dirname(require.resolve('@fontsource/poppins/package.json')), 'files');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const VIDEOS = path.join(root, 'tests/fixtures/videos');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
const product = (handle) => buildProduct(catalog.products.find((p) => p.handle === handle));
const skirt = product('linen-maxi-skirt-with-front-pockets');
const suit = product('linen-suit'); // nothing in stock

// A Shopify video object as Liquid sees it: sources (an MP4 rendition each in Shopify;
// WebM here) and a preview image.
const video = (n) => ({
  id: 9000 + n,
  alt: '',
  media_type: 'video',
  aspect_ratio: 0.5625,
  preview_image: new MediaDrop({ id: 8000 + n, filename: `story-${n}.jpg`, width: 720, height: 1280, alt: '' }),
  sources: [
    { format: 'mp4', mime_type: 'video/webm', url: `/test-videos/story-${n}.webm`, width: 270, height: 480 },
    { format: 'mp4', mime_type: 'video/webm', url: `/test-videos/story-${n}.webm?hd`, width: 1080, height: 1920 },
    { format: 'm3u8', mime_type: 'application/x-mpegURL', url: `/test-videos/story-${n}.m3u8`, width: 1080, height: 1920 },
  ],
});

const section = (blocks, settings = {}) => ({
  type: 'dsr-video-stories',
  settings: { heading: 'Watch and shop', ...settings },
  blocks: Object.fromEntries(blocks.map((b, i) => [`b${i}`, { type: 'video', settings: b }])),
  block_order: blocks.map((_, i) => `b${i}`),
});

const FIRST = [
  { video: video(1), product: skirt, caption: 'Linen for every day' },
  { video: video(2), product: suit },
  { video: video(3) },
  { video: video(4), caption: 'Weekend look' },
];
const SECOND = [{ video: video(2) }, { video: video(3), product: skirt }, {}];

// The home page with Video Stories sections: `layout` "split" puts one at the top and
// one at the end; "together" puts both at the top, one after the other.
const patchFor = (layout, firstSettings = {}) => (name, template) => {
  if (name !== 'index') return template;
  const t = JSON.parse(JSON.stringify(template));
  t.sections.vs_one = section(FIRST, firstSettings);
  t.sections.vs_two = section(SECOND, { heading: 'More stories' });
  t.order = layout === 'together' ? ['vs_one', 'vs_two', ...t.order] : ['vs_one', ...t.order, 'vs_two'];
  return t;
};

async function main() {
  const browser = await chromium.launch();

  for (const locale of ['ar', 'en.default']) {
    const rtl = locale === 'ar';
    const L = rtl ? '[ar]' : '[en]';
    const strings = readJson(path.join(root, 'locales', `${locale}.json`));
    const vs = strings.dressar.video_stories;

    const open = async ({ width = 390, height = 844, layout = 'split', settings = {}, reduced = false, init = null } = {}) => {
      const harness = createHarness({ root, fixtures: path.join(root, 'tests/fixtures/store.json'), locale, templatePatch: patchFor(layout, settings) });
      const sf = storefront({ root, harness, catalog });
      const mobile = width < 750;
      const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      page.errors = [];
      page.videoRequests = [];
      page.on('pageerror', (e) => page.errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && page.errors.push(m.text()));
      if (init) await page.addInitScript(init);
      await routeTheme(page, { root, fontsDir, harness, imageSize: sf.imageSize, globalsFor: () => sf.globalsFor(), cartSection: sf.cartSection, cartJson: sf.cartJson, pages: (u) => sf.pages(u) });
      await page.route('**/test-videos/**', (route) => {
        const file = new URL(route.request().url()).pathname.split('/').pop();
        page.videoRequests.push(file + new URL(route.request().url()).search);
        const full = path.join(VIDEOS, file);
        if (!fs.existsSync(full)) return route.fulfill({ status: 404, body: '' });
        // Byte ranges, as Shopify's CDN serves them, so a video can seek.
        const body = fs.readFileSync(full);
        const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
        if (!range) return route.fulfill({ status: 200, contentType: 'video/webm', headers: { 'Accept-Ranges': 'bytes' }, body });
        const start = Number(range[1]);
        const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
        return route.fulfill({ status: 206, contentType: 'video/webm', headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${body.length}` }, body: body.subarray(start, end + 1) });
      });
      await page.goto('http://dressar.test/');
      await page.waitForTimeout(800);
      return page;
    };

    // State of every Video Stories section on the page.
    const state = (page) =>
      page.evaluate(() =>
        [...document.querySelectorAll('dsr-video-stories')].map((s) => {
          const slides = [...s.querySelectorAll('.dsr-vs__slide')];
          const videos = slides.map((sl) => sl.querySelector('video'));
          const active = slides.findIndex((sl) => sl.classList.contains('is-active'));
          const play = slides[active] && slides[active].querySelector('[data-dsr-vs-play]');
          const mute = slides[active] && slides[active].querySelector('[data-dsr-vs-mute]');
          return {
            active,
            playing: videos.map((v) => Boolean(v && !v.paused)),
            muted: videos.map((v) => (v ? v.muted : null)),
            src: videos.map((v) => (v ? v.getAttribute('src') : null)),
            preload: videos.map((v) => (v ? v.preload : null)),
            attrs: videos.filter(Boolean).map((v) => [v.hasAttribute('muted'), v.hasAttribute('playsinline'), v.hasAttribute('loop')]),
            playLabel: play && play.getAttribute('aria-label'),
            playPressed: play && play.getAttribute('aria-pressed'),
            muteLabel: mute && mute.getAttribute('aria-label'),
            mutePressed: mute && mute.getAttribute('aria-pressed'),
          };
        })
      );
    const playingCount = (st) => st.reduce((n, s) => n + s.playing.filter(Boolean).length, 0);
    const scrollToSection = (page, i) =>
      page.evaluate((i) => {
        const s = document.querySelectorAll('dsr-video-stories')[i];
        window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - 40);
      }, i);
    const wait = (page, ms = 700) => page.waitForTimeout(ms);

    // ---------------- Layout ----------------
    for (const width of [360, 390, 430, 1440]) {
      const tag = `${L} [${width}]`;
      const desktop = width >= 990;
      const page = await open({ width });
      await scrollToSection(page, 0);
      await wait(page, 900);
      const r = await page.evaluate(() => {
        const s = document.querySelector('dsr-video-stories');
        const track = s.querySelector('.dsr-vs__track');
        const slides = [...s.querySelectorAll('.dsr-vs__slide')];
        const box = (e) => e.getBoundingClientRect();
        const tb = box(track);
        const active = slides.find((sl) => sl.classList.contains('is-active'));
        const card = active.querySelector('.dsr-vs__card');
        const cb = box(card);
        const visible = slides.filter((sl) => {
          const b = box(sl);
          return b.right > tb.left + 4 && b.left < tb.right - 4;
        });
        const fully = slides.filter((sl) => {
          const b = box(sl);
          return b.left >= tb.left - 1 && b.right <= tb.right + 1;
        });
        return {
          heading: (s.querySelector('.dsr-vs__heading') || {}).textContent,
          ratio: cb.height / cb.width,
          radius: getComputedStyle(card).borderTopLeftRadius,
          centreOff: Math.abs(cb.left + cb.width / 2 - (tb.left + tb.width / 2)),
          visible: visible.length,
          fully: fully.length,
          activeIndex: slides.indexOf(active),
          cardHeights: slides.map((sl) => Math.round(box(sl).height)),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      check(`${tag} heading from the section setting`, r.heading && r.heading.trim() === 'Watch and shop', r.heading);
      check(`${tag} cards 9:16, 12px corners`, Math.abs(r.ratio - 16 / 9) < 0.02 && r.radius === '12px', JSON.stringify([r.ratio, r.radius]));
      check(`${tag} the active card sits in the middle of the row`, r.centreOff <= 2, String(r.centreOff));
      if (!desktop) check(`${tag} phones: one card in the middle, its neighbours peeking in`, r.fully === 1 && r.visible >= 2, JSON.stringify([r.fully, r.visible]));
      else check(`${tag} desktop: a full row (4+ cards in view), the middle one active`, r.visible >= 4 && r.activeIndex === 2, JSON.stringify([r.visible, r.activeIndex]));
      check(`${tag} every card the same size (no layout shift)`, new Set(r.cardHeights).size === 1, r.cardHeights.join());
      check(`${tag} no sideways page scroll`, r.overflow <= 0, String(r.overflow));
      // Playing doesn't change the card's size.
      const before = r.cardHeights[0];
      await wait(page, 600);
      const after = await page.evaluate(() => Math.round(document.querySelector('.dsr-vs__slide').getBoundingClientRect().height));
      check(`${tag} card size unchanged once the video plays`, after === before, `${before} -> ${after}`);
      check(`${tag} no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.context().close();
    }

    // ---------------- Autoplay, one video at a time, sources ----------------
    {
      const tag = `${L} [390] playback`;
      const page = await open({ width: 390 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await wait(page, 300);
      let st = await state(page);
      const firstRatio = await page.evaluate(() => {
        const b = document.querySelector('dsr-video-stories').getBoundingClientRect();
        return Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, 0)) / b.height;
      });
      if (firstRatio < 0.25) check(`${tag}: nothing plays while the section is mostly off screen`, playingCount(st) === 0, JSON.stringify(st.map((s) => s.playing)));
      await scrollToSection(page, 0);
      await wait(page, 1200);
      st = await state(page);
      const [one, two] = st;
      check(`${tag}: on screen, the active video plays, muted; it's the only one playing on the page`, one.active === 0 && one.playing[0] && one.muted[0] && playingCount(st) === 1, JSON.stringify(st.map((s) => [s.active, s.playing, s.muted])));
      check(`${tag}: videos are muted, inline, looping (markup)`, one.attrs.every((a) => a.join() === 'true,true,true'), JSON.stringify(one.attrs));
      check(`${tag}: only the active video has a source (preload metadata); the others have none (preload none)`, one.src[0] && !one.src[1] && !one.src[2] && !one.src[3] && one.preload[0] === 'metadata' && one.preload[1] === 'none', JSON.stringify([one.src, one.preload]));
      check(`${tag}: the 480px rendition is used, not the 1080px one`, /story-1\.webm$/.test(one.src[0]), one.src[0]);
      check(`${tag}: only that one video was downloaded`, page.videoRequests.every((f) => f.startsWith('story-1.webm')) && page.videoRequests.length >= 1, page.videoRequests.join());
      check(`${tag}: the second section, off screen, plays nothing and loads nothing`, two.playing.every((p) => !p) && two.src.every((x) => !x), JSON.stringify(two));
      check(`${tag}: buttons say "${vs.pause}" and "${vs.unmute}"`, one.playLabel === vs.pause && one.playPressed === 'true' && one.muteLabel === vs.unmute && one.mutePressed === 'true', JSON.stringify([one.playLabel, one.muteLabel]));

      // Swipe to the next card: the first pauses before the second plays.
      await page.evaluate(() => {
        const s = document.querySelector('dsr-video-stories');
        const track = s.querySelector('.dsr-vs__track');
        const next = s.querySelectorAll('.dsr-vs__slide')[1];
        const rb = track.getBoundingClientRect();
        const nb = next.getBoundingClientRect();
        track.scrollBy({ left: nb.left + nb.width / 2 - (rb.left + rb.width / 2), behavior: 'auto' });
      });
      await wait(page, 900);
      st = await state(page);
      check(`${tag}: swiping to the next card: it becomes active and plays, the first is paused`, st[0].active === 1 && st[0].playing[1] && !st[0].playing[0] && playingCount(st) === 1, JSON.stringify(st[0]));
      check(`${tag}: the next card's video loads only now`, st[0].src[1] && page.videoRequests.some((f) => f.startsWith('story-2.webm')), page.videoRequests.join());

      // Arrows: next and previous, disabled at the ends.
      await page.click('dsr-video-stories:first-of-type [data-dsr-vs-next]');
      await wait(page, 900);
      st = await state(page);
      check(`${tag}: "${vs.next}" moves on one card`, st[0].active === 2 && st[0].playing[2] && playingCount(st) === 1, JSON.stringify(st[0].playing));
      await page.click('dsr-video-stories:first-of-type [data-dsr-vs-prev]');
      await wait(page, 900);
      st = await state(page);
      check(`${tag}: "${vs.previous}" goes back one`, st[0].active === 1 && st[0].playing[1], String(st[0].active));
      check(`${tag}: cards two away give their video back (no source)`, !st[0].src[3], JSON.stringify(st[0].src));

      // Pause and play, sound on and off.
      await page.click('dsr-video-stories:first-of-type .dsr-vs__slide.is-active [data-dsr-vs-play]');
      await wait(page, 800);
      st = await state(page);
      check(`${tag}: the pause button pauses, and it stays paused; the button says "${vs.play}"`, playingCount(st) === 0 && st[0].playLabel === vs.play && st[0].playPressed === 'false', JSON.stringify([st[0].playing, st[0].playLabel]));
      await page.click('dsr-video-stories:first-of-type .dsr-vs__slide.is-active [data-dsr-vs-play]');
      await wait(page, 600);
      st = await state(page);
      check(`${tag}: play resumes it`, st[0].playing[1] && playingCount(st) === 1, JSON.stringify(st[0].playing));
      await page.click('dsr-video-stories:first-of-type .dsr-vs__slide.is-active [data-dsr-vs-mute]');
      await wait(page, 300);
      st = await state(page);
      check(`${tag}: sound on: unmuted, the button says "${vs.mute}"`, st[0].muted[1] === false && st[0].muteLabel === vs.mute && st[0].mutePressed === 'false', JSON.stringify([st[0].muted, st[0].muteLabel]));
      await page.click('dsr-video-stories:first-of-type .dsr-vs__slide.is-active [data-dsr-vs-mute]');
      await wait(page, 300);
      st = await state(page);
      check(`${tag}: sound off again`, st[0].muted[1] === true && st[0].muteLabel === vs.unmute, JSON.stringify(st[0].muted));

      // Leaving the screen, the tab hidden.
      await page.evaluate(() => window.scrollTo(0, document.querySelector('dsr-video-stories').getBoundingClientRect().bottom + window.scrollY + 900));
      await wait(page, 800);
      st = await state(page);
      check(`${tag}: scrolled away: everything paused`, playingCount(st) === 0, JSON.stringify(st.map((s) => s.playing)));
      await scrollToSection(page, 0);
      await wait(page, 900);
      st = await state(page);
      check(`${tag}: back on screen: the active video resumes`, st[0].playing[1] && playingCount(st) === 1, JSON.stringify(st[0].playing));
      const setHidden = (hidden) =>
        page.evaluate((hidden) => {
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
          document.dispatchEvent(new Event('visibilitychange'));
        }, hidden);
      await setHidden(true);
      await wait(page, 500);
      st = await state(page);
      check(`${tag}: tab hidden: paused`, playingCount(st) === 0, JSON.stringify(st[0].playing));
      await setHidden(false);
      await wait(page, 700);
      st = await state(page);
      check(`${tag}: tab visible again: resumes`, playingCount(st) === 1 && st[0].playing[1], JSON.stringify(st[0].playing));

      // The second section: scrolling to it hands playback over.
      await scrollToSection(page, 1);
      await wait(page, 1200);
      st = await state(page);
      check(`${tag}: the second section on screen: its active video plays, the first section's is paused`, st[1].playing[0] && !st[0].playing.some(Boolean) && playingCount(st) === 1, JSON.stringify(st.map((s) => s.playing)));
      check(`${tag}: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.context().close();
    }

    // Two sections on screen together: still one video, the one the shopper starts wins.
    {
      const tag = `${L} [1440] two sections in view`;
      const page = await open({ width: 1440, height: 2200, layout: 'together' });
      await page.evaluate(() => window.scrollTo(0, document.querySelector('dsr-video-stories').getBoundingClientRect().top + window.scrollY - 20));
      await wait(page, 1200);
      let st = await state(page);
      check(`${tag}: one video plays, page-wide`, playingCount(st) === 1, JSON.stringify(st.map((s) => s.playing)));
      // The other section: bring a card with a video to its middle, then press play.
      const before = st.findIndex((s) => s.playing.some(Boolean));
      const other = before === 0 ? 1 : 0;
      await page.evaluate((i) => {
        const s = document.querySelectorAll('dsr-video-stories')[i];
        const slides = [...s.querySelectorAll('.dsr-vs__slide')];
        const withVideo = slides.findIndex((sl) => sl.querySelector('video'));
        if (!slides[withVideo].classList.contains('is-active')) slides[withVideo].querySelector('.dsr-vs__card').click();
      }, other);
      await wait(page, 900);
      await page.evaluate((i) => document.querySelectorAll('dsr-video-stories')[i].querySelector('.dsr-vs__slide.is-active [data-dsr-vs-play]').click(), other);
      await wait(page, 900);
      st = await state(page);
      check(`${tag}: pressing play in the other section moves playback there; still one video`, playingCount(st) === 1 && st[other].playing.some(Boolean), JSON.stringify(st.map((s) => s.playing)));
      check(`${tag}: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.context().close();
    }

    // ---------------- Preferences, refusals, settings ----------------
    {
      const page = await open({ reduced: true });
      await scrollToSection(page, 0);
      await wait(page, 1000);
      let st = await state(page);
      check(`${L} reduced motion: nothing autoplays; the play button says "${vs.play}"`, playingCount(st) === 0 && st[0].playLabel === vs.play, JSON.stringify(st[0].playing));
      await page.click('dsr-video-stories:first-of-type .dsr-vs__slide.is-active [data-dsr-vs-play]');
      await wait(page, 700);
      st = await state(page);
      check(`${L} reduced motion: the play button starts it`, st[0].playing[0] && playingCount(st) === 1, JSON.stringify(st[0].playing));
      await page.context().close();
    }
    {
      const page = await open({ init: () => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } }) });
      await scrollToSection(page, 0);
      await wait(page, 1000);
      const st = await state(page);
      check(`${L} data saver on: nothing autoplays`, playingCount(st) === 0, JSON.stringify(st[0].playing));
      await page.context().close();
    }
    {
      const page = await open({
        init: () => {
          HTMLMediaElement.prototype.play = function () {
            return Promise.reject(new DOMException('The request is not allowed', 'NotAllowedError'));
          };
        },
      });
      await scrollToSection(page, 0);
      await wait(page, 1000);
      const r = await page.evaluate(() => {
        const slide = document.querySelector('dsr-video-stories .dsr-vs__slide.is-active');
        return { playing: slide.classList.contains('is-playing'), poster: Boolean(slide.querySelector('.dsr-vs__poster')), label: slide.querySelector('[data-dsr-vs-play]').getAttribute('aria-label') };
      });
      check(`${L} autoplay refused by the browser: no error, the poster stays, the play button offers "${vs.play}"`, !r.playing && r.poster && r.label === vs.play && page.errors.length === 0, JSON.stringify([r, page.errors]));
      await page.context().close();
    }
    {
      const page = await open({ settings: { autoplay: false } });
      await scrollToSection(page, 0);
      await wait(page, 1000);
      const st = await state(page);
      check(`${L} autoplay setting off: nothing plays until the shopper presses play`, playingCount(st) === 0, JSON.stringify(st[0].playing));
      await page.context().close();
    }
    {
      const page = await open({ settings: { loop: false } });
      await scrollToSection(page, 0);
      await wait(page, 1200);
      let st = await state(page);
      check(`${L} loop off: no loop attribute`, st[0].attrs.every((a) => a[2] === false), JSON.stringify(st[0].attrs));
      await page.evaluate(() => {
        const v = document.querySelector('dsr-video-stories .dsr-vs__slide.is-active video');
        // The test clips are 4 seconds long.
        v.currentTime = Number.isFinite(v.duration) ? v.duration - 0.15 : 3.85;
      });
      await wait(page, 1500);
      st = await state(page);
      check(`${L} loop off: when a video ends, the next one starts`, st[0].active === 1 && st[0].playing[1], JSON.stringify([st[0].active, st[0].playing]));
      await page.context().close();
    }

    // ---------------- Product, caption, placeholder, keyboard, editor, a11y ----------------
    {
      const tag = `${L} [390] content`;
      const page = await open({ width: 390 });
      await scrollToSection(page, 0);
      await wait(page, 900);
      const r = await page.evaluate(() => {
        const slides = [...document.querySelectorAll('dsr-video-stories')[0].querySelectorAll('.dsr-vs__slide')];
        const link = (i) => {
          const a = slides[i].querySelector('.dsr-vs__product');
          return a && { href: a.getAttribute('href'), title: a.querySelector('.dsr-vs__product-title').textContent.trim(), price: a.querySelector('.dsr-vs__product-price').textContent.replace(/\s+/g, ' ').trim(), soldOut: a.classList.contains('dsr-vs__product--sold-out') };
        };
        const second = [...document.querySelectorAll('dsr-video-stories')[1].querySelectorAll('.dsr-vs__slide')];
        return {
          one: link(0),
          two: link(1),
          three: link(2),
          captions: slides.map((s) => (s.querySelector('.dsr-vs__caption') || {}).textContent || null),
          labels: slides.map((s) => s.getAttribute('aria-label')),
          videoLabels: slides.map((s) => s.querySelector('video').getAttribute('aria-label')),
          placeholder: Boolean(second[2].querySelector('.dsr-vs__placeholder')) && !second[2].querySelector('video'),
        };
      });
      const priceText = (p) => (p.price_varies ? 'from' : '') + String(p.price / 100);
      check(`${tag}: linked product: its real URL, name and price`, r.one && r.one.href === skirt.url && r.one.title === skirt.title && r.one.price.replace(/[^\d.]/g, '').startsWith(String(skirt.price / 100)) && !r.one.soldOut, JSON.stringify([r.one, priceText(skirt)]));
      check(`${tag}: a sold-out product says "${strings.products.product.sold_out}", no price`, r.two && r.two.soldOut && r.two.price === strings.products.product.sold_out && r.two.href === suit.url, JSON.stringify(r.two));
      check(`${tag}: no product, no product link`, r.three === null, JSON.stringify(r.three));
      check(`${tag}: captions where set`, r.captions[0] === 'Linen for every day' && r.captions[1] === null && r.captions[3] === 'Weekend look', JSON.stringify(r.captions));
      check(`${tag}: slides named "1 of 4"…, videos named by caption, product or number`, r.labels[0] === vs.slide.replace('{{ index }}', '1').replace('{{ count }}', '4') && r.videoLabels[0] === 'Linen for every day' && r.videoLabels[1] === suit.title && r.videoLabels[2] === vs.video_label.replace('{{ index }}', '3'), JSON.stringify([r.labels[0], r.videoLabels]));
      check(`${tag}: a block with no video shows a placeholder, no video`, r.placeholder);

      // Keyboard: arrows move along the row, mirrored in Arabic.
      await page.focus('dsr-video-stories:first-of-type .dsr-vs__slide.is-active [data-dsr-vs-play]');
      await page.keyboard.press(rtl ? 'ArrowLeft' : 'ArrowRight');
      await wait(page, 900);
      let st = await state(page);
      check(`${tag}: keyboard: ${rtl ? 'ArrowLeft' : 'ArrowRight'} goes to the next video`, st[0].active === 1 && st[0].playing[1], String(st[0].active));
      const nextSide = await page.evaluate(() => {
        const slides = document.querySelectorAll('dsr-video-stories .dsr-vs__slide');
        return slides[2].getBoundingClientRect().left > slides[1].getBoundingClientRect().left ? 'right' : 'left';
      });
      check(`${tag}: the next card is on the ${rtl ? 'left' : 'right'}`, nextSide === (rtl ? 'left' : 'right'), nextSide);
      const tabbable = await page.evaluate(() => [...document.querySelectorAll('dsr-video-stories')[0].querySelectorAll('.dsr-vs__controls')].map((c) => !c.inert));
      check(`${tag}: only the active card's buttons can be reached`, tabbable.filter(Boolean).length === 1 && tabbable[1], JSON.stringify(tabbable));

      // Theme editor: selecting a block, the section unloaded, loaded again, moved.
      await page.evaluate(() => {
        const slide = document.querySelectorAll('dsr-video-stories')[0].querySelectorAll('.dsr-vs__slide')[3];
        slide.dispatchEvent(new CustomEvent('shopify:block:select', { bubbles: true }));
      });
      await wait(page, 900);
      st = await state(page);
      check(`${tag}: editor: selecting a block brings its video to the middle`, st[0].active === 3, String(st[0].active));
      await page.evaluate(() => {
        const s = document.querySelectorAll('dsr-video-stories')[0];
        window.__vsHtml = s.outerHTML;
        window.__vsParent = s.parentElement;
        s.remove();
      });
      await wait(page, 600);
      st = await state(page);
      check(`${tag}: editor: section removed: its videos stop, nothing else plays, no errors`, playingCount(st) === 0 && page.errors.length === 0, JSON.stringify(st.map((s) => s.playing)));
      await page.evaluate(() => {
        window.__vsParent.insertAdjacentHTML('afterbegin', window.__vsHtml);
      });
      await wait(page, 1200);
      st = await state(page);
      check(`${tag}: editor: section loaded again: works, one video plays`, playingCount(st) === 1, JSON.stringify(st.map((s) => s.playing)));
      // Moved (disconnected and connected again): no doubled listeners, so "next" moves one card.
      await page.evaluate(() => {
        const s = document.querySelectorAll('dsr-video-stories')[0];
        const parent = s.parentElement;
        parent.appendChild(s);
        parent.prepend(s);
      });
      await wait(page, 600);
      const from = (await state(page))[0].active;
      await page.evaluate(() => document.querySelector('dsr-video-stories [data-dsr-vs-next]').click());
      await wait(page, 900);
      st = await state(page);
      check(`${tag}: editor: section moved: "next" still moves exactly one card`, st[0].active === Math.min(from + 1, 3) && playingCount(st) === 1, JSON.stringify([from, st[0].active, playingCount(st)]));

      // Accessibility (axe), on the section.
      if (!(await page.evaluate(() => Boolean(window.axe)))) await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () => {
        const r = await window.axe.run({ include: [['dsr-video-stories']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
        return r.violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join(' , ')}`);
      });
      check(`${tag}: axe: no violations in the section`, violations.length === 0, violations.join(' | '));
      check(`${tag}: no JS errors`, page.errors.length === 0, page.errors.join(' | '));
      await page.context().close();
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
