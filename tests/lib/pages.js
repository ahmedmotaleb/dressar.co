// A small storefront over the harness, for tests that visit several page
// types (a11y, seo, rtl, perf, regression): home, collection, product,
// search, the cart page, pages (contact) and the 404 page, with the requests
// their scripts make (Section Rendering API, recommendations, pickup
// availability).
'use strict';

const path = require('path');
const { readJson } = require('./theme-harness');
const { buildCollection, buildProduct, selectVariant } = require('./catalog');

const PAGES = {
  'size-chart': { title: 'Size chart', handle: 'size-chart', url: '/pages/size-chart', content: '<p>Size chart.</p>' },
  'care-instructions': { title: 'Care', handle: 'care-instructions', url: '/pages/care-instructions', content: '<p>Care page.</p>' },
};

function storefront({ root, harness, cartLines = [] }) {
  const catalog = readJson(path.join(root, 'tests/fixtures/catalog.json'));
  const collections = (handle) => buildCollection(catalog, handle);
  const product = (handle) => buildProduct(catalog.products.find((p) => p.handle === handle));
  const cart = () => harness.makeCart(cartLines);
  const globals = (pagePath, pageType, overrides = {}) =>
    harness.globals({ path: pagePath, pageType, cart: cart(), overrides: { __collections: collections, __pages: PAGES, ...overrides } });

  const sizes = {};
  catalog.products.forEach((p) => p.media.forEach((m, i) => (sizes[`${p.handle}-${i}.jpg`] = m)));
  Object.entries(catalog.collections).forEach(([h, c]) => c.image && (sizes[`collection-${h}.jpg`] = c.image));

  async function page(url) {
    const sid = url.searchParams.get('section_id');
    const render = async (template, g) =>
      sid ? harness.renderTemplate(template, g, { only: sid }) : harness.renderLayout(g, await harness.renderTemplate(template, g));
    if (url.pathname === '/') return render('index', globals('/', 'index'));
    if (url.pathname.startsWith('/recommendations/')) return '<div></div>';
    if (url.pathname.startsWith('/variants/')) return '<div id="shopify-section-pickup-availability" class="shopify-section"></div>';
    if (url.pathname === '/cart' && !sid) return render('cart', globals('/cart', 'cart'));
    let m = /^\/collections\/([\w-]+)$/.exec(url.pathname);
    if (m) {
      const collection = buildCollection(catalog, m[1], url.searchParams);
      return render('collection', globals(url.pathname, 'collection', { collection, __query: url.search.slice(1), __path: url.pathname }));
    }
    // /products/x, or /collections/y/products/x (the product seen through a collection).
    m = /^(?:\/collections\/([\w-]+))?\/products\/([\w-]+)$/.exec(url.pathname);
    if (m) {
      let p = product(m[2]);
      const variantId = url.searchParams.get('variant');
      if (variantId) p = selectVariant(p, p.variants.find((v) => String(v.id) === variantId));
      const within = m[1] ? { collection: buildCollection(catalog, m[1]) } : {};
      return render('product', globals(url.pathname, 'product', { product: p, ...within, __query: url.search.slice(1), __path: url.pathname }));
    }
    m = /^\/pages\/([\w-]+)$/.exec(url.pathname);
    if (m) {
      const handle = m[1];
      const pg = PAGES[handle] || { title: handle === 'contact' ? 'Contact' : handle, handle, url: url.pathname, content: '<p>Page.</p>' };
      return render(handle === 'contact' ? 'page.contact' : 'page', globals(url.pathname, 'page', { page: pg }));
    }
    if (url.pathname === '/404') return render('404', globals(url.pathname, '404'));
    if (url.pathname === '/search') {
      const results = buildCollection(catalog, 'skirts', url.searchParams);
      const terms = (url.searchParams.get('q') || '').toLowerCase();
      const found = results.products.filter((p) => p.title.toLowerCase().includes(terms));
      const search = {
        performed: true,
        terms: url.searchParams.get('q'),
        results: found.map((p) => Object.assign(p, { object_type: 'product' })),
        results_count: found.length,
        products_count: found.length,
        all_products_count: results.all_products_count,
        // No products, no filter values: Dawn then shows its "no results" message.
        filters: found.length ? results.filters : [],
        sort_options: results.sort_options,
        sort_by: results.sort_by,
        default_sort_by: 'relevance',
        url: '/search',
      };
      return render('search', globals('/search', 'search', { search, __query: url.search.slice(1), __path: '/search' }));
    }
    return null;
  }

  return {
    catalog,
    pages: page,
    imageSize: (n) => sizes[n],
    globalsFor: (pagePath = '/') => globals(pagePath, 'index'),
    cartSection: (id) => harness.renderSection(id, id, {}, globals('/', 'index')),
    cartJson: () => {
      const c = cart();
      return { item_count: c.item_count, total_price: c.total_price, items_subtotal_price: c.items_subtotal_price, items: c.items.map((i) => ({ key: i.key, quantity: i.quantity })) };
    },
  };
}

module.exports = { storefront };
