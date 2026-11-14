// Measures every product card with a photo on a page (docs/stages/card-v2.md) and
// groups the cards by grid row, so the same checks run on the local harness
// (tests/card-upgrade.test.js) and on the real preview theme
// (tests/preview-cards.check.js). Runs in the page: pass it to page.evaluate.
'use strict';

function measureCardLayout() {
  const box = (e) => e.getBoundingClientRect();
  const cs = (e) => getComputedStyle(e);
  const r = (n) => Math.round(n * 10) / 10;
  const cards = [...document.querySelectorAll('.product-card-wrapper')]
    .filter((card) => card.querySelector('.card__inner .media img') && card.getClientRects().length && !card.closest('[hidden], .hidden'))
    .map((card) => {
      const cb = box(card.querySelector('.card'));
      const inner = box(card.querySelector('.card__inner'));
      const heading = card.querySelector('.card__heading.h5');
      const link = heading.querySelector('a');
      const price = card.querySelector('.card-information > .price');
      const rating = card.querySelector('.card-information > .dsr-card-rating');
      const colors = card.querySelector('.dsr-card-colors-row');
      const sizesRow = card.querySelector('.dsr-card-sizes-row');
      const sizeButtons = [...card.querySelectorAll('.dsr-card-size')];
      const dots = [...card.querySelectorAll('.dsr-card-swatch .swatch')];
      const dotBoxes = dots.map(box);
      const bag = card.querySelector('.dsr-quick-add__button');
      const badge = [...card.querySelectorAll('.card__inner .badge')].find((b) => !b.hidden && b.getClientRects().length);
      const priceShown = [...card.querySelectorAll('.card-information .price .price-item--last, .card-information .price .price__regular .price-item--regular')].find((e) => e.getClientRects().length);
      // The struck-through price as shown: its wrapper clips it when there is no room.
      const compareEl = card.querySelector('.card-information .price--on-sale .price__sale s');
      const compare = compareEl ? compareEl.parentElement : null;
      const options = card.querySelector('.dsr-card-options');
      const bagBefore = bag && getComputedStyle(bag, '::before');
      return {
        href: link.getAttribute('href'),
        title: link.textContent.trim(),
        top: r(cb.top),
        bottom: r(cb.bottom),
        left: r(cb.left),
        right: r(cb.right),
        height: r(cb.height),
        imageBottom: r(inner.bottom),
        titleTop: r(box(heading).top),
        titleHeight: r(box(heading).height),
        titleLineHeight: parseFloat(cs(heading).lineHeight),
        titleOneLine: cs(link).whiteSpace === 'nowrap' && cs(link).textOverflow === 'ellipsis' && cs(link).overflow === 'hidden' && link.getClientRects().length === 1,
        titleCut: link.scrollWidth > link.clientWidth + 1,
        titleFont: [cs(heading).fontSize, cs(heading).fontWeight],
        priceTop: r(box(price).top),
        priceHeight: r(box(price).height),
        priceFont: priceShown ? [cs(priceShown).fontSize, cs(priceShown).fontWeight] : null,
        priceRect: priceShown ? box(priceShown).toJSON() : null,
        compareRect: compare ? box(compare).toJSON() : null,
        // Whole or not at all: shown on the price line, or moved to its hidden second line.
        compareShown: compare ? box(compare).top < box(price).bottom - 1 : false,
        compareCut: compare ? box(compare).top < box(price).bottom - 1 && (compare.scrollWidth > compare.clientWidth + 1 || box(compare).right > box(price).right + 0.5 || box(compare).left < box(price).left - 0.5) : false,
        rating: rating && { rect: box(rating).toJSON(), font: cs(rating).fontSize, text: rating.textContent.replace(/\s+/g, ' ').trim(), label: rating.getAttribute('aria-label') },
        colorsTop: colors ? r(box(colors).top) : null,
        sizesTop: sizesRow ? r(box(sizesRow).top) : null,
        sizes: sizeButtons.map((b) => ({ h: r(box(b).height), top: r(box(b).top), radius: cs(b).borderTopLeftRadius, font: cs(b).fontSize })),
        sizesScroll: sizesRow && sizesRow.querySelector('.dsr-card-sizes') ? cs(sizesRow.querySelector('.dsr-card-sizes')).overflowX : null,
        dots: dotBoxes.map((d) => r(d.width)),
        dotRadius: dots.map((d) => cs(d).borderTopLeftRadius),
        dotGaps: dotBoxes.slice(1).map((d, i) => Math.round(Math.abs(d.left - dotBoxes[i].left) - dotBoxes[i].width)),
        dotsInside: dotBoxes.every((d) => d.left >= cb.left - 0.5 && d.right <= cb.right + 0.5),
        labels: card.querySelectorAll('.dsr-card-row__label').length,
        dividers: options ? [cs(options).borderTopWidth, colors ? cs(colors).borderTopWidth : '0px', sizesRow ? cs(sizesRow).borderTopWidth : '0px'] : [],
        padding: cs(card.querySelector('.card > .card__content')).paddingTop,
        background: cs(card.querySelector('.card')).backgroundColor,
        radius: cs(card.querySelector('.card')).borderTopLeftRadius,
        bag: bag && {
          w: r(box(bag).width),
          h: r(box(bag).height),
          radius: cs(bag).borderTopLeftRadius,
          bg: cs(bag).backgroundColor,
          bagIcon: Boolean(bag.querySelector('svg.icon-cart-empty')),
          bottom: Math.round(inner.bottom - box(bag).bottom),
          right: Math.round(inner.right - box(bag).right),
          touch: bagBefore ? Math.round(box(bag).width - 2 * parseFloat(bagBefore.left)) : 0,
          rect: box(bag).toJSON(),
          disabled: bag.disabled,
        },
        badge: badge && { text: [...badge.querySelectorAll('[aria-hidden="true"]')].map((s) => s.textContent.trim()).join('') || badge.textContent.trim(), rect: box(badge).toJSON() },
      };
    });
  // Grid rows: cards whose tops are within 2px.
  const rows = [];
  cards.forEach((c) => {
    const row = rows.find((rw) => Math.abs(rw[0].top - c.top) <= 2);
    if (row) row.push(c);
    else rows.push([c]);
  });
  return {
    cards,
    rows: rows.filter((rw) => rw.length > 1),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}

// The spread (max - min) of a measure across one row of cards.
const spread = (row, key) => {
  const v = row.map((c) => c[key]).filter((x) => x !== null && x !== undefined);
  return v.length ? Math.max(...v) - Math.min(...v) : 0;
};

const ALIGNED = ['height', 'imageBottom', 'titleTop', 'priceTop', 'colorsTop', 'sizesTop', 'bottom'];

module.exports = { measureCardLayout, spread, ALIGNED };
