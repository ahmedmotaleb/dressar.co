// Shopify-shaped products and collections for the local tests, built from
// tests/fixtures/catalog.json. Collections support Shopify's storefront
// filtering (variant-level: availability, price, colour, size), sorting and
// the filter objects Dawn's facets snippet reads. Not Shopify: an
// approximation good enough to drive the theme's real Liquid and JS.
'use strict';

const { Drop } = require('liquidjs');

class ColorDrop extends Drop {
  constructor(hex) {
    super();
    const h = hex.replace('#', '').toLowerCase();
    this.hex = `#${h}`;
    this.red = parseInt(h.slice(0, 2), 16);
    this.green = parseInt(h.slice(2, 4), 16);
    this.blue = parseInt(h.slice(4, 6), 16);
    this.rgb = `${this.red} ${this.green} ${this.blue}`;
  }
  valueOf() {
    return this.hex;
  }
}

class MediaDrop extends Drop {
  constructor({ id, filename, width, height, alt }) {
    super();
    Object.assign(this, { id, src: filename, filename, width, height, alt, aspect_ratio: width / height, media_type: 'image' });
    this.preview_image = this;
  }
  valueOf() {
    return `/img/${this.filename}`;
  }
}

class OptionValueDrop extends Drop {
  constructor(fields) {
    super();
    Object.assign(this, fields);
  }
  valueOf() {
    return this.name;
  }
}

const SORTS = [
  ['manual', 'Featured'],
  ['best-selling', 'Best selling'],
  ['title-ascending', 'Alphabetically, A-Z'],
  ['title-descending', 'Alphabetically, Z-A'],
  ['price-ascending', 'Price, low to high'],
  ['price-descending', 'Price, high to low'],
  ['created-ascending', 'Date, old to new'],
  ['created-descending', 'Date, new to old'],
];

function buildProduct(p, n = 0) {
  const handle = n ? `${p.handle}-${n}` : p.handle;
  const title = n ? `${p.title} · ${n}` : p.title;
  const idBase = (n + 1) * 100000 + hash(p.handle) % 90000;
  const media = p.media.map(
    ([width, height], i) => new MediaDrop({ id: idBase * 10 + i, filename: `${p.handle}-${i}.jpg`, width, height, alt: title })
  );
  const variants = p.variants.map(([options, price, compareAt, available, mediaIndex], i) => {
    const v = {
      id: idBase * 100 + i,
      title: options.join(' / '),
      options,
      option1: options[0],
      option2: options[1] ?? null,
      option3: options[2] ?? null,
      price,
      compare_at_price: compareAt,
      available: Boolean(available),
      // A low count on some variants, so Dawn's "low stock" line shows up.
      inventory_quantity: available ? 1 + (hash(handle + i) % 6) : 0,
      inventory_management: 'shopify',
      inventory_policy: 'deny',
      sku: `${p.handle}-${i}`.toUpperCase(),
      barcode: null,
      featured_media: mediaIndex == null ? null : media[mediaIndex],
      unit_price_measurement: null,
      requires_selling_plan: false,
      selling_plan_allocations: [],
      quantity_price_breaks: [],
      store_availabilities: [],
      requires_shipping: true,
      quantity_rule: { min: 1, max: null, increment: 1 },
    };
    v.url = `/products/${handle}?variant=${v.id}`;
    return v;
  });
  const first = variants.find((v) => v.available) || variants[0];
  const prices = variants.map((v) => v.price);
  const compares = variants.map((v) => v.compare_at_price).filter(Boolean);
  const metafields = { shopify: {}, custom: {}, reviews: {} };
  for (const [key, labels] of Object.entries(p.facts || {})) {
    metafields.shopify[key] = { value: labels.map((label) => ({ label: { value: label } })) };
  }
  const product = {
    id: idBase,
    handle,
    title,
    url: `/products/${handle}`,
    vendor: 'Dressar',
    type: p.type,
    description: p.description || '',
    tags: [],
    created: p.created * 1000 + (1000 - n),
    available: variants.some((v) => v.available),
    price: Math.min(...prices),
    price_min: Math.min(...prices),
    price_max: Math.max(...prices),
    price_varies: Math.min(...prices) !== Math.max(...prices),
    compare_at_price: compares.length ? Math.min(...compares) : null,
    compare_at_price_min: compares.length ? Math.min(...compares) : null,
    compare_at_price_max: compares.length ? Math.max(...compares) : null,
    compare_at_price_varies: compares.length ? Math.min(...compares) !== Math.max(...compares) : false,
    featured_media: media[0] || null,
    media,
    images: media,
    options: p.options.map((o) => o.name),
    variants,
    variants_count: variants.length,
    has_only_default_variant: false,
    requires_selling_plan: false,
    selling_plan_groups: [],
    'gift_card?': false,
    'quantity_price_breaks_configured?': false,
    metafields,
    __raw: p,
  };
  return selectVariant(product, null);
}

