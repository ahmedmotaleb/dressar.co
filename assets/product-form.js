if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        if (this.cart) {
          formData.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          formData.append('sections_url', window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }
        config.body = formData;

        const variantId = formData.get('id');
        const quantity = parseInt(formData.get('quantity')) || 1;
        const linesUpdateDeferred = this.createCartLinesUpdateEvent(variantId, quantity);

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: variantId,
                errors: response.errors || response.description,
                message: response.message,
              });
              this.handleErrorMessage(response.description);
              this.dispatchCartErrorEvent(response.description || response.message, 'INVALID');
              linesUpdateDeferred?.reject(new Error(response.description || response.message));

              const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButtonText.classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            } else if (!this.cart) {
              this.resolveCartLinesUpdate(linesUpdateDeferred);
              window.location = window.routes.cart_url;
              return;
            }

            this.resolveCartLinesUpdate(linesUpdateDeferred);

            const startMarker = CartPerformance.createStartingMarker('add:wait-for-subscribers');
            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: variantId,
                cartData: response,
              }).then(() => {
                CartPerformance.measureFromMarker('add:wait-for-subscribers', startMarker);
              });
            this.error = false;
            const quickAddModal = this.closest('quick-add-modal');
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    CartPerformance.measure("add:paint-updated-sections", () => {
                      this.cart.renderContents(response);
                    });
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              CartPerformance.measure("add:paint-updated-sections", () => {
                this.cart.renderContents(response);
              });
            }
          })
          .catch((e) => {
            console.error(e);
            this.dispatchCartErrorEvent(e.message || 'Network error', 'SERVICE_UNAVAILABLE');
            linesUpdateDeferred?.reject(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            this.querySelector('.loading__spinner').classList.add('hidden');

            CartPerformance.measureFromEvent("add:user-action", evt);
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      createCartLinesUpdateEvent(variantId, quantity) {
        const { CartLinesUpdateEvent } = window.StandardEvents || {};
        if (!CartLinesUpdateEvent) return null;

        const deferred = CartLinesUpdateEvent.createPromise();
        this.dispatchEvent(
          new CartLinesUpdateEvent({
            action: 'add',
            context: 'product',
            lines: [{ merchandiseId: variantId, quantity }],
            promise: deferred.promise,
          })
        );
        return deferred;
      }

      resolveCartLinesUpdate(deferred) {
        if (!deferred) return;
        const { CartLinesUpdateEvent } = window.StandardEvents || {};
        if (!CartLinesUpdateEvent) return;

        const pendingCartDataPromise = typeof CartItems !== 'undefined'
          ? CartItems.fetchCartData()
          : fetch(`${routes.cart_url}.json`).then((response) => response.json());

        pendingCartDataPromise
          .then((cart) => {
            if (!cart?.currency) return deferred.reject(new Error('Missing currency in cart response'));
            deferred.resolve({ cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart) });
          })
          .catch((e) => deferred.reject(e));
      }

      dispatchCartErrorEvent(message, code) {
        const { CartErrorEvent } = window.StandardEvents || {};
        if (!CartErrorEvent) return;
        this.dispatchEvent(new CartErrorEvent({ error: message, code }));
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}

/* ==========================================================================
   Dressar - sticky add to cart on phones and tablets

   Measured on a product page: the page runs 5190px tall and the real Add to
   cart button sits at 1389px. It is on screen for roughly the first 15% of the
   scroll - the whole description, size table, care notes and 260-odd reviews
   are read with no way to buy without scrolling back up.

   The bar does not re-implement adding to cart. It clicks the real button, so
   variant selection, quantity, sold-out handling and the cart drawer all keep
   working exactly as they already do.

   Visibility is driven by a scroll handler rather than IntersectionObserver.
   Both would work in a real browser, but the scroll position is something that
   can be asserted directly in a test, and an observer that silently never fires
   would leave the bar permanently hidden with nothing to show for it.

   Styles are injected inline rather than added as a <link> in the head: an
   extra render-blocking stylesheet in <head> was measured stalling this
   theme's per-section CSS badly.
   ========================================================================== */

function dressarInjectStickyAtcStyles() {
  if (document.getElementById('dressar-sticky-atc-styles')) return;

  const style = document.createElement('style');
  style.id = 'dressar-sticky-atc-styles';
  style.textContent = `
    .dressar-sticky-atc {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 4;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
      background: #ffffff;
      border-top: 1px solid rgba(18, 18, 18, 0.1);
      box-shadow: 0 -2px 12px rgba(18, 18, 18, 0.08);
      transform: translateY(110%);
      transition: transform 0.25s ease;
    }
    .dressar-sticky-atc.is-visible {
      transform: translateY(0);
    }
    .dressar-sticky-atc__info {
      flex: 1 1 auto;
      min-width: 0;
    }
    .dressar-sticky-atc__name {
      display: block;
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: rgba(18, 18, 18, 0.6);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dressar-sticky-atc__price {
      display: block;
      font-size: 15px;
      font-weight: 700;
      color: #121212;
      margin-top: 2px;
    }
    .dressar-sticky-atc__button {
      flex: 0 0 auto;
      border: 0;
      cursor: pointer;
      background: #121212;
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.04em;
      padding: 13px 26px;
      border-radius: 4px;
    }
    .dressar-sticky-atc__button[disabled] {
      opacity: 0.45;
      cursor: not-allowed;
    }
    @media screen and (min-width: 990px) {
      .dressar-sticky-atc { display: none; }
    }
  `;
  document.head.appendChild(style);
}

function dressarInitStickyAtc() {
  const realButton = document.querySelector('product-form [name="add"]');
  const title = document.querySelector('.product__title h1, h1');
  if (!realButton || !title) return;
  if (document.querySelector('.dressar-sticky-atc')) return;

  dressarInjectStickyAtcStyles();

  const bar = document.createElement('div');
  bar.className = 'dressar-sticky-atc';
  bar.innerHTML = `
    <div class="dressar-sticky-atc__info">
      <span class="dressar-sticky-atc__name"></span>
      <span class="dressar-sticky-atc__price"></span>
    </div>
    <button type="button" class="dressar-sticky-atc__button"></button>
  `;
  document.body.appendChild(bar);

  const nameEl = bar.querySelector('.dressar-sticky-atc__name');
  const priceEl = bar.querySelector('.dressar-sticky-atc__price');
  const button = bar.querySelector('.dressar-sticky-atc__button');

  nameEl.textContent = title.textContent.trim();

  // Mirror whatever the real button currently says and whether it can be used,
  // so a sold-out variant reads as sold out here too instead of lying.
  function sync() {
    const priceSource = document.querySelector('.price__sale .price-item--sale, .price .price-item');
    if (priceSource) priceEl.textContent = priceSource.textContent.trim();

    const label = realButton.querySelector('span');
    button.textContent = (label ? label.textContent : realButton.textContent).trim();

    const unavailable =
      realButton.hasAttribute('disabled') || realButton.getAttribute('aria-disabled') === 'true';
    button.disabled = unavailable;
  }

  button.addEventListener('click', () => {
    realButton.click();
  });

  sync();
  new MutationObserver(sync).observe(realButton, {
    attributes: true,
    childList: true,
    subtree: true,
  });

  // Show the bar once the real button has scrolled above the top of the screen.
  let scheduled = false;

  function applyVisibility() {
    scheduled = false;
    const buttonBottom = realButton.getBoundingClientRect().bottom;
    bar.classList.toggle('is-visible', buttonBottom < 0);
  }

  function requestVisibilityUpdate() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(applyVisibility);
  }

  window.addEventListener('scroll', requestVisibilityUpdate, { passive: true });
  window.addEventListener('resize', requestVisibilityUpdate, { passive: true });

  applyVisibility();
}

document.addEventListener('DOMContentLoaded', dressarInitStickyAtc);
