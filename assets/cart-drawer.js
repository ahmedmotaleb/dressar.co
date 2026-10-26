class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    if (!cartLink) return;

    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(cartLink);
    });
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        this.open(cartLink);
      }
    });
  }

  open(triggeredBy) {
    if (this.classList.contains('active')) return;
    if (triggeredBy) this.setActiveElement(triggeredBy);
    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) this.setSummaryAccessibility(cartDrawerNote);
    // here the animation doesn't seem to always get triggered. A timeout seem to help
    setTimeout(() => {
      this.classList.add('animate', 'active');
    });

    this.addEventListener(
      'transitionend',
      () => {
        const containerToTrapFocusOn = this.classList.contains('is-empty')
          ? this.querySelector('.drawer__inner-empty')
          : document.getElementById('CartDrawer');
        const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
        trapFocus(containerToTrapFocusOn, focusElement);
      },
      { once: true },
    );

    document.body.classList.add('overflow-hidden');

    // cart-drawer-items is a CartItems subclass that extends createViewEventElement.
    // Its `view-event-trigger="manual"` skips auto-dispatch on connect; we fire
    // it here when the drawer opens, with `context: 'dialog'` from the payload attribute.
    this.querySelector('cart-drawer-items')?.dispatchViewEvent();
  }

  close() {
    this.classList.remove('active');
    removeTrapFocus(this.activeElement);
    document.body.classList.remove('overflow-hidden');
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if (cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  renderContents(parsedState) {
    this.querySelector('.drawer__inner').classList.contains('is-empty') &&
      this.querySelector('.drawer__inner').classList.remove('is-empty');
    this.productId = parsedState.id;
    this.getSectionsToRender().forEach((section) => {
      const sectionElement = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id);

      if (!sectionElement) return;
      sectionElement.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
    });

    setTimeout(() => {
      this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
      this.open();
    });
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
    ];
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);

/* ==========================================================================
   Dressar - free shipping progress in the cart drawer

   The store runs an automatic discount, "شحن مجاني White Friday", which
   qualifies on SUBTOTAL (>= 1500 EGP), not on item count. This bar measures
   the same subtotal the discount does (after product discounts, before
   shipping), so the message and the checkout agree.

   If that discount is ever changed, update DRESSAR_FREE_SHIPPING_MIN_SUBTOTAL
   to match, or the message and the checkout will disagree.

   The styles are injected inline rather than added as a <link> in the head:
   an extra render-blocking stylesheet in <head> was measured stalling this
   theme's per-section CSS badly, so nothing here touches the head's CSS chain.
   ========================================================================== */

// 1500 EGP in the cart's minor unit (piastres), the unit /cart.js reports.
const DRESSAR_FREE_SHIPPING_MIN_SUBTOTAL = 150000;

function dressarShippingStatus(cart) {
  if (!cart.item_count) return null;

  const subtotal = cart.items_subtotal_price;
  const remaining = DRESSAR_FREE_SHIPPING_MIN_SUBTOTAL - subtotal;

  if (remaining <= 0) {
    return { qualified: true, percent: 100, text: 'تمام! الشحن مجاني على طلبك 🚚' };
  }

  return {
    qualified: false,
    percent: Math.round((subtotal / DRESSAR_FREE_SHIPPING_MIN_SUBTOTAL) * 100),
    text: `فاضلك ${Math.ceil(remaining / 100)} جنيه بس والشحن يبقى مجاني 🚚`,
  };
}

function dressarInjectShippingStyles() {
  if (document.getElementById('dressar-shipping-styles')) return;

  const style = document.createElement('style');
  style.id = 'dressar-shipping-styles';
  style.textContent = `
    .dressar-shipping {
      margin: 0 1.5rem 1.2rem;
      padding: 1.2rem 1.4rem;
      border-radius: 6px;
      background: #f6f2f0;
    }
    .dressar-shipping__text {
      margin: 0 0 0.9rem;
      font-size: 13px;
      line-height: 1.45;
      color: #121212;
      text-align: center;
    }
    .dressar-shipping__track {
      height: 4px;
      border-radius: 999px;
      background: rgba(18, 18, 18, 0.12);
      overflow: hidden;
    }
    .dressar-shipping__fill {
      display: block;
      height: 100%;
      border-radius: 999px;
      background: #121212;
      transition: width 0.35s ease;
    }
    .dressar-shipping--qualified .dressar-shipping__text {
      font-weight: 600;
    }
    .dressar-shipping--qualified .dressar-shipping__fill {
      background: #1a7f5a;
    }
  `;
  document.head.appendChild(style);
}

function dressarRenderShippingProgress(cart) {
  const inner = document.querySelector('cart-drawer .drawer__inner');
  if (!inner) return;

  const status = dressarShippingStatus(cart);
  let bar = inner.querySelector('[data-dressar-shipping]');

  // An empty cart gets no message - there is nothing to make progress towards.
  if (!status) {
    if (bar) bar.remove();
    return;
  }

  dressarInjectShippingStyles();

  if (!bar) {
    bar = document.createElement('div');
    bar.setAttribute('data-dressar-shipping', '');
    const header = inner.querySelector('.drawer__header');
    if (header) {
      header.insertAdjacentElement('afterend', bar);
    } else {
      inner.prepend(bar);
    }
  }

  bar.className = `dressar-shipping${status.qualified ? ' dressar-shipping--qualified' : ''}`;
  bar.innerHTML = `
    <p class="dressar-shipping__text">${status.text}</p>
    <div class="dressar-shipping__track">
      <span class="dressar-shipping__fill" style="width: ${status.percent}%"></span>
    </div>
  `;
}

function dressarUpdateShippingProgress() {
  const cartUrl = (window.routes && window.routes.cart_url) || '/cart';

  fetch(`${cartUrl}.js`)
    .then((response) => response.json())
    .then((cart) => dressarRenderShippingProgress(cart))
    .catch(() => {});
}

// The drawer replaces its own innerHTML on every cart change, which wipes the
// bar out, so it has to be redrawn after each render rather than just once.
const dressarBaseRenderContents = CartDrawer.prototype.renderContents;

CartDrawer.prototype.renderContents = function (parsedState) {
  dressarBaseRenderContents.call(this, parsedState);
  dressarUpdateShippingProgress();
};

const dressarBaseOpen = CartDrawer.prototype.open;

CartDrawer.prototype.open = function (triggeredBy) {
  dressarBaseOpen.call(this, triggeredBy);
  dressarUpdateShippingProgress();
};

document.addEventListener('DOMContentLoaded', dressarUpdateShippingProgress);
