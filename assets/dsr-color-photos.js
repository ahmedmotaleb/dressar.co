// Dressar colour photo selector (snippets/dsr-color-photos.liquid), for the
// product page only.
// - In Dawn's quick-add dialog, which shows the product page's own section,
//   the photos are swapped for Dawn's own picker for that option (rendered
//   next to them in a <template>), so quick add stays exactly Dawn's. Dawn
//   redraws the picker after each choice; the swap runs again each time.
// - On the product page, below 990px the photos scroll sideways. Dawn
//   replaces the whole picker after every choice (product-info.js), which
//   would put the row back at its start; this keeps the row where the shopper
//   left it and makes sure the selected colour is in view.
// Choosing, prices and photos are Dawn's own. Loaded from
// sections/main-product.liquid and, before any quick-add dialog opens, from
// layout/theme.liquid; safe to load twice.
if (!customElements.get('dsr-color-photos')) {
  const scrollPositions = new Map();

  customElements.define(
    'dsr-color-photos',
    class DsrColorPhotos extends HTMLElement {
      connectedCallback() {
        if (this.closest('quick-add-modal')) {
          this.useDawnPicker();
          return;
        }

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

      // Quick-add dialog: Dawn's own picker for this option in place of the
      // photos. The row shown without a colour option has no Dawn
      // counterpart, so it just goes.
      useDawnPicker() {
        const box = this.closest('.product-form__input--dsr-photos');
        if (!box) return;
        const next = box.nextElementSibling;
        const dawn = next && next.matches('template[data-dsr-dawn-picker]') ? next : null;
        if (dawn) {
          box.replaceWith(document.importNode(dawn.content, true));
          dawn.remove();
        } else {
          box.remove();
        }
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
