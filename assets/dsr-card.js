// Dressar product card (snippets/card-product.liquid). Loaded once from
// layout/theme.liquid, because cards also arrive by fetch; safe to load twice.
//
// - Colour swatches (snippets/dsr-card-swatches.liquid): picking a colour
//   shows that variant's photo on the card and points the card's links at the
//   first in-stock variant in that colour, with `pick=color` so the product
//   page knows the size is still to be chosen. The card's quick-add dialog
//   then opens on that colour too. On devices with a mouse, hovering a swatch
//   previews its photo.
// - Colour and size choice (snippets/dsr-card-options.liquid): sizes follow
//   the chosen colour's stock; a chosen colour and size give the exact
//   variant, which the card's links then open. The price, compare-at price
//   and sale badge follow too: the cheapest in-stock variant of the chosen
//   colour ("From" when its sizes cost different amounts), or the exact
//   variant once a size is chosen (docs/stages/card-upgrade.md).
// - The quick-add "+" (snippets/dsr-card-quick-add.liquid): adds that exact
//   variant through Dawn's product-form; with no complete, in-stock choice it
//   opens Dawn's quick-add dialog instead. It never adds anything else.
// Shopify HTML-escapes translated text; the card writes plain text.
function dsrCardDecode(text) {
  const area = document.createElement('textarea');
  area.innerHTML = String(text);
  return area.value;
}

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
        this.quickAdd = this.card.querySelector('.dsr-quick-add [data-product-url]');
        this.quickAddUrl = this.quickAdd && this.quickAdd.getAttribute('data-product-url');

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
        if (this.quickAdd) {
          const url = new URL(this.quickAddUrl, window.location.origin);
          url.searchParams.set('variant', button.dataset.variantId);
          this.quickAdd.setAttribute('data-product-url', url.pathname + url.search);
        }
        // The size row follows the chosen colour (dsr-card-options below).
        this.dispatchEvent(new CustomEvent('dsr-card:color', { bubbles: true, detail: { value: button.dataset.value } }));
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