// The product as Shopify renders it with `variant` selected (null: none chosen,
// so the first available variant is used). Option values follow Shopify's rules:
// `available` given the values selected in the earlier options, `variant` the
// one combining this value with the other selected values.
function selectVariant(product, variant) {
  const { variants } = product;
  const current = variant || variants.find((v) => v.available) || variants[0];
  const options = product.__raw.options.map((o, oi) => {
    const key = `option${oi + 1}`;
    const values = o.values.map((raw, vi) => {
      const [name, hex, swatchImage] = Array.isArray(raw) ? raw : [raw];
      const others = (v) => product.__raw.options.every((_, j) => j === oi || v[`option${j + 1}`] === current[`option${j + 1}`]);
      const previous = (v) => product.__raw.options.every((_, j) => j >= oi || v[`option${j + 1}`] === current[`option${j + 1}`]);
      const match = variants.find((v) => v[key] === name && others(v));
      const swatch = hex
        ? {
            color: new ColorDrop(hex),
            image: swatchImage ? new MediaDrop({ id: 1, filename: `${swatchImage}.jpg`, width: 500, height: 667, alt: name }) : null,
          }
        : null;
      return new OptionValueDrop({
        id: product.id * 100 + oi * 10 + vi,
        name,
        swatch,
        variant: match || null,
        available: variants.some((v) => v[key] === name && previous(v) && v.available),
        selected: current[key] === name,
        product_url: product.url,
      });
    });
    return { name: o.name, position: oi + 1, values, selected_value: current[key] };
  });
  return Object.assign({}, product, {
    options_with_values: options,
    options_by_name: Object.fromEntries(options.map((o) => [o.name.toLowerCase(), o])),
    selected_variant: variant,
    selected_or_first_available_variant: current,
  });
}

