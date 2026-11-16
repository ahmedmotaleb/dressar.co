/*
 * Video Stories (sections/dsr-video-stories.liquid, docs/stages/video-stories.md).
 *
 * Each section is a <dsr-video-stories> element: a natively scrolling row of
 * 9:16 cards. The active card is the one nearest the middle of the row, or,
 * on phones with "Cards on mobile: start" (data-mobile-layout), the one at
 * the start of the row; there the active card is wider than the others, so
 * after it becomes active the row is lined up on it again.
 *
 * One video at a time, page-wide: every section registers with a small
 * coordinator, which plays at most one video. That is the active video of
 * the section that may play (on screen, tab visible, autoplay allowed or
 * started by the shopper, not paused by the shopper) and is most in view,
 * or the one the shopper last started. Every other video is paused. The
 * coordinator re-decides whenever something changes: a scroll, a swipe, the
 * tab hiding, a button.
 *
 * Downloads: a video gets its source only when its card becomes active
 * (preload "metadata" for that one); videos far from the active card give
 * their source back. Autoplay is off for reduced motion and data saving;
 * the play button still works. A refused play() leaves the card paused, with
 * its play button.
 *
 * Theme editor: disconnecting (section reload or removal) pauses the videos
 * and removes every listener and observer; selecting a block scrolls to it.
 */