// Colour and size choice on a card (snippets/dsr-card-options.liquid).
if (!customElements.get('dsr-card-options')) {
  customElements.define(
    'dsr-card-options',
    class DsrCardOptions extends HTMLElement {
      connectedCallback() {
        this.card = this.closest('.card-wrapper');
        const data = this.querySelector('script[data-dsr-card-variants]');
        try {
          // [[id, in stock (1/0), [option values], price, compare-at or null, sale %, price in cents], ...]
          this.variants = data ? JSON.parse(data.textContent) : null;
        } catch (error) {
          this.variants = null;
        }
        const colorRow = this.querySelector('.dsr-card-colors-row[data-option-index]');
        const sizeRow = this.querySelector('.dsr-card-sizes-row[data-option-index]');
        this.colorIndex = colorRow ? Number(colorRow.dataset.optionIndex) : -1;
        this.sizeIndex = sizeRow ? Number(sizeRow.dataset.optionIndex) : -1;
        this.sizes = Array.from(this.querySelectorAll('button.dsr-card-size'));
        this.links = this.card
          ? Array.from(this.card.querySelectorAll('a[href]')).map((link) => ({ link, href: link.getAttribute('href') }))
          : [];

        this.onClick = this.onClick.bind(this);
        this.onColor = this.onColor.bind(this);
        this.addEventListener('click', this.onClick);
        this.addEventListener('dsr-card:color', this.onColor);
        this.refreshSizes();
      }

      disconnectedCallback() {
        this.removeEventListener('click', this.onClick);
        this.removeEventListener('dsr-card:color', this.onColor);
      }

      values(index) {
        return Array.from(new Set(this.variants.map((variant) => variant[2][index])));
      }

      // The chosen colour: the selected swatch, or the product's only colour.
      color() {
        if (this.colorIndex < 0 || !this.variants) return null;
        const pressed = this.querySelector('.dsr-card-swatch[aria-pressed="true"][data-value]');
        if (pressed) return pressed.dataset.value;
        const colors = this.values(this.colorIndex);
        return colors.length === 1 ? colors[0] : null;
      }

      size() {
        const pressed = this.sizes.find((button) => button.getAttribute('aria-pressed') === 'true');
        return pressed ? pressed.dataset.value : null;
      }

      // A size is open when it is in stock in the chosen colour (in any colour
      // before one is chosen). A chosen size that isn't is let go.
      refreshSizes() {
        if (!this.variants || this.sizeIndex < 0) return;
        const color = this.color();
        this.sizes.forEach((button) => {
          const open = this.variants.some(
            ([, available, options]) =>
              available &&
              options[this.sizeIndex] === button.dataset.value &&
              (color === null || options[this.colorIndex] === color)
          );
          if (open) {
            button.removeAttribute('aria-disabled');
            button.removeAttribute('aria-label');
          } else {
            button.setAttribute('aria-disabled', 'true');
            button.setAttribute('aria-label', button.dataset.soldOutLabel);
            button.setAttribute('aria-pressed', 'false');
          }
        });
      }

      onColor() {
        this.refreshSizes();
        this.updateLinks();
        this.updatePrice();
      }

      // The price and sale badge for the choice on the card, from one variant:
      // the exact one once a size is chosen, otherwise the cheapest in-stock
      // variant of the chosen colour (any variant when none is in stock).
      updatePrice() {
        if (!this.variants || !this.variants.length || !this.card || this.variants[0].length < 7) return;
        const color = this.color();
        const size = this.size();
        let scope = this.variants.filter(([, , options]) => color === null || this.colorIndex < 0 || options[this.colorIndex] === color);
        if (size !== null && this.sizeIndex >= 0) {
          const exact = scope.filter(([, , options]) => options[this.sizeIndex] === size);
          if (exact.length) scope = exact;
        }
        if (!scope.length) return;
        const inStock = scope.filter(([, available]) => available);
        const variant = (inStock.length ? inStock : scope).reduce((low, next) => (next[6] < low[6] ? next : low));
        const [, , , price, compare, percent] = variant;
        const from = new Set(scope.map((entry) => entry[6])).size > 1;
        const text = from ? dsrCardDecode(this.dataset.from || '__price__').replace('__price__', price) : price;

        const block = this.card.querySelector('.card-information .price');
        if (block) {
          block.classList.toggle('price--on-sale', Boolean(compare));
          block.querySelectorAll('.price__regular .price-item--regular, .price__sale .price-item--sale').forEach((item) => {
            item.textContent = text;
          });
          const was = block.querySelector('.price__sale s.price-item--regular');
          if (was) was.textContent = compare || '';
        }
        this.card.querySelectorAll('[data-dsr-sale-badge]').forEach((badge) => {
          badge.replaceChildren();
          badge.hidden = !(percent >= 1);
          if (percent >= 1) {
            const shown = document.createElement('span');
            shown.setAttribute('aria-hidden', 'true');
            shown.textContent = `${percent}%`;
            const spoken = document.createElement('span');
            spoken.className = 'visually-hidden';
            spoken.textContent = dsrCardDecode(this.dataset.sale || '__percent__%').replace('__percent__', percent);
            badge.append(shown, spoken);
          }
        });
      }

      onClick(event) {
        const button = event.target.closest('button.dsr-card-size');
        if (!button) return;
        event.preventDefault();
        if (button.getAttribute('aria-disabled') === 'true') return;
        // One size: it stays chosen.
        const chosen = this.sizes.length === 1 || button.getAttribute('aria-pressed') !== 'true';
        this.sizes.forEach((other) => other.setAttribute('aria-pressed', other === button && chosen ? 'true' : 'false'));
        this.updateLinks();
        this.updatePrice();
      }

      // The exact variant chosen on the card, or null while the choice is
      // incomplete (or the product has other options with a choice to make).
      selectedVariant() {
        if (!this.variants || !this.variants.length) return null;
        const others = this.variants[0][2].some(
          (_, index) => index !== this.colorIndex && index !== this.sizeIndex && this.values(index).length > 1
        );
        if (others) return null;
        const color = this.color();
        const size = this.size();
        if ((this.colorIndex >= 0 && color === null) || (this.sizeIndex >= 0 && size === null)) return null;
        const matches = this.variants.filter(
          ([, , options]) =>
            (this.colorIndex < 0 || options[this.colorIndex] === color) &&
            (this.sizeIndex < 0 || options[this.sizeIndex] === size)
        );
        if (matches.length !== 1) return null;
        return { id: matches[0][0], available: Boolean(matches[0][1]) };
      }

      // The card's links open the exact variant once colour and size are
      // chosen; otherwise the picked colour (pick=color), or the product.
      updateLinks() {
        const variant = this.selectedVariant();
        const pressed = this.card && this.card.classList.contains('dsr-card--color-picked')
          ? this.querySelector('.dsr-card-swatch[aria-pressed="true"][data-variant-id]')
          : null;
        this.links.forEach(({ link, href }) => {
          const url = new URL(href, window.location.origin);
          if (variant && variant.available && this.size() !== null) {
            url.searchParams.set('variant', variant.id);
          } else if (pressed) {
            url.searchParams.set('variant', pressed.dataset.variantId);
            url.searchParams.set('pick', 'color');
          }
          link.setAttribute('href', url.pathname + url.search);
        });
      }
    }
  );
}

// The quick-add "+" (snippets/dsr-card-quick-add.liquid) of products with more
// than one variant. Runs before Dawn's product-form (capture): with an exact,
// in-stock variant chosen on the card, it puts that variant's id in the form
// and lets Dawn add it; otherwise it stops the add and opens the product's
// quick-add dialog, on the colour picked on the card.
if (!window.dsrCardQuickAdd) {
  window.dsrCardQuickAdd = true;
  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target;
      const button = form && form.querySelector ? form.querySelector('.dsr-quick-add__button[data-dsr-dialog]') : null;
      if (!button) return;
      const card = form.closest('.card-wrapper');
      const options = card ? card.querySelector('dsr-card-options') : null;
      const variant =
        !button.hasAttribute('data-dsr-dialog-only') && options && typeof options.selectedVariant === 'function'
          ? options.selectedVariant()
          : null;
      const input = form.querySelector('input[name="id"]');
      if (variant && variant.available && input) {
        input.value = variant.id;
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (input) input.value = '';
      const dialog = document.querySelector(button.dataset.dsrDialog);
      if (dialog && typeof dialog.show === 'function' && button.getAttribute('aria-disabled') !== 'true') {
        dialog.show(button);
      }
    },
    true
  );
}
