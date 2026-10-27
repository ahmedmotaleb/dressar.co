// A small Shopify-like renderer for local tests. It renders the theme's real
// Liquid (layout, section groups, sections, snippets, theme blocks) with LiquidJS,
// using Shopify-shaped objects and stubs for Shopify-only filters, and serves the
// result plus the theme's real CSS/JS to Playwright. It is not Shopify: it is
// for checking structure and behaviour when the real storefront is unreachable.
'use strict';

const fs = require('fs');
const path = require('path');
const { Liquid, Drop, Value } = require('liquidjs');

const HEADER_COMMENT = /^\s*\/\*[\s\S]*?\*\//;
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(HEADER_COMMENT, ''));
const schemaOf = (source) => {
  const m = source.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/);
  return m ? JSON.parse(m[1]) : {};
};
const handleize = (s) =>
  String(s).toLowerCase().trim().replace(/['"]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
// Marks a string as HTML-safe, like Shopify's own tag filters return.
const html = (s) => Object.assign(new String(s), { __html: true });

// ---------- Shopify-shaped objects ----------

class ColorDrop extends Drop {
  constructor(value) {
    super();
    const hex = /^#?[0-9a-f]{6}$/i.test(value || '') ? value.replace('#', '').toLowerCase() : '000000';
    this.hex = `#${hex}`;
    this.red = parseInt(hex.slice(0, 2), 16);
    this.green = parseInt(hex.slice(2, 4), 16);
    this.blue = parseInt(hex.slice(4, 6), 16);
    this.rgb = `${this.red} ${this.green} ${this.blue}`;
  }
  valueOf() {
    return this.hex;
  }
}

class FontDrop extends Drop {
  constructor(handle) {
    super();
    const m = /^(.*)_([ni])(\d)$/.exec(handle || 'poppins_n4');
    this.handle = handle;
    this.family = m ? m[1].replace(/(^|_)(\w)/g, (_, sp, c) => (sp ? ' ' : '') + c.toUpperCase()) : 'Poppins';
    this.style = m && m[2] === 'i' ? 'italic' : 'normal';
    this.weight = m ? Number(m[3]) * 100 : 400;
    this.fallback_families = 'sans-serif';
    this['system?'] = false;
  }
  variant(prop, value) {
    const f = new FontDrop(this.handle);
    Object.assign(f, { family: this.family, style: this.style, weight: this.weight });
    if (prop === 'weight') f.weight = value === 'bold' ? 700 : value === 'normal' ? 400 : Number(value);
    if (prop === 'style') f.style = value;
    return f;
  }
  get url() {
    return `/fonts/${this.family.toLowerCase().replace(/ /g, '-')}-${this.weight}-${this.style}.woff2`;
  }
  valueOf() {
    return this.family;
  }
}

class ImageDrop extends Drop {
  constructor({ filename, width, height, alt = '' }) {
    super();
    Object.assign(this, { src: filename, filename, width, height, alt, aspect_ratio: width / height });
    this.preview_image = this;
  }
  valueOf() {
    return `/img/${this.filename}`;
  }
}

function linkDrop(link, currentPath) {
  const links = (link.links || []).map((child) => linkDrop(child, currentPath));
  const current = link.url === currentPath;
  return {
    title: link.title,
    url: link.url,
    handle: handleize(link.title),
    links,
    current,
    active: current,
    child_active: links.some((l) => l.current || l.child_active),
    child_current: links.some((l) => l.current),
    levels: links.length ? 1 + Math.max(0, ...links.map((l) => l.levels)) : 0,
  };
}

function makeCart(lines = []) {
  const items = lines.map((l, i) => ({
    key: `line-${i}`,
    index: i,
    quantity: l.quantity,
    title: l.title,
    url: `/products/${l.handle}`,
    final_price: l.price,
    final_line_price: l.price * l.quantity,
    original_price: l.price,
    original_line_price: l.price * l.quantity,
    line_level_discount_allocations: [],
    properties: {},
    options_with_values: [],
    product: { title: l.title, has_only_default_variant: true },
    variant: { id: 1000 + i, title: 'M', quantity_rule: { min: 1, increment: 1 } },
    image: new ImageDrop({ filename: `${l.handle}.jpg`, width: 750, height: 1000 }),
  }));
  const cart = Object.assign([...items], {
    items,
    item_count: items.reduce((n, i) => n + i.quantity, 0),
    total_price: items.reduce((n, i) => n + i.final_line_price, 0),
    items_subtotal_price: items.reduce((n, i) => n + i.final_line_price, 0),
    cart_level_discount_applications: [],
    note: '',
    duties_included: false,
    taxes_included: false,
  });
  return cart;
}

function productDrop(p) {
  const available = p.inventory > 0;
  const variant = { id: 1, price: p.price, compare_at_price: p.compare_at, available, unit_price_measurement: null };
  return {
    title: p.title,
    handle: p.handle,
    url: `/products/${p.handle}`,
    vendor: 'Dressar',
    available,
    price: p.price,
    price_min: p.price,
    price_max: p.price_max,
    price_varies: p.price_max !== p.price,
    compare_at_price: p.compare_at,
    compare_at_price_varies: false,
    selected_or_first_available_variant: variant,
    variants: [variant],
    'quantity_price_breaks_configured?': false,
    featured_media: new ImageDrop({ filename: `${p.handle}.jpg`, width: p.image[0], height: p.image[1], alt: p.title }),
  };
}

// ---------- money / colours ----------

const moneyFormat = (cents) => `${Math.round(cents / 100).toLocaleString('en-US')} ج.م`;

function shiftLightness(color, pct) {
  const c = color instanceof ColorDrop ? color : new ColorDrop(String(color));
  let [r, g, b] = [c.red / 255, c.green / 255, c.blue / 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  l = Math.min(1, Math.max(0, l + pct / 100));
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  [r, g, b] = s === 0 ? [l, l, l] : [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)];
  return new ColorDrop('#' + [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join(''));
}

// Section and block settings that point at store resources, resolved like
// Shopify does: collection/page pickers to objects (from globals.__collections
// and globals.__pages), images to image objects, shopify:// links to paths.
function resolveResource(def, v, globals) {
  if (v === '' && ['image_picker', 'collection', 'product', 'page', 'video'].includes(def.type)) return null;
  if (v == null) return v;
  switch (def.type) {
    case 'collection':
      return typeof v === 'string' ? (globals.__collections ? globals.__collections(v) : null) : v;
    case 'page':
      return typeof v === 'string' ? (globals.__pages || {})[v] || null : v;
    case 'image_picker':
      return typeof v === 'string' ? new ImageDrop({ filename: v.split('/').pop(), width: 1600, height: 1000, alt: '' }) : v;
    case 'url':
      return typeof v === 'string' ? v.replace(/^shopify:\/\/(collections|products|pages|blogs)\//, '/$1/').replace(/^shopify:\/\/collections$/, '/collections') : v;
    default:
      return v;
  }
}

// ---------- harness ----------

function createHarness({ root, fixtures, locale = 'en.default', origin = 'http://dressar.test' }) {
  const store = readJson(fixtures);
  const localeData = readJson(path.join(root, 'locales', `${locale}.json`));
  const settingsSchema = JSON.parse(fs.readFileSync(path.join(root, 'config/settings_schema.json'), 'utf8'));
  const settingsData = readJson(path.join(root, 'config/settings_data.json')).current;
  const menus = (currentPath) =>
    Object.fromEntries(
      Object.entries(store.menus).map(([handle, links]) => [
        handle,
        { handle, title: handle, links: links.map((l) => linkDrop(l, currentPath)) },
      ])
    );

  const engine = new Liquid({
    root: [path.join(root, 'snippets')],
    extname: '.liquid',
    strictFilters: false,
    strictVariables: false,
    jsTruthy: false,
  });

  // Tags Shopify adds.
  const swallow = (name) =>
    engine.registerTag(name, {
      parse(token, remain) {
        let t;
        while ((t = remain.shift())) if (t.name === `end${name}`) return;
      },
      render() {
        return '';
      },
    });
  ['doc', 'schema'].forEach(swallow);
  const wrapBlock = (name, open, close) =>
    engine.registerTag(name, {
      parse(token, remain) {
        this.args = token.args;
        this.tpls = [];
        const stream = this.liquid.parser
          .parseStream(remain)
          .on(`tag:end${name}`, () => stream.stop())
          .on('template', (tpl) => this.tpls.push(tpl))
          .on('end', () => {
            throw new Error(`tag ${token.getText()} not closed`);
          });
        stream.start();
      },
      *render(ctx, emitter) {
        emitter.write(typeof open === 'function' ? open(this.args) : open);
        yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
        emitter.write(close);
      },
    });
  wrapBlock('style', '<style data-shopify>', '</style>');
  wrapBlock('stylesheet', '<style data-stylesheet-tag>', '</style>');
  wrapBlock('javascript', '<script data-javascript-tag>', '</script>');
  wrapBlock(
    'form',
    (args) => {
      const id = /id:\s*'([^']+)'/.exec(args);
      const cls = /class:\s*'([^']+)'/.exec(args);
      const type = /^\s*'([^']+)'/.exec(args);
      return `<form method="post" action="/${type ? type[1] : 'form'}"${id ? ` id="${id[1]}"` : ''}${cls ? ` class="${cls[1]}"` : ''}>`;
    },
    '</form>'
  );
  // {% paginate collection.products by 16 %}: slices the list and sets `paginate`,
  // with links that keep the current query string (filters, sort).
  engine.registerTag('paginate', {
    parse(token, remain) {
      const m = /^\s*([\w.]+)\s+by\s+(.+?)\s*$/.exec(token.args);
      this.path = m[1].split('.');
      this.list = new Value(m[1], this.liquid);
      this.by = new Value(m[2], this.liquid);
      this.tpls = [];
      const stream = this.liquid.parser
        .parseStream(remain)
        .on('tag:endpaginate', () => stream.stop())
        .on('template', (tpl) => this.tpls.push(tpl))
        .on('end', () => {
          throw new Error('paginate not closed');
        });
      stream.start();
    },
    *render(ctx, emitter) {
      const list = (yield this.list.value(ctx, false)) || [];
      const size = Number(yield this.by.value(ctx, false));
      const all = ctx.getAll();
      const query = new URLSearchParams(all.__query || '');
      const pages = Math.max(1, Math.ceil(list.length / size));
      const current = Math.min(pages, Math.max(1, Number(query.get('page')) || 1));
      const pageUrl = (n) => {
        const q = new URLSearchParams(query);
        q.delete('section_id');
        if (n > 1) q.set('page', n);
        else q.delete('page');
        const qs = q.toString();
        return `${all.__path || ''}${qs ? `?${qs}` : ''}`;
      };
      const parts = [];
      for (let n = 1; n <= pages; n++) {
        if (n === 1 || n === pages || Math.abs(n - current) <= 2) parts.push({ title: n, url: pageUrl(n), is_link: n !== current });
        else if (parts[parts.length - 1].title !== '…') parts.push({ title: '…', url: '', is_link: false });
      }
      const paginate = {
        current_page: current,
        current_offset: (current - 1) * size,
        items: list.length,
        page_size: size,
        pages,
        parts,
        previous: current > 1 ? { title: '«', url: pageUrl(current - 1), is_link: true } : null,
        next: current < pages ? { title: '»', url: pageUrl(current + 1), is_link: true } : null,
      };
      const slice = list.slice((current - 1) * size, current * size);
      const [root, ...rest] = this.path;
      const scope = { paginate };
      if (rest.length === 1) scope[root] = Object.assign(Object.create(Object.getPrototypeOf(all[root] || {})), all[root], { [rest[0]]: slice });
      ctx.push(scope);
      yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
      ctx.pop();
    },
  });
  engine.registerTag('sections', {
    parse(token) {
      this.group = /'([^']+)'/.exec(token.args)[1];
    },
    *render(ctx, emitter) {
      emitter.write(yield harness.renderGroup(this.group, { ...ctx.globals, ...ctx.getAll() }));
    },
  });

  // Filters Shopify adds (behaviour kept close to Shopify's where tests depend on it).
  const t = (key, ...args) => {
    const vars = Object.fromEntries(args.filter(Array.isArray));
    let v = String(key).split('.').reduce((o, k) => (o == null ? o : o[k]), localeData);
    if (v && typeof v === 'object' && 'count' in vars) {
      const category = new Intl.PluralRules(locale === 'en.default' ? 'en' : locale).select(Number(vars.count));
      v = v[category] ?? v.other;
    }
    if (typeof v !== 'string') return `translation missing: ${locale}.${key}`;
    return v.replace(/{{\s*(\w+)\s*}}/g, (_, k) => (vars[k] ?? ''));
  };
  const filters = {
    t,
    asset_url: (name) => `/assets/${name}`,
    inline_asset_content: (name) => {
      try {
        return fs.readFileSync(path.join(root, 'assets', name), 'utf8');
      } catch (e) {
        return '';
      }
    },
    stylesheet_tag: (url) => `<link href="${url}" rel="stylesheet" type="text/css" media="all" />`,
    // The URL keeps a reference to its image, so image_tag can print the image's alt like Shopify.
    image_url: (img, ...args) => {
      const width = (args.find((a) => Array.isArray(a) && a[0] === 'width') || [])[1];
      return Object.assign(new String(`${img && img.valueOf ? img.valueOf() : img}${width ? `?width=${width}` : ''}`), { __image: img, __width: width });
    },
    // Like Shopify: with no loading argument, images in the template's 4th
    // section and later get loading="lazy" (eager when section.index is nil).
    image_tag: function (url, ...args) {
      const o = Object.fromEntries(args.filter(Array.isArray));
      if (o.loading === undefined) {
        const index = this.context.getSync(['section', 'index']);
        if (index > 3) o.loading = 'lazy';
      }
      if (o.alt === undefined) o.alt = (url && url.__image && url.__image.alt) || '';
      // Like Shopify, width and height default to the size of the requested image.
      const img = url && url.__image;
      if (img && img.width && img.height && o.width === undefined) {
        if (o.height === undefined) {
          o.width = Math.min(Number(url.__width) || img.width, img.width);
          o.height = (o.width * img.height) / img.width;
        } else {
          o.width = (Number(o.height) * img.width) / img.height;
        }
      }
      const extraAlt = ` alt="${attr(o.alt)}"`;
      delete o.alt;
      const extra = ['class', 'alt', 'sizes', 'loading', 'fetchpriority', 'width', 'height']
        .filter((k) => o[k] !== undefined && o[k] !== false)
        .map((k) => ` ${k}="${attr(k === 'height' || k === 'width' ? Math.round(Number(o[k])) : o[k])}"`)
        .join('');
      return html(`<img src="${url}"${extraAlt}${extra}>`);
    },
    // Shopify leaves HTML-safe filter output (image_tag and friends) alone; Dawn relies on it.
    escape: (v) => (v && v.__html ? v : v == null ? '' : String(v instanceof Drop ? v.valueOf() : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')),
    placeholder_svg_tag: (name, cls = '') => `<svg class="${cls}" viewBox="0 0 525 525"></svg>`,
    money: moneyFormat,
    money_with_currency: moneyFormat,
    money_without_currency: (c) => Math.round(c / 100).toLocaleString('en-US'),
    font_face: (font) =>
      font instanceof FontDrop
        ? `@font-face{font-family:${font.family};font-weight:${font.weight};font-style:${font.style};font-display:swap;src:url("${font.url}") format("woff2");}`
        : '',
    font_modify: (font, prop, value) => (font instanceof FontDrop ? font.variant(prop, value) : font),
    font_url: (font) => (font instanceof FontDrop ? font.url : ''),
    color_brightness: (c) => {
      const d = c instanceof ColorDrop ? c : new ColorDrop(String(c));
      return (d.red * 299 + d.green * 587 + d.blue * 114) / 1000;
    },
    color_lighten: (c, n) => shiftLightness(c, Number(n)),
    color_darken: (c, n) => shiftLightness(c, -Number(n)),
    standard_event_data: () => '{}',
    // Shopify prints the product's Product JSON-LD; the harness prints its outline.
    structured_data: (p) =>
      JSON.stringify(
        p && p.title
          ? { '@context': 'http://schema.org/', '@type': 'Product', name: p.title, url: `${origin}${p.url}`, offers: (p.variants || []).map((v) => ({ '@type': 'Offer', price: v.price / 100 })) }
          : {}
      ),
    // Shopify's `json` filter, without the harness's own back-references.
    json: (value) => {
      const seen = new WeakSet();
      return JSON.stringify(value, (key, v) => {
        if (key === '__raw' || key === 'preview_image') return undefined;
        if (v && typeof v === 'object') {
          if (seen.has(v)) return undefined;
          seen.add(v);
          if (typeof v.valueOf === 'function' && v.filename) return { id: v.id, src: v.valueOf(), width: v.width, height: v.height, alt: v.alt, aspect_ratio: v.aspect_ratio };
        }
        return v;
      });
    },
    payment_button: () => '<div class="shopify-payment-button" data-test="dynamic-checkout"><button type="button" class="shopify-payment-button__button">Buy it now</button></div>',
    within: (url) => url,
    default_errors: () => '',
    file_url: (name) => `/files/${name}`,
    item_count_for_variant: () => 0,
    unit_price_with_measurement: () => '',
    metafield_tag: () => '',
    applicable_disclosures: () => [],
    handleize,
    handle: handleize,
  };
  Object.entries(filters).forEach(([n, fn]) => engine.registerFilter(n, fn));

  // Theme settings: schema defaults + settings_data, with Shopify types resolved.
  function resolveSetting(def, value) {
    if (value === undefined) value = def.default;
    switch (def.type) {
      case 'font_picker':
        return new FontDrop(value);
      case 'image_picker':
        if (!value) return null;
        if (String(value).includes(store.logo.filename)) return new ImageDrop(store.logo);
        return new ImageDrop({ filename: String(value).split('/').pop(), width: 1600, height: 1000 });
      case 'color':
        return value ? new ColorDrop(value) : null;
      default:
        return value;
    }
  }
  const settings = {};
  for (const group of settingsSchema)
    for (const def of group.settings || []) if (def.id) settings[def.id] = resolveSetting(def, settingsData[def.id]);
  settings.color_schemes = Object.entries(settingsData.color_schemes).map(([id, s]) => ({
    id,
    settings: Object.fromEntries(
      Object.entries(s.settings).map(([k, v]) => [k, k.endsWith('gradient') ? v : new ColorDrop(v)])
    ),
  }));

  const harness = {
    engine,
    store,
    settings,
    makeCart,
    productDrop,
    // Global objects for one page view.
    globals({ path: pagePath = '/', pageType = 'index', cart = makeCart(), template, overrides = {} } = {}) {
      return {
        settings,
        shop: { name: 'Dressar', url: origin, customer_accounts_enabled: true, shipping_policy: { body: '' } },
        cart,
        customer: null,
        request: { page_type: pageType, origin, path: pagePath, design_mode: false, locale: { iso_code: locale.slice(0, 2) } },
        routes: {
          root_url: '/',
          search_url: '/search',
          cart_url: '/cart',
          cart_add_url: '/cart/add',
          cart_change_url: '/cart/change',
          cart_update_url: '/cart/update',
          predictive_search_url: '/search/suggest',
          product_recommendations_url: '/recommendations/products',
          account_login_url: '/account/login',
          all_products_collection_url: '/collections/all',
        },
        localization: {
          country: { iso_code: 'EG', name: 'Egypt', currency: { iso_code: 'EGP', symbol: 'ج.م' } },
          available_countries: [{ iso_code: 'EG', name: 'Egypt', currency: { iso_code: 'EGP', symbol: 'ج.م' } }],
          language: locale.startsWith('ar') ? { iso_code: 'ar', endonym_name: 'العربية' } : { iso_code: 'en', endonym_name: 'English' },
          available_languages: [{ iso_code: 'en', endonym_name: 'English' }, { iso_code: 'ar', endonym_name: 'العربية' }],
        },
        search: { terms: '' },
        page: { url: pagePath },
        template: { name: template || pageType },
        page_title: 'Dressar',
        canonical_url: origin + pagePath,
        content_for_header: '<script>window.Shopify = window.Shopify || { designMode: false, shop: "dnx31m-mi.myshopify.com" };</script>',
        linklists: menus(pagePath),
        __menus: menus(pagePath),
        ...overrides,
      };
    },
    // Resolve a section's settings/blocks against its schema, like Shopify does.
    sectionObject(type, id, json = {}, globals) {
      const source = fs.readFileSync(path.join(root, 'sections', `${type}.liquid`), 'utf8');
      const schema = schemaOf(source);
      const resolve = (defs, values = {}) => {
        const out = {};
        for (const def of defs || []) {
          if (!def.id) continue;
          let v = values[def.id] !== undefined ? values[def.id] : def.default;
          if (def.type === 'link_list') v = v ? globals.__menus[v] || null : null;
          v = resolveResource(def, v, globals);
          out[def.id] = v;
        }
        return out;
      };
      // App blocks (shopify://apps/...) are left out: their code lives in the app.
      const blocks = (json.block_order || Object.keys(json.blocks || {}))
        .filter((bid) => !json.blocks[bid].disabled && !json.blocks[bid].type.startsWith('shopify://'))
        .map((bid) => {
          const b = json.blocks[bid];
          const bdef = (schema.blocks || []).find((d) => d.type === b.type) || {};
          return { id: bid, type: b.type, settings: resolve(bdef.settings, b.settings), shopify_attributes: '' };
        });
      return { source, schema, section: { id, settings: resolve(schema.settings, json.settings), blocks } };
    },
    async renderSection(type, id, json, globals, { groupClass = '', index } = {}) {
      const { source, schema, section } = harness.sectionObject(type, id, json, globals);
      if (index) section.index = index;
      // Settings of type liquid are Liquid themselves; Shopify renders them first.
      for (const block of section.blocks) {
        const defs = ((schema.blocks || []).find((d) => d.type === block.type) || {}).settings || [];
        for (const def of defs) {
          if (def.type === 'liquid' && block.settings[def.id]) {
            block.settings[def.id] = await engine.parseAndRender(String(block.settings[def.id]), {}, { globals: { ...globals, block } });
          }
        }
      }
      const html = await engine.parseAndRender(source, {}, { globals: { ...globals, section } });
      const cls = ['shopify-section', groupClass, schema.class].filter(Boolean).join(' ');
      return `<div id="shopify-section-${id}" class="${cls}">${html}</div>`;
    },
    // Shopify's built-in `_blocks` section: renders each theme block in order.
    async renderBlocksSection(id, json, globals, { groupClass = '' } = {}) {
      let html = '';
      for (const bid of json.block_order || Object.keys(json.blocks || {})) {
        const b = json.blocks[bid];
        if (b.disabled) continue;
        const source = fs.readFileSync(path.join(root, 'blocks', `${b.type}.liquid`), 'utf8');
        const schema = schemaOf(source);
        const settingsOut = {};
        for (const def of schema.settings || []) {
          if (!def.id) continue;
          let v = (b.settings || {})[def.id] ?? def.default;
          if (def.type === 'link_list') v = v ? globals.__menus[v] || null : null;
          settingsOut[def.id] = resolveResource(def, v, globals);
        }
        html += await engine.parseAndRender(source, {}, {
          globals: { ...globals, block: { id: bid, type: b.type, settings: settingsOut, shopify_attributes: '' } },
        });
      }
      return `<div id="shopify-section-${id}" class="shopify-section ${groupClass}">${html}</div>`;
    },
    groupOverride: {},
    async renderGroup(name, globals) {
      const group = harness.groupOverride[name] || readJson(path.join(root, 'sections', `${name}.json`));
      const groupClass = `shopify-section-group-${name}`;
      let html = '';
      for (const sid of group.order) {
        const s = group.sections[sid];
        if (s.disabled) continue;
        html +=
          s.type === '_blocks'
            ? await harness.renderBlocksSection(`sections--1__${sid}`, s, globals, { groupClass })
            : await harness.renderSection(s.type, `sections--1__${sid}`, s, globals, { groupClass });
      }
      return html;
    },
    // A JSON template's sections in order, like Shopify's content_for_layout.
    async renderTemplate(name, globals, { only } = {}) {
      const template = readJson(path.join(root, 'templates', `${name}.json`));
      let html = '';
      let index = 0;
      for (const sid of template.order) {
        const s = template.sections[sid];
        const id = `template--1__${sid}`;
        if (s.disabled) continue;
        // section.index: the section's 1-based position among the template's rendered sections.
        index++;
        if (only && only !== id) continue;
        html +=
          s.type === '_blocks'
            ? await harness.renderBlocksSection(id, s, globals)
            : await harness.renderSection(s.type, id, s, globals, { index });
      }
      return html;
    },
    async renderLayout(globals, contentForLayout) {
      const source = fs.readFileSync(path.join(root, 'layout/theme.liquid'), 'utf8');
      return engine.parseAndRender(source, {}, { globals: { ...globals, content_for_layout: contentForLayout } });
    },
    async renderPredictiveSearch(q, globals) {
      const terms = q.trim().toLowerCase();
      const products = store.products.filter((p) => p.title.toLowerCase().includes(terms)).slice(0, 4).map(productDrop);
      const predictive_search = {
        performed: true,
        terms: q,
        resources: { products, queries: [], collections: [], pages: [], articles: [] },
      };
      const { source } = harness.sectionObject('predictive-search', 'predictive-search', {}, globals);
      const html = await engine.parseAndRender(source, {}, { globals: { ...globals, predictive_search } });
      return `<div id="shopify-section-predictive-search" class="shopify-section">${html}</div>`;
    },
  };
  return harness;
}

// ---------- serving to Playwright ----------

function svgPlaceholder(name, w, h) {
  if (/Full_Lookup/.test(name))
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><text x="${w * 0.04}" y="${h * 0.72}" textLength="${w * 0.92}" lengthAdjust="spacingAndGlyphs" font-family="Georgia,serif" font-size="${h * 0.7}" fill="#c9a35d">DRESSAR</text></svg>`;
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const tones = ['#d9cbb8', '#b9a48f', '#8c7a6b', '#e6ddd2', '#6f6258', '#c7bba9'];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${tones[hash % tones.length]}"/></svg>`;
}

async function routeTheme(page, { root, fontsDir, harness, globalsFor, onCartAdd, cartSection, cartJson, pages, imageSize }) {
  const mime = { '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const send = (body, type = 'text/html', status = 200) => {
      if (status === 404) (page.missing = page.missing || []).push(url.pathname);
      return route.fulfill({ status, body, contentType: type });
    };
    if (url.hostname === 'cdn.shopify.com' && url.pathname.includes('standard-events'))
      return send(
        'export const createViewEventElement=(B=HTMLElement)=>class extends B{connectedCallback(){}disconnectedCallback(){}dispatchViewEvent(){}};export class PageViewEvent extends Event{constructor(d){super("page-view")}};export class CartErrorEvent extends Event{constructor(){super("cart-error")}};',
        'application/javascript'
      );
    if (url.hostname !== new URL('http://dressar.test').hostname) return send('', 'text/plain', 204);
    if (url.pathname.startsWith('/assets/')) {
      const file = path.join(root, 'assets', path.basename(url.pathname));
      if (!fs.existsSync(file)) return send('', 'text/plain', 404);
      return send(fs.readFileSync(file), mime[path.extname(file)] || 'application/octet-stream');
    }
    if (url.pathname.startsWith('/fonts/')) {
      const [, family, weight, style] = /\/fonts\/(.+)-(\d+)-(\w+)\.woff2/.exec(url.pathname) || [];
      const file = path.join(fontsDir, `${family}-latin-${weight}-${style}.woff2`);
      if (!fs.existsSync(file)) return send('', 'text/plain', 404);
      return send(fs.readFileSync(file), 'font/woff2');
    }
    if (url.pathname.startsWith('/img/')) {
      const name = path.basename(url.pathname);
      const p = harness.store.products.find((x) => name.startsWith(x.handle));
      const [w, h] = /Full_Lookup/.test(name)
        ? [harness.store.logo.width, harness.store.logo.height]
        : (imageSize && imageSize(name)) || (p ? p.image : [1600, 1000]);
      return send(svgPlaceholder(name, w, h), 'image/svg+xml');
    }
    if (url.pathname === '/search/suggest')
      return send(await harness.renderPredictiveSearch(url.searchParams.get('q') || '', globalsFor(url.pathname)));
    if (url.pathname === '/cart/add' && onCartAdd) return send(JSON.stringify(await onCartAdd(route.request())), 'application/json');
    if (url.pathname === '/cart.js' || url.pathname === '/cart.json')
      return send(JSON.stringify(cartJson ? cartJson() : { item_count: 0, items_subtotal_price: 0, items: [] }), 'application/json');
    // Section Rendering API, as Dawn's cart scripts use it: /cart?section_id=cart-drawer
    if (url.pathname === '/cart' && url.searchParams.get('section_id') && cartSection)
      return send(await cartSection(url.searchParams.get('section_id')));
    if (url.pathname.startsWith('/__page')) return send(page.__html || '');
    if (pages) {
      const html = await pages(url, route.request());
      if (html != null) return send(html);
    }
    return send('', 'text/plain', 404);
  });
}

module.exports = { createHarness, routeTheme, readJson };