(() => {
  if (customElements.get('dsr-video-stories')) return;

  // ---------- Page-wide coordinator ----------
  const sections = new Set();
  let frame = 0;
  const reconcile = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const candidates = [...sections].filter((s) => s.wantsToPlay());
      candidates.sort((a, b) => b.startedAt - a.startedAt || b.ratio - a.ratio);
      const winner = candidates[0] || null;
      sections.forEach((s) => {
        if (s !== winner) s.pauseAll();
      });
      if (winner) winner.playActive();
    });
  };
  document.addEventListener('visibilitychange', reconcile);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const phone = window.matchMedia('(max-width: 749px)');
  const saveData = () => Boolean(navigator.connection && navigator.connection.saveData);
  // HLS only where the browser plays it itself (Safari, iPhone); no library.
  let hlsSupport = null;
  const canPlayHls = () => {
    if (hlsSupport === null) hlsSupport = document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== '';
    return hlsSupport;
  };

  class DsrVideoStories extends HTMLElement {
    connectedCallback() {
      if (this.ready) return;
      this.ready = true;
      this.track = this.querySelector('[data-dsr-vs-track]');
      this.slides = [...this.querySelectorAll('.dsr-vs__slide')];
      this.prevButton = this.querySelector('[data-dsr-vs-prev]');
      this.nextButton = this.querySelector('[data-dsr-vs-next]');
      this.active = -1;
      this.ratio = 0;
      this.near = false;
      this.muted = true;
      this.userPaused = false;
      this.startedAt = 0;
      this.labels = this.dataset;

      this.onScroll = this.onScroll.bind(this);
      this.onClick = this.onClick.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.onBlockSelect = this.onBlockSelect.bind(this);
      this.onMotionChange = () => reconcile();
      // Crossing 750px switches layouts: line the active card up again.
      this.onLayoutChange = () => this.align(this.active, 'auto');
      this.onVideoEvent = this.onVideoEvent.bind(this);

      this.track.addEventListener('scroll', this.onScroll, { passive: true });
      this.track.addEventListener('scrollend', this.onScroll);
      this.addEventListener('click', this.onClick);
      this.addEventListener('keydown', this.onKeydown);
      this.addEventListener('shopify:block:select', this.onBlockSelect);
      reducedMotion.addEventListener('change', this.onMotionChange);
      phone.addEventListener('change', this.onLayoutChange);
      this.videos().forEach((video) => {
        ['playing', 'pause', 'ended', 'error'].forEach((type) => video.addEventListener(type, this.onVideoEvent));
      });

      // In view: plays when at least a quarter shows; sources load a little before.
      this.viewObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            this.ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
          });
          reconcile();
        },
        { threshold: [0, 0.25, 0.5, 0.75, 1] }
      );
      this.viewObserver.observe(this);
      this.nearObserver = new IntersectionObserver(
        (entries) => {
          this.near = entries.some((entry) => entry.isIntersecting);
          if (this.near && this.active >= 0) this.loadSource(this.active);
        },
        { rootMargin: '200px 0px' }
      );
      this.nearObserver.observe(this);

      sections.add(this);
      // Wide screens open on a full row: the middle of the cards in view starts
      // active (a phone, with about one card in view, starts on the first).
      const first = this.slides[0];
      if (first && this.track.scrollLeft === 0 && !this.startMode()) {
        const inView = Math.floor(this.track.clientWidth / first.getBoundingClientRect().width);
        const start = Math.min(Math.floor(inView / 2), this.slides.length - 1);
        if (start > 0) {
          const row = this.track.getBoundingClientRect();
          const box = this.slides[start].getBoundingClientRect();
          this.track.scrollBy({ left: box.left + box.width / 2 - (row.left + row.width / 2), behavior: 'auto' });
        }
      }
      this.activate(this.anchorIndex());
    }

    disconnectedCallback() {
      sections.delete(this);
      this.pauseAll();
      this.track.removeEventListener('scroll', this.onScroll);
      this.track.removeEventListener('scrollend', this.onScroll);
      this.removeEventListener('click', this.onClick);
      this.removeEventListener('keydown', this.onKeydown);
      this.removeEventListener('shopify:block:select', this.onBlockSelect);
      reducedMotion.removeEventListener('change', this.onMotionChange);
      phone.removeEventListener('change', this.onLayoutChange);
      this.videos().forEach((video) => {
        ['playing', 'pause', 'ended', 'error'].forEach((type) => video.removeEventListener(type, this.onVideoEvent));
      });
      this.viewObserver.disconnect();
      this.nearObserver.disconnect();
      clearTimeout(this.settle);
      this.ready = false;
      reconcile();
    }

    videos() {
      return this.slides.map((slide) => slide.querySelector('video')).filter(Boolean);
    }

    video(index) {
      return this.slides[index] ? this.slides[index].querySelector('video') : null;
    }

    autoplayAllowed() {
      return this.dataset.autoplay === 'true' && !reducedMotion.matches && !saveData();
    }

    // May this section's active video play right now?
    wantsToPlay() {
      return (
        document.visibilityState === 'visible' &&
        this.ratio >= 0.25 &&
        !this.userPaused &&
        Boolean(this.video(this.active)) &&
        (this.autoplayAllowed() || this.startedAt > 0)
      );
    }

    // ---------- Sources ----------

    loadSource(index) {
      const video = this.video(index);
      if (!video || video.getAttribute('src') || !video.dataset.src) return;
      video.preload = 'metadata';
      video.src = video.dataset.hls && canPlayHls() ? video.dataset.hls : video.dataset.src;
    }

    // Cards two or more away give their video back, so long rows stay light.
    releaseFar() {
      this.slides.forEach((slide, index) => {
        const video = slide.querySelector('video');
        if (!video || Math.abs(index - this.active) < 2 || !video.getAttribute('src')) return;
        video.pause();
        video.removeAttribute('src');
        video.preload = 'none';
        video.load();
        slide.classList.remove('is-playing');
      });
    }

    // ---------- Playing ----------

    playActive() {
      const video = this.video(this.active);
      if (!video) return;
      this.videos().forEach((other) => {
        if (other !== video && !other.paused) other.pause();
      });
      this.loadSource(this.active);
      video.muted = this.muted;
      video.setAttribute('autoplay', '');
      if (!video.paused) return;
      const attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(() => {
          // Refused (no permission yet, low power mode, unsupported source): stay on the poster.
          video.removeAttribute('autoplay');
          this.updateControls();
        });
      }
    }

    pauseAll() {
      this.videos().forEach((video) => {
        video.removeAttribute('autoplay');
        if (!video.paused) video.pause();
      });
    }

    // ---------- The active card ----------

    // Phones with the "start" layout line the active card up with the start of the row.
    startMode() {
      return this.dataset.mobileLayout === 'start' && phone.matches;
    }

    rtl() {
      return getComputedStyle(this).direction === 'rtl';
    }

    // How far the row must move to line this card up (the start, or the middle).
    offsetOf(slide) {
      const row = this.track.getBoundingClientRect();
      const box = slide.getBoundingClientRect();
      if (this.startMode()) return this.rtl() ? box.right - row.right : box.left - row.left;
      return box.left + box.width / 2 - (row.left + row.width / 2);
    }

    anchorIndex() {
      if (!this.startMode()) return this.centredIndex();
      let best = 0;
      let distance = Infinity;
      this.slides.forEach((slide, index) => {
        const d = Math.abs(this.offsetOf(slide));
        if (d < distance) {
          distance = d;
          best = index;
        }
      });
      return best;
    }

    centredIndex() {
      if (!this.slides.length) return -1;
      const box = this.track.getBoundingClientRect();
      const middle = box.left + box.width / 2;
      let best = 0;
      let distance = Infinity;
      this.slides.forEach((slide, index) => {
        const r = slide.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - middle);
        if (d < distance) {
          distance = d;
          best = index;
        }
      });
      return best;
    }

    activate(index) {
      if (index < 0 || index === this.active) return;
      const previous = this.video(this.active);
      if (previous) {
        previous.removeAttribute('autoplay');
        previous.pause();
      }
      this.active = index;
      this.userPaused = false;
      this.slides.forEach((slide, i) => {
        const current = i === index;
        slide.classList.toggle('is-active', current);
        if (current) slide.setAttribute('aria-current', 'true');
        else slide.removeAttribute('aria-current');
        const controls = slide.querySelector('.dsr-vs__controls');
        if (controls) controls.inert = !current;
        // Other cards' play buttons stay clickable (they bring the card forward) but out of the tab order.
        const play = slide.querySelector('[data-dsr-vs-play]');
        if (play) play.tabIndex = current ? 0 : -1;
      });
      if (this.near) this.loadSource(index);
      this.releaseFar();
      this.updateArrows();
      this.updateControls();
      reconcile();
    }

    goTo(index) {
      const slide = this.slides[Math.max(0, Math.min(index, this.slides.length - 1))];
      if (!slide) return;
      // Activate first: in the "start" layout that widens the card, and the row
      // is lined up on its new size.
      this.activate(this.slides.indexOf(slide));
      this.align(this.active);
    }

    // Scroll the row only (the page stays put) to line the card up. While the
    // row glides there, the scroll handler leaves the target alone.
    align(index, behavior = reducedMotion.matches ? 'auto' : 'smooth') {
      const slide = this.slides[index];
      if (!slide) return;
      const delta = this.offsetOf(slide);
      if (Math.abs(delta) < 1) return;
      this.target = { index, until: Date.now() + 1200 };
      this.track.scrollBy({ left: delta, behavior });
    }

    // A swipe or a scroll: once the row comes to rest, the card in the middle
    // becomes active (scrollend where supported, else a short pause).
    onScroll(event) {
      clearTimeout(this.settle);
      const settle = () => {
        const anchored = this.anchorIndex();
        if (this.target && Date.now() < this.target.until && anchored !== this.target.index) return;
        this.target = null;
        const changed = anchored !== this.active;
        this.activate(anchored);
        // The new active card is wider: line it up again.
        if (changed && this.startMode()) this.align(anchored);
      };
      if (event && event.type === 'scrollend') settle();
      else this.settle = setTimeout(settle, 150);
    }

    onClick(event) {
      if (event.target.closest('[data-dsr-vs-prev]')) return this.goTo(this.active - 1);
      if (event.target.closest('[data-dsr-vs-next]')) return this.goTo(this.active + 1);
      const play = event.target.closest('[data-dsr-vs-play]');
      if (play) {
        const index = this.slides.indexOf(play.closest('.dsr-vs__slide'));
        if (index === this.active) return this.togglePlay();
        // Another card's play mark: bring that card forward and play it.
        this.goTo(index);
        this.startedAt = Date.now();
        return reconcile();
      }
      if (event.target.closest('[data-dsr-vs-mute]')) return this.toggleMute();
      const slide = event.target.closest('.dsr-vs__slide');
      // A tap on a neighbouring card brings it to the middle (its product link still opens).
      if (slide && !event.target.closest('a') && this.slides.indexOf(slide) !== this.active) {
        this.goTo(this.slides.indexOf(slide));
      }
    }

    onKeydown(event) {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.target.closest('input, textarea')) return;
      const forward = (event.key === 'ArrowRight') !== this.rtl();
      event.preventDefault();
      this.goTo(this.active + (forward ? 1 : -1));
    }

    onBlockSelect(event) {
      const slide = event.target.closest('.dsr-vs__slide');
      if (slide) this.goTo(this.slides.indexOf(slide));
    }

    togglePlay() {
      const video = this.video(this.active);
      if (!video) return;
      if (video.paused) {
        this.userPaused = false;
        this.startedAt = Date.now();
        reconcile();
      } else {
        this.userPaused = true;
        this.startedAt = 0;
        video.pause();
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      this.videos().forEach((video) => {
        video.muted = this.muted;
      });
      this.updateControls();
    }

    onVideoEvent(event) {
      const video = event.currentTarget;
      const slide = video.closest('.dsr-vs__slide');
      if (event.type === 'playing') slide.classList.add('is-playing');
      if (event.type === 'error') {
        // The HLS stream failed: fall back to the MP4 once, then give up on the poster.
        if (video.dataset.hls && video.getAttribute('src') === video.dataset.hls && video.dataset.src) {
          video.src = video.dataset.src;
          reconcile();
          return;
        }
        slide.classList.add('is-error');
      }
      if (event.type === 'ended' && this.slides.indexOf(slide) === this.active && this.active < this.slides.length - 1) {
        this.goTo(this.active + 1);
      }
      this.updateControls();
    }

    updateControls() {
      this.slides.forEach((slide, index) => {
        const video = slide.querySelector('video');
        const play = slide.querySelector('[data-dsr-vs-play]');
        const mute = slide.querySelector('[data-dsr-vs-mute]');
        const playing = Boolean(video && !video.paused && index === this.active);
        if (play) {
          play.setAttribute('aria-pressed', String(playing));
          play.setAttribute('aria-label', playing ? this.labels.labelPause : this.labels.labelPlay);
          play.classList.toggle('is-playing', playing);
        }
        if (mute) {
          mute.setAttribute('aria-pressed', String(this.muted));
          mute.setAttribute('aria-label', this.muted ? this.labels.labelUnmute : this.labels.labelMute);
          mute.classList.toggle('is-muted', this.muted);
        }
      });
    }

    updateArrows() {
      if (this.prevButton) this.prevButton.disabled = this.active <= 0;
      if (this.nextButton) this.nextButton.disabled = this.active >= this.slides.length - 1;
    }
  }

  customElements.define('dsr-video-stories', DsrVideoStories);
})();