function hash(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

// The products of a collection: the fixture's products repeated (with numbered
// handles and titles) up to the collection's real size, starting `offset`
// products in so collections side by side (the homepage rows) differ.
function collectionProducts(catalog, spec) {
  const base = spec.handle === 'home-wear' ? catalog.products.filter((p) => p.type === 'Home Wear' || p.type === 'Blouse') : catalog.products;
  const offset = spec.offset || 0;
  const out = [];
  for (let i = 0; out.length < spec.size; i++) out.push(buildProduct(base[(i + offset) % base.length], Math.floor((i + offset) / base.length)));
  return out;
}

const optionValue = (product, variant, names) => {
  const idx = product.options.findIndex((n) => names.includes(n.toLowerCase()));
  return idx < 0 ? null : variant[`option${idx + 1}`];
};

// query: URLSearchParams of the request.
function buildCollection(catalog, handle, query = new URLSearchParams()) {
  const spec = { handle, ...catalog.collections[handle] };
  const all = collectionProducts(catalog, spec);
  const url = `/collections/${handle}`;
  const image = spec.image ? new MediaDrop({ id: hash(handle), filename: `collection-${handle}.jpg`, width: spec.image[0], height: spec.image[1], alt: '' }) : null;
  const active = {
    availability: query.getAll('filter.v.availability'),
    color: query.getAll('filter.v.option.color'),
    size: query.getAll('filter.v.option.size'),
    gte: query.get('filter.v.price.gte'),
    lte: query.get('filter.v.price.lte'),
  };
  const toCents = (s) => (s == null || s === '' ? null : Math.round(Number(String(s).replace(/,/g, '')) * 100));
  const gte = toCents(active.gte);
  const lte = toCents(active.lte);

  // A product matches when one of its variants matches every active filter.
  const matches = (product, skip) =>
    product.variants.some(
      (v) =>
        (skip === 'availability' || !active.availability.length || active.availability.includes(v.available ? '1' : '0')) &&
        (skip === 'color' || !active.color.length || active.color.includes(optionValue(product, v, ['color', 'colour']))) &&
        (skip === 'size' || !active.size.length || active.size.includes(optionValue(product, v, ['size']))) &&
        (skip === 'price' || ((gte == null || v.price >= gte) && (lte == null || v.price <= lte)))
    );
  let products = all.filter((p) => matches(p));

  const sortBy = query.get('sort_by') || 'manual';
  const sorters = {
    'title-ascending': (a, b) => a.title.localeCompare(b.title),
    'title-descending': (a, b) => b.title.localeCompare(a.title),
    'price-ascending': (a, b) => a.price - b.price,
    'price-descending': (a, b) => b.price - a.price,
    'created-ascending': (a, b) => a.created - b.created,
    'created-descending': (a, b) => b.created - a.created,
  };
  if (sorters[sortBy]) products = [...products].sort(sorters[sortBy]);

  // URLs that add or remove one filter value, keeping everything else.
  const link = (mutate) => {
    const q = new URLSearchParams(query);
    q.delete('page');
    q.delete('section_id');
    mutate(q);
    const s = q.toString();
    return s ? `${url}?${s}` : url;
  };
  const listFilter = (label, param, key, valuesOf, swatchOf) => {
    const names = [];
    all.forEach((p) => p.variants.forEach((v) => {
      const val = valuesOf(p, v);
      if (val != null && !names.includes(val)) names.push(val);
    }));
    const values = names.map((name) => {
      const isActive = active[key].includes(name);
      const count = all.filter(
        (p) => matches(p, key) && p.variants.some((v) => valuesOf(p, v) === name)
      ).length;
      return {
        label: name,
        value: name,
        param_name: param,
        count,
        active: isActive,
        swatch: swatchOf ? swatchOf(name) : null,
        image: null,
        url_to_add: link((q) => q.append(param, name)),
        url_to_remove: link((q) => {
          const rest = q.getAll(param).filter((x) => x !== name);
          q.delete(param);
          rest.forEach((x) => q.append(param, x));
        }),
      };
    });
    return {
      label,
      type: 'list',
      param_name: param,
      presentation: swatchOf ? 'swatch' : 'text',
      operator: 'OR',
      values,
      active_values: values.filter((v) => v.active),
      inactive_values: values.filter((v) => !v.active),
      url_to_remove: link((q) => q.delete(param)),
    };
  };
  const swatches = {};
  all.forEach((p) =>
    p.options_with_values.forEach((o) => {
      if (['color', 'colour'].includes(o.name.toLowerCase())) o.values.forEach((v) => v.swatch && (swatches[v.name] = v.swatch));
    })
  );
  const availability = listFilter('Availability', 'filter.v.availability', 'availability', (p, v) => (v.available ? '1' : '0'));
  availability.values.forEach((v) => (v.label = v.value === '1' ? 'In stock' : 'Out of stock'));
  availability.values.sort((a, b) => b.value.localeCompare(a.value));
  const rangeMax = Math.max(0, ...all.map((p) => p.price_max));
  const price = {
    label: 'Price',
    type: 'price_range',
    param_name: 'filter.v.price',
    presentation: null,
    values: [],
    active_values: [],
    range_max: rangeMax,
    min_value: { param_name: 'filter.v.price.gte', value: gte },
    max_value: { param_name: 'filter.v.price.lte', value: lte },
    url_to_remove: link((q) => {
      q.delete('filter.v.price.gte');
      q.delete('filter.v.price.lte');
    }),
  };
  const filters = [
    availability,
    price,
    listFilter('Color', 'filter.v.option.color', 'color', (p, v) => optionValue(p, v, ['color', 'colour']), (n) => swatches[n] || null),
    listFilter('Size', 'filter.v.option.size', 'size', (p, v) => optionValue(p, v, ['size'])),
  ];

  return {
    id: 4242,
    handle,
    title: spec.title,
    description: spec.description,
    url,
    image,
    featured_image: image || (all[0] && all[0].featured_media ? all[0].featured_media.preview_image : null),
    products,
    products_count: products.length,
    all_products_count: all.length,
    filters,
    sort_by: query.get('sort_by') || null,
    default_sort_by: 'manual',
    sort_options: SORTS.map(([value, name]) => ({ value, name })),
    current_type: null,
    current_vendor: null,
    terms: null,
    results_count: null,
  };
}

module.exports = { buildProduct, selectVariant, buildCollection, MediaDrop, ColorDrop };
