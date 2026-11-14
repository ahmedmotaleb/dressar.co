// Dressar card photo slideshow (snippets/dsr-card-slides.liquid), on the
// collection page's product grid. Loaded by sections/main-collection-product-grid.liquid.
//
// Desktop with a mouse ((hover: hover) and (pointer: fine)):
// - While the pointer is over a card's photo, its images fade in one after
//   another every 800ms, starting from the card's own photo, and loop.
// - One card at a time: a single player, driven by one pointer listener for
//   the whole page.
// - Stops and resets to the first photo the moment the pointer leaves the
//   photo, the card leaves the screen, or the tab is hidden.
// - Never plays with reduced motion, or once a colour is picked on the card
//   (its photo stays, as in Stage 4).
// - The card's full-card link stays on top, so a click opens the product as
//   before; the "+" quick add stays above everything.
//
// Touch screens: the photos are a native sideways scroll row, lifted above the
// card link. A tap opens the product through the card's own link; a swipe
// never does, since browsers send no click after a scroll. Up-and-down
// scrolling of the page stays the browser's.
//
// The extra images load only on the first hover or touch of that card.
if (!customElements.get('dsr-card-slides')) {
  const DESKTOP = window.matchMedia('(hover: hover) and (pointer: fine)');
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
  const STEP_MS = 800;

  const player = {
    current: null,
    timer: null,
    visibility: new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting && entry.target === player.current) player.stop();
      });
    }),

    start(slides) {
      if (this.current === slides) return;
      this.stop();
      if (REDUCED_MOTION.matches || !slides.canPlay()) return;
      this.current = slides;
      slides.load();
      this.visibility.observe(slides);
      this.schedule();
    },

    schedule() {
      this.timer = window.setTimeout(() => {
        this.timer = null;
        if (!this.current) return;
        this.current.advance();
        this.schedule();
      }, STEP_MS);
    },

    stop() {
      window.clearTimeout(this.timer);
      this.timer = null;
      if (!this.current) return;
      this.visibility.unobserve(this.current);
      this.current.reset();
      this.current = null;
    },
  };

  // The card link covers the photo, so the photo itself never gets pointer
  // events: find the card under the pointer and check the photo's box.
  let lastPointer = null;
  const follow = (x, y, target) => {
    const card = target && target.closest ? target.closest('.card-wrapper') : null;
    const slides = card ? card.querySelector('dsr-card-slides') : null;
    if (slides && slides.isUnder(x, y)) {
      player.start(slides);
    } else {
      player.stop();
    }
  };

  document.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse' || !DESKTOP.matches) return;
      lastPointer = { x: event.clientX, y: event.clientY };
      follow(event.clientX, event.clientY, event.target);
    },
    { passive: true }
  );
  document.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) player.stop();
  });
  // A click (the card link, the "+", anything) stops it: nothing plays behind
  // the quick-add dialog or while the page changes. The next move restarts it.
  document.addEventListener('pointerdown', () => player.stop(), { passive: true });
  // Scrolling moves the cards under a still pointer.
  window.addEventListener(
    'scroll',
    () => {
      if (!player.current || !lastPointer) return;
      follow(lastPointer.x, lastPointer.y, document.elementFromPoint(lastPointer.x, lastPointer.y));
    },
    { passive: true }
  );
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) player.stop();
  });
  window.addEventListener('blur', () => player.stop());
  DESKTOP.addEventListener('change', () => player.stop());
  REDUCED_MOTION.addEventListener('change', () => player.stop());

  customElements.define(
    'dsr-card-slides',
    class DsrCardSlides extends HTMLElement {
      connectedCallback() {
        this.card = this.closest('.card-wrapper');
        this.photo = this.parentElement ? this.parentElement.querySelector(':scope > img') : null;
        this.track = this.querySelector('.dsr-card-slides__track');
        this.slides = Array.from(this.querySelectorAll('.dsr-card-slides__slide'));
        this.copy = this.querySelector('img[data-dsr-copy]');
        this.index = 0;
        if (!this.card || !this.track || this.slides.length < 2) return;

        // Lifts the photo above the card link on touch screens (assets/dsr-card.css).
        this.card.classList.add('dsr-card--slides');

        this.onTrackClick = this.onTrackClick.bind(this);
        this.onTouchStart = () => this.load();
        this.track.addEventListener('click', this.onTrackClick);
        this.track.addEventListener('pointerdown', this.onTouchStart, { passive: true });

        // A picked colour changes the card's photo: the first slide follows,
        // and the row goes back to it.
        if (this.photo && this.copy) {
          this.photoWatch = new MutationObserver(() => {
            if (this.loaded) this.copyPhoto();
            if (this.track.scrollLeft !== 0) this.track.scrollTo({ left: 0 });
          });
          this.photoWatch.observe(this.photo, { attributes: true, attributeFilter: ['src', 'srcset'] });
        }
      }

      disconnectedCallback() {
        if (player.current === this) player.stop();
        if (this.track) {
          this.track.removeEventListener('click', this.onTrackClick);
          this.track.removeEventListener('pointerdown', this.onTouchStart);
        }
        if (this.photoWatch) this.photoWatch.disconnect();
        if (this.card) this.card.classList.remove('dsr-card--slides');
      }

      canPlay() {
        return this.slides.length > 1 && !this.card.classList.contains('dsr-card--color-picked');
      }

      isUnder(x, y) {
        const box = this.getBoundingClientRect();
        return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
      }

      // Lazy: the images get their source on the first hover or touch.
      load() {
        if (this.loaded) return;
        this.loaded = true;
        this.copyPhoto();
        this.querySelectorAll('img[data-src]').forEach((img) => {
          if (img.dataset.srcset) img.srcset = img.dataset.srcset.trim();
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          img.removeAttribute('data-srcset');
        });
      }

      copyPhoto() {
        if (!this.photo || !this.copy) return;
        if (this.photo.getAttribute('srcset')) this.copy.srcset = this.photo.getAttribute('srcset');
        if (this.photo.getAttribute('sizes')) this.copy.sizes = this.photo.getAttribute('sizes');
        this.copy.src = this.photo.currentSrc || this.photo.src;
      }

      ready(i) {
        const img = this.slides[i].querySelector('img');
        return Boolean(img && img.complete && img.naturalWidth > 0);
      }

      failed(i) {
        const img = this.slides[i].querySelector('img');
        return Boolean(img && img.getAttribute('src') && img.complete && img.naturalWidth === 0);
      }

      // The next image that has loaded. One still loading is waited for (the
      // current image stays); one that failed is skipped.
      advance() {
        for (let step = 1; step <= this.slides.length; step++) {
          const next = (this.index + step) % this.slides.length;
          if (next === 0 || this.ready(next)) {
            this.show(next);
            return;
          }
          if (!this.failed(next)) return;
        }
      }

      // 0 is the card's own photo, underneath: no slide on top.
      show(i) {
        this.index = i;
        this.slides.forEach((slide, k) => slide.classList.toggle('is-active', k === i && i > 0));
      }

      // Back to the first photo at once, without the fade.
      reset() {
        this.classList.add('dsr-card-slides--instant');
        this.show(0);
        void this.offsetWidth;
        this.classList.remove('dsr-card-slides--instant');
      }

      // Touch screens: a tap on the photos opens the product, through the
      // card's own link (it may carry a picked colour).
      onTrackClick() {
        if (DESKTOP.matches) return;
        const link =
          this.card.querySelector('.card__information a[id^="CardLink-"]') ||
          this.card.querySelector('.card__heading a[href]');
        if (link) link.click();
      }
    }
  );
}
