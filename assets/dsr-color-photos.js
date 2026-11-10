// Dressar colour photo selector (snippets/dsr-color-photos.liquid).
// Below 990px the colour photos scroll sideways. Dawn replaces the whole
// picker after every choice (product-info.js), which would put the row back
// at its start; this keeps the row where the shopper left it and makes sure
// the selected colour is in view. Choosing, prices and photos are Dawn's own.
// Loaded from sections/main-product.liquid; safe to load twice.
if (!customElements.get('dsr-color-photos')) {
  const scrollPositions = new Map();

  customElements.define(
    'dsr-color-photos',
    class DsrColorPhotos extends HTMLElement {
      connectedCallback() {
        this.track = this.querySelector('.dsr-color-photos__track');
        if (!this.track) return;

        const key = this.dataset.key;
        if (scrollPositions.has(key)) this.track.scrollLeft = scrollPositions.get(key);
        this.revealSelected();

        this.onScroll = () => scrollPositions.set(key, this.track.scrollLeft);
        this.track.addEventListener('scroll', this.onScroll, { passive: true });
      }

      disconnectedCallback() {
        if (this.track && this.onScroll) this.track.removeEventListener('scroll', this.onScroll);
      }

      // Scrolls the row, never the page. Works left to right and right to left:
      // the change is a distance on screen, which scrollLeft follows either way.
      revealSelected() {
        const selected = this.querySelector('input:checked + label, [aria-current="true"]');
        if (!selected || this.track.scrollWidth <= this.track.clientWidth) return;

        const track = this.track.getBoundingClientRect();
        const item = selected.getBoundingClientRect();
        const gap = 8;
        if (item.left < track.left) {
          this.track.scrollLeft -= track.left - item.left + gap;
        } else if (item.right > track.right) {
          this.track.scrollLeft += item.right - track.right + gap;
        }
      }
    }
  );
}
