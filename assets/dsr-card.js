// Dressar product card: colour swatches (snippets/dsr-card-swatches.liquid).
// Picking a colour shows that variant's photo on the card and points the
// card's links at the first in-stock variant in that colour, with
// `pick=color` so the product page knows the size is still to be chosen.
// On devices with a mouse, hovering a swatch previews its photo.
// Loaded once from layout/theme.liquid; safe to load twice.
if (!customElements.get('dsr-card-swatches')) {
  customElements.define(
    'dsr-card-swatches',
    class DsrCardSwatches extends HTMLElement {
      connectedCallback() {
        this.card = this.closest('.card-wrapper');
        this.image = this.card && this.card.querySelector('.card__media .media > img');
        if (!this.image) return;

        this.original = { src: this.image.src, srcset: this.image.srcset, alt: this.image.alt };
        this.links = Array.from(this.card.querySelectorAll('a[href]')).map((link) => ({
          link,
          href: link.getAttribute('href'),
        }));

        this.onClick = this.onClick.bind(this);
        this.onPreview = this.onPreview.bind(this);
        this.onLeave = this.onLeave.bind(this);
        this.addEventListener('click', this.onClick);
        if (window.matchMedia('(hover: hover)').matches) {
          this.addEventListener('pointerover', this.onPreview);
          this.addEventListener('pointerleave', this.onLeave);
        }
      }

      disconnectedCallback() {
        this.removeEventListener('click', this.onClick);
        this.removeEventListener('pointerover', this.onPreview);
        this.removeEventListener('pointerleave', this.onLeave);
      }

      buttons() {
        return Array.from(this.querySelectorAll('button.dsr-card-swatch'));
      }

      onClick(event) {
        const button = event.target.closest('button.dsr-card-swatch');
        if (!button) return;
        event.preventDefault();
        this.buttons().forEach((other) => other.setAttribute('aria-pressed', other === button ? 'true' : 'false'));
        this.show(button);
        this.card.classList.add('dsr-card--color-picked');
        this.links.forEach(({ link, href }) => {
          const url = new URL(href, window.location.origin);
          url.searchParams.set('variant', button.dataset.variantId);
          url.searchParams.set('pick', 'color');
          link.setAttribute('href', url.pathname + url.search);
        });
      }

      onPreview(event) {
        const button = event.target.closest('button.dsr-card-swatch');
        if (button) this.show(button);
      }

      onLeave() {
        const pressed = this.card.classList.contains('dsr-card--color-picked')
          ? this.querySelector('button.dsr-card-swatch[aria-pressed="true"]')
          : null;
        if (pressed) {
          this.show(pressed);
        } else {
          this.image.srcset = this.original.srcset;
          this.image.src = this.original.src;
          this.image.alt = this.original.alt;
        }
      }

      show(button) {
        if (!button.dataset.src) return;
        this.image.srcset = button.dataset.srcset.trim();
        this.image.src = button.dataset.src;
        this.image.alt = button.dataset.alt || this.original.alt;
      }
    }
  );
}
