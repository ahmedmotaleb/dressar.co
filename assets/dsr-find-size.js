/*
 * Dressar "Find your size" (snippets/dsr-find-size.liquid, docs/stages/pdp-ux.md).
 *
 * Recommends a size only from data the store publishes: the "fits ... up to"
 * columns of the product's own size table, otherwise the Dressar size chart.
 * A size fits when every measurement given is at most that size's limit; the
 * smallest such size the product is sold in is the answer, which is the size
 * chart's rule "between two sizes, choose the larger". Height and weight are
 * asked for but never pick a size: the store has no data linking them to
 * sizes. What is typed stays in this page: no request, no storage.
 */
(() => {
  if (customElements.get('dsr-find-size')) return;

  const MEASURES = ['bust', 'waist', 'hips'];
  const HEADERS = { bust: /صدر|bust|chest/i, waist: /وسط|خصر|waist/i, hips: /حوض|أرداف|ارداف|hip/i };
  const FITS = /يناسب|\bfits?\b/i;
  const SIZE_HEADER = /^(المقاس|مقاس|size)$/i;

  const toLatinDigits = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const number = (s) => {
    const m = toLatinDigits(s).match(/\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };
  // "XXL" and "2XL" are the same size (the chart says 2XL, the products XXL).
  const sizeKey = (s) => {
    let k = toLatinDigits(s).toUpperCase().replace(/\s+/g, '');
    if (k === 'XXL') k = '2XL';
    if (k === 'XXXL') k = '3XL';
    return k;
  };
  // Placeholders are __name__: Shopify's Liquid won't take braces inside a string in {{ }}.
  const fill = (text, values) => text.replace(/__(\w+)__/g, (m, k) => (k in values ? values[k] : m));

  // A size table's rows: [{ keys: ['M', '38'], limits: { waist: 76, hips: 106 } }].
  // Only columns that state a body measurement the size fits are read.
  function tableRows(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const trs = [...template.content.querySelectorAll('tr')];
    if (trs.length < 2) return null;
    const cells = (tr) => [...tr.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim());
    const head = cells(trs[0]);
    if (!SIZE_HEADER.test(head[0] || '')) return null;
    const columns = {};
    head.forEach((h, i) => {
      if (i === 0 || !FITS.test(h)) return;
      MEASURES.forEach((m) => {
        if (HEADERS[m].test(h) && !(m in columns)) columns[m] = i;
      });
    });
    if (!Object.keys(columns).length) return null;
    const rows = trs.slice(1).map((tr) => {
      const c = cells(tr);
      const limits = {};
      Object.entries(columns).forEach(([m, i]) => {
        const v = number(c[i] || '');
        if (v) limits[m] = v;
      });
      return { keys: (c[0] || '').split('/').map(sizeKey).filter(Boolean), limits };
    });
    return rows.filter((r) => r.keys.length && Object.keys(r.limits).length === Object.keys(columns).length);
  }

  // The chart setting: one size a line, "36 / S | bust | waist | hips".
  function chartRows(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => line.split('|').map((p) => p.trim()))
      .filter((p) => p.length >= 4 && p[0])
      .map((p) => {
        const limits = {};
        MEASURES.forEach((m, i) => {
          const v = number(p[i + 1]);
          if (v) limits[m] = v;
        });
        return { keys: p[0].split('/').map(sizeKey).filter(Boolean), limits };
      })
      .filter((r) => Object.keys(r.limits).length);
  }

  class DsrFindSize extends HTMLElement {
    connectedCallback() {
      if (this.data) return;
      this.data = JSON.parse(this.querySelector('[data-dsr-fs-data]').textContent);
      this.form = this.querySelector('form');
      this.result = this.querySelector('[data-result]');
      this.error = this.querySelector('[data-error]');
      this.sizes = this.data.options[this.data.sizeIndex] || [];
      this.source = this.pickSource();
      this.setUp();
      this.form.addEventListener('submit', (event) => {
        event.preventDefault();
        this.recommend();
      });
    }

    // The product's sizes matched to rows of its own table, else of the chart.
    pickSource() {
      const match = (rows) => {
        if (!rows || !rows.length) return null;
        const sized = this.sizes
          .map((size) => ({ size, row: rows.find((r) => r.keys.includes(sizeKey(size.name))) }))
          .filter((s) => s.row);
        if (!sized.length) return null;
        const measures = MEASURES.filter((m) => sized.every((s) => m in s.row.limits));
        if (!measures.length) return null;
        sized.sort((a, b) => a.row.limits[measures[0]] - b.row.limits[measures[0]]);
        return { sized, measures };
      };
      for (const html of this.data.tables) {
        const source = match(tableRows(html));
        if (source) return { ...source, basis: this.data.t.basisProduct };
      }
      const chart = match(chartRows(this.data.chart));
      return chart ? { ...chart, basis: this.data.t.basisChart } : null;
    }

    setUp() {
      if (this.sizes.length === 1) {
        this.form.hidden = true;
        this.say([{ text: fill(this.data.t.oneSize, { size: this.sizes[0].name }) }]);
        return;
      }
      if (!this.source) {
        this.form.hidden = true;
        this.say([{ text: this.data.t.noData }]);
        return;
      }
      this.querySelector('[data-measures]').hidden = false;
      this.source.measures.forEach((m) => {
        this.querySelector(`[data-measure="${m}"]`).hidden = false;
      });
    }

    value(name) {
      const input = this.form.elements[name];
      if (!input || input.closest('[hidden]') || input.value.trim() === '') return null;
      const v = parseFloat(toLatinDigits(input.value));
      return Number.isFinite(v) ? v : NaN;
    }

    invalid(name, message) {
      const input = this.form.elements[name];
      const v = this.value(name);
      const bad = v === null ? input.required : Number.isNaN(v) || v < Number(input.min) || v > Number(input.max);
      input.setAttribute('aria-invalid', bad ? 'true' : 'false');
      return bad ? message : null;
    }

    recommend() {
      const t = this.data.t;
      const problems = [
        this.invalid('height', t.invalidHeight),
        this.invalid('weight', t.invalidWeight),
        ...this.source.measures.map((m) => this.invalid(m, t.invalidMeasure)),
      ].filter(Boolean);
      this.error.hidden = !problems.length;
      this.error.textContent = [...new Set(problems)].join(' ');
      if (problems.length) {
        this.result.replaceChildren();
        return;
      }

      const height = this.value('height');
      const notes = [];
      const min = Number(this.data.heightMin);
      const max = Number(this.data.heightMax);
      if (min && max && (height < min || height > max)) notes.push({ text: fill(t.heightNote, { min, max }), small: true });
      notes.push({ text: t.weightNote, small: true });

      const given = this.source.measures.filter((m) => this.value(m) !== null);
      if (!given.length) {
        const names = this.source.measures.map((m) => t[m]).join(t.or);
        this.say([{ text: fill(t.need, { list: names }), strong: true }, ...notes]);
        return;
      }

      const fit = this.source.sized.find((s) => given.every((m) => this.value(m) <= s.row.limits[m]));
      if (!fit) {
        const largest = this.source.sized[this.source.sized.length - 1];
        this.say([{ text: fill(t.tooBig, { size: largest.size.name }), strong: true }, ...notes]);
        return;
      }

      const limits = this.source.measures
        .map((m) => `${t[m]} ${fit.row.limits[m]} ${t.cm}`)
        .join(' · ');
      const stock = this.availability(fit.size);
      const lines = [
        { text: fill(t.result, { size: fit.size.name }), big: true },
        { text: `${fill(t.fits, { size: fit.size.name })} ${limits}`, small: true },
        { text: this.source.basis, small: true },
      ];
      if (stock) lines.push({ text: stock.text, stock: stock.available ? 'in' : 'out' });
      this.say([...lines, ...notes], stock && stock.available ? fit.size : null);
    }

    // Whether the size is in stock with the options chosen on the page now
    // (the colour, and any other option), from the product's variants.
    availability(size) {
      const picker = document.getElementById(`variant-selects-${this.dataset.section}`);
      const chosenIds = picker ? picker.selectedOptionValues || [] : [];
      const chosen = this.data.options.map((values, i) => {
        if (i === this.data.sizeIndex) return size.name;
        const v = values.find((value) => chosenIds.map(String).includes(String(value.id)));
        return v ? v.name : null;
      });
      const variant = this.data.variants.find(([options]) => options.every((o, i) => chosen[i] === null || o === chosen[i]));
      if (!variant) return null;
      const t = this.data.t;
      const color = this.data.colorIndex >= 0 ? chosen[this.data.colorIndex] : null;
      if (variant[1]) return { available: true, text: color ? fill(t.available, { color }) : t.availablePlain };
      return { available: false, text: color ? fill(t.soldOut, { color }) : t.soldOutPlain };
    }

    say(lines, choose = null) {
      const nodes = lines.map((line) => {
        const p = document.createElement('p');
        p.className = 'dsr-fs__line';
        if (line.big) p.classList.add('dsr-fs__line--size');
        if (line.strong) p.classList.add('dsr-fs__line--strong');
        if (line.small) p.classList.add('dsr-fs__line--note');
        if (line.stock) p.classList.add(`dsr-fs__line--${line.stock}`);
        p.textContent = line.text;
        return p;
      });
      if (choose) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button button--secondary dsr-fs__choose';
        button.textContent = fill(this.data.t.choose, { size: choose.name });
        button.addEventListener('click', () => this.choose(choose));
        nodes.push(button);
      }
      this.result.replaceChildren(...nodes);
    }

    // Picks the size in the page's own picker (never adds to cart).
    choose(size) {
      const picker = document.getElementById(`variant-selects-${this.dataset.section}`);
      const input = picker && picker.querySelector(`input[data-option-value-id="${size.id}"]`);
      if (input && !input.checked) input.click();
      const select = !input && picker && picker.querySelector(`select option[data-option-value-id="${size.id}"]`);
      if (select) {
        select.parentElement.value = select.value;
        select.parentElement.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const modal = this.closest('modal-dialog');
      if (modal) modal.hide();
    }
  }

  customElements.define('dsr-find-size', DsrFindSize);
})();
