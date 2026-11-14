// Dressar "Complete the look" (sections/related-products.liquid): Dawn's
// product-recommendations element, plus one fallback. It asks for
// complementary products first (Search & Discovery > Recommendations); when a
// product has none, it asks again for related products (data-fallback-url).
// Loads after global.js, which defines ProductRecommendations.
if (!customElements.get('dsr-recommendations') && typeof ProductRecommendations === 'function') {
  customElements.define(
    'dsr-recommendations',
    class DsrRecommendations extends ProductRecommendations {
      loadRecommendations(productId) {
        this.fetchRecommendations(productId, this.dataset.url, this.dataset.fallbackUrl);
      }

      fetchRecommendations(productId, url, fallbackUrl) {
        fetch(`${url}&product_id=${productId}&section_id=${this.dataset.sectionId}`)
          .then((response) => response.text())
          .then((text) => {
            const html = document.createElement('div');
            html.innerHTML = text;
            const fresh = html.querySelector('dsr-recommendations');
            if (fresh && fresh.querySelector('.grid__item')) {
              this.innerHTML = fresh.innerHTML;
              this.classList.add('product-recommendations--loaded');
            } else if (fallbackUrl) {
              this.fetchRecommendations(productId, fallbackUrl, null);
            }
          })
          .catch((e) => {
            console.error(e);
          });
      }
    }
  );
}
