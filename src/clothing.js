/* PowerPunch — Clothing page: showroom, collection and product panel.
   Product data, stock and ordering come from catalog.js and cart.js. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Garments with a clean, accurate cut-out (per colour index → width/height).
  // The two shorts photographed only on a model are intentionally absent.
  const CUTOUTS = {"pp-body-long":{"0":0.8684,"1":0.8748,"2":0.8724,"3":0.8711},"pp-body-zip":{"0":0.8781,"1":0.8382,"2":0.8645,"3":0.8439},"pp-oversize":{"0":0.9538,"1":0.9858,"2":0.9561},"pp-competition":{"0":0.8327,"1":0.8807,"2":0.8675,"3":0.8732,"4":0.8721},"pp-cycle-shorts":{"0":0.9122,"1":0.8943},"p-abc6465b-146f-4a87-9738-0c333270e466":{"0":0.8614},"pp-fleece-pants":{"0":0.5145,"1":0.4782,"2":0.4973,"3":0.4964,"4":0.4873},"pp-cycle-leggings":{"0":0.4936,"1":0.4809},"p-266e336c-5643-4982-82a9-9aa1c534d2cf":{"0":0.9245,"1":0.9753},"pp-three-piece-set":{"0":0.4191},"p-da62e59a-ea96-4893-89b3-f3c1a9e35d03":{"0":0.5303,"1":0.4097,"2":0.4376}};
  const RAIL_ORDER = ['pp-body-long', 'pp-body-zip', 'pp-oversize', 'pp-competition', 'pp-cycle-shorts', 'p-abc6465b-146f-4a87-9738-0c333270e466', 'pp-fleece-pants', 'pp-cycle-leggings', 'p-266e336c-5643-4982-82a9-9aa1c534d2cf', 'pp-three-piece-set', 'p-da62e59a-ea96-4893-89b3-f3c1a9e35d03'];
  const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const TYPE_GROUPS = [
    { id: 'tops', name: 'بلايز', types: ['compression', 'tee'] },
    { id: 'bottoms', name: 'بناطيل', types: ['joggers'] },
    { id: 'shorts', name: 'شورتات', types: ['shorts'] },
    { id: 'sets', name: 'جاكيتات وأطقم', types: ['shell', 'hoodie'] },
  ];
  // Real garment length (world units ≈ metres) so pieces hang at true relative scale.
  const LENGTH = { compression: 0.78, tee: 0.78, shell: 0.78, shorts: 0.56, joggers: 1.08, hoodie: 1.5 };

  const $ = s => document.querySelector(s);
  const showroom = $('[data-showroom]'), track = $('[data-showroom-track]'), fallback = $('[data-fallback]');
  const focusBox = $('[data-focus]'), gridEl = $('[data-grid]'), filtersEl = $('[data-filters]');
  const cutoutUrl = (id, c) => `products/clothing/${id}-${c}.webp`;
  const sizesOf = p => [...new Set(p.variants.map(v => v.size))].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
  const totalStock = p => p.variants.reduce((n, v) => n + v.quantity, 0);
  const priceOf = p => {
    const now = productPrice(p), old = p.salePrice !== undefined && p.salePrice !== null ? (p.originalPrice ?? p.price) : p.originalPrice;
    return `<span dir="ltr">${formatPrice(now)}${old > now ? ` <del>${formatPrice(old)}</del>` : ''}</span>`;
  };
  const firstColor = p => { const i = p.colors.findIndex((_, c) => colorStock(p, c) > 0); return i < 0 ? 0 : i; };
  const showColor = (p, c) => (CUTOUTS[p.id]?.[c] ? c : Number(Object.keys(CUTOUTS[p.id] || { 0: 1 })[0]));

  let rail = [], focusIndex = 0, scene = null, pinned = false;
  const railColor = new Map();

  /* ---------- Focus info ---------- */
  function renderFocus(i, instant) {
    const p = rail[i]; if (!p) return;
    const fill = () => {
      $('[data-focus-name]').textContent = p.name;
      const out = totalStock(p) === 0;
      $('[data-focus-meta]').textContent = out ? 'نفدت الكمية' : `${p.colors.length} ${p.colors.length > 2 ? 'ألوان' : 'لون'} · ${sizesOf(p).join(' ')}`;
      $('[data-focus-price]').innerHTML = priceOf(p);
      focusBox.classList.remove('is-changing');
    };
    if (instant) return fill();
    focusBox.classList.add('is-changing'); clearTimeout(renderFocus.t); renderFocus.t = setTimeout(fill, 180);
  }
  function setFocus(i, { fromScroll = false } = {}) {
    i = Math.max(0, Math.min(rail.length - 1, i));
    if (i === focusIndex && rail.length) { if (!fromScroll) scrollToIndex(i); return; }
    focusIndex = i; renderFocus(i);
    fallback.querySelectorAll('button').forEach((b, k) => b.classList.toggle('is-focus', k === i));
    $('[data-prev]').disabled = i === 0; $('[data-next]').disabled = i === rail.length - 1;
    if (!fromScroll) scrollToIndex(i);
  }

  /* ---------- Scroll ↔ rail position ---------- */
  const stepPx = () => Math.round(innerHeight * (innerWidth < 900 ? 0.4 : 0.34));
  function layoutTrack() {
    if (!pinned) { track.style.height = ''; return; }
    track.style.height = `${innerHeight + stepPx() * (rail.length - 1)}px`;
  }
  function progress() {
    const r = track.getBoundingClientRect(), dist = track.offsetHeight - innerHeight;
    return dist > 0 ? Math.min(1, Math.max(0, -r.top / dist)) : 0;
  }
  function scrollToIndex(i) {
    if (pinned) {
      const top = track.getBoundingClientRect().top + scrollY + stepPx() * i;
      scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
    } else if (scene) {
      scene.setPosition(i);
    } else {
      fallback.children[i]?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    }
  }
  function onScroll() {
    if (!pinned || !rail.length) return;
    const pos = progress() * (rail.length - 1);
    scene?.setPosition(pos);
    const bar = $('[data-progress]'); bar.style.setProperty('--w', `${100 / rail.length}%`); bar.style.setProperty('--x', String(pos));
    const i = Math.round(pos); if (i !== focusIndex) setFocus(i, { fromScroll: true });
  }

  /* ---------- Showroom (fallback rail first, WebGL when available) ---------- */
  function buildRail() {
    rail = RAIL_ORDER.map(id => products.find(p => p.id === id)).filter(Boolean);
    rail.forEach(p => railColor.set(p.id, showColor(p, firstColor(p))));
    fallback.innerHTML = rail.map((p, i) => `<button type="button" data-pick="${i}" tabindex="-1"><img src="${cutoutUrl(p.id, railColor.get(p.id))}" alt="" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async"></button>`).join('');
    fallback.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b) openProduct(rail[Number(b.dataset.pick)]); });
    let t; fallback.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => {
      const mid = fallback.scrollLeft + fallback.clientWidth / 2; let best = 0, bd = Infinity;
      [...fallback.children].forEach((b, k) => { const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = k; } });
      if (!scene) setFocus(best, { fromScroll: true });
    }, 80); }, { passive: true });
    focusIndex = -1; setFocus(0, { fromScroll: true }); renderFocus(0, true);
    $('[data-focus-open]').disabled = false;
  }
  function supportsWebGL() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }
  function startScene() {
    if (!supportsWebGL()) return;
    import('./showroom.js').then(({ createShowroom }) => {
      scene = createShowroom($('[data-canvas]'), rail.map(p => {
        const c = railColor.get(p.id);
        return { id: p.id, url: cutoutUrl(p.id, c), aspect: CUTOUTS[p.id][c], length: LENGTH[p.type] || 0.8 };
      }), { mobile: !fine, motion: !reduced, onPick: i => { if (i === focusIndex) openProduct(rail[i]); else setFocus(i); } });
      if (!scene) return;
      showroom.classList.add('is-3d');
      pinned = !reduced; document.documentElement.classList.toggle('pinned', pinned);
      layoutTrack(); scene.setPosition(focusIndex, true);
      if (pinned) { const pos = progress() * (rail.length - 1); scene.setPosition(pos, true); }
      onScroll();
    }).catch(() => {});
  }

  /* ---------- Collection ---------- */
  let activeFilter = 'all';
  function renderFilters() {
    const groups = [{ id: 'all', name: 'الكل', n: products.length }];
    const sale = products.filter(p => p.salePrice !== undefined && p.salePrice !== null);
    if (sale.length) groups.push({ id: 'sale', name: 'العروض', n: sale.length });
    TYPE_GROUPS.forEach(g => { const n = products.filter(p => g.types.includes(p.type)).length; if (n) groups.push({ id: g.id, name: g.name, n }); });
    filtersEl.innerHTML = groups.map(g => `<button type="button" data-filter="${g.id}" aria-pressed="${g.id === activeFilter}">${esc(g.name)}<span class="count">${g.n}</span></button>`).join('');
  }
  function renderGrid() {
    const g = TYPE_GROUPS.find(x => x.id === activeFilter);
    const list = products.filter(p => activeFilter === 'all' || (activeFilter === 'sale' ? p.salePrice !== undefined && p.salePrice !== null : g?.types.includes(p.type)));
    gridEl.innerHTML = list.map(p => {
      const photo = productPhotos(p, 0)[0], out = totalStock(p) === 0, sale = p.salePrice !== undefined && p.salePrice !== null;
      return `<button type="button" class="card" data-product="${esc(p.id)}" aria-label="${esc(p.name)}">
        <span class="card-media">${photo ? `<img src="${esc(cdn(photo, 600))}" srcset="${esc(cdn(photo, 400))} 400w, ${esc(cdn(photo, 700))} 700w" sizes="(max-width:900px) 46vw, 23vw" alt="" loading="lazy" decoding="async">` : ''}${out ? '<span class="sold-out">نفدت الكمية</span>' : ''}</span>
        <span class="card-body ar"><span><span class="card-name">${esc(p.name)}</span><span class="dots">${p.colors.map(c => `<i style="background:${esc(c[1] || '#555')}" title="${esc(c[0])}"></i>`).join('')}</span></span>
        <span class="card-side">${sale ? '<span class="sale-tag">Sale</span>' : ''}<span class="price">${priceOf(p)}</span></span></span></button>`;
    }).join('') || '<p class="empty-note">لا توجد منتجات في هذه الفئة حالياً.</p>';
  }
  filtersEl.addEventListener('click', e => { const b = e.target.closest('[data-filter]'); if (!b) return; activeFilter = b.dataset.filter; renderFilters(); renderGrid(); });
  gridEl.addEventListener('click', e => { const c = e.target.closest('[data-product]'); if (c) openProduct(products.find(p => p.id === c.dataset.product)); });

  /* ---------- Product panel ---------- */
  let state = null;
  function openProduct(p) {
    if (!p) return;
    const color = firstColor(p);
    state = { p, color, size: firstSize(p, color), photo: 0, qty: 1 };
    renderPanel();
  }
  function firstSize(p, color) { return sizesOf(p).find(s => variantStock(p, color, s) > 0) || null; }
  function renderPanel() {
    const { p, color, size, photo } = state;
    const photos = productPhotos(p, color), stock = size ? variantStock(p, color, size) : 0, max = Math.min(stock, MAX_QUANTITY);
    state.qty = Math.min(Math.max(1, state.qty), Math.max(1, max));
    const reel = productReel(p);
    const html = `
      <div class="gallery-main">${photos[photo] ? `<img src="${esc(cdn(photos[photo], 900))}" alt="${esc(p.name)} — ${esc(p.colors[color][0])}">` : ''}</div>
      ${photos.length > 1 ? `<div class="thumbs" role="group" aria-label="صور المنتج">${photos.map((u, k) => `<button type="button" data-photo="${k}" aria-pressed="${k === photo}" aria-label="الصورة ${k + 1}"><img src="${esc(cdn(u, 160))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      <div><h2 class="sheet-title" id="sheet-title">${esc(p.name)}</h2><p class="price" style="margin-top:4px">${priceOf(p)}</p></div>
      ${p.description ? `<p class="sheet-desc">${esc(p.description)}</p>` : ''}
      <div><div class="field-label">اللون <b>${esc(p.colors[color][0])}</b></div><div class="swatches" role="group" aria-label="اللون">${p.colors.map((c, k) => `<button type="button" data-color="${k}" aria-pressed="${k === color}" aria-label="${esc(c[0])}${colorStock(p, k) ? '' : ' — نفد'}" class="${colorStock(p, k) ? '' : 'is-empty'}" style="background:${esc(c[1] || '#555')}"></button>`).join('')}</div></div>
      <div><div class="field-label">المقاس</div><div class="options sizes" dir="ltr" role="group" aria-label="المقاس">${sizesOf(p).map(s => `<button type="button" data-size="${esc(s)}" aria-pressed="${s === size}" ${variantStock(p, color, s) > 0 ? '' : 'disabled'}>${esc(s)}</button>`).join('')}</div></div>
      <p class="stock-line ${stock ? '' : 'is-out'}">${size ? (stock ? `متوفر: ${stock} قطعة بهذا اللون والمقاس` : 'غير متوفر بهذا اللون والمقاس') : 'هذا اللون غير متوفر حالياً'}</p>
      ${qtyControl(max)}
      <div class="sheet-actions"><button type="button" class="btn-solid" data-buy ${stock ? '' : 'disabled'}>اطلب عبر واتساب</button><button type="button" class="btn-line" data-add ${stock ? '' : 'disabled'}>أضف إلى السلة</button></div>
      ${reel ? `<a class="reel-link" href="${esc(reel)}" target="_blank" rel="noopener">شاهد القطعة في فيديو على إنستغرام</a>` : ''}`;
    const d = Sheet.open(html);
    const out = d.querySelector('[data-qty]'); out.textContent = state.qty; out.value = state.qty;
    d.querySelector('[data-step="-1"]').disabled = state.qty <= 1; d.querySelector('[data-step="1"]').disabled = state.qty >= max;
  }
  Sheet.el.addEventListener('click', e => {
    if (!state || !Sheet.el.open) return;
    const t = e.target.closest('button'); if (!t) return;
    const { p } = state;
    if (t.dataset.color !== undefined) {
      state.color = Number(t.dataset.color); state.photo = 0; state.size = firstSize(p, state.color) || (variantStock(p, state.color, state.size) ? state.size : null); renderPanel();
      const ri = rail.indexOf(p); const c = showColor(p, state.color);
      if (ri >= 0 && CUTOUTS[p.id][state.color] && railColor.get(p.id) !== c) {
        railColor.set(p.id, c); scene?.setTexture(ri, cutoutUrl(p.id, c), CUTOUTS[p.id][c]);
        const img = fallback.children[ri]?.querySelector('img'); if (img) img.src = cutoutUrl(p.id, c);
      }
    } else if (t.dataset.size !== undefined) { state.size = t.dataset.size; renderPanel(); }
    else if (t.dataset.photo !== undefined) { state.photo = Number(t.dataset.photo); renderPanel(); }
    else if (t.dataset.step) { const max = Math.min(variantStock(p, state.color, state.size), MAX_QUANTITY); state.qty = stepQty(Sheet.el, Number(t.dataset.step), max); }
    else if (t.hasAttribute('data-buy') || t.hasAttribute('data-add')) {
      const item = { productId: p.id, color: state.color, size: state.size, quantity: state.qty };
      if (t.hasAttribute('data-buy')) { Sheet.close(); startQuickBuy(item); }
      else if (addOrderItem(item)) { Sheet.close(); toast('تمت الإضافة إلى السلة'); }
    }
  });

  /* ---------- Wiring ---------- */
  $('[data-prev]').addEventListener('click', () => setFocus(focusIndex - 1));
  $('[data-next]').addEventListener('click', () => setFocus(focusIndex + 1));
  $('[data-focus-open]').addEventListener('click', () => openProduct(rail[focusIndex]));
  showroom.addEventListener('keydown', e => { if (e.key === 'ArrowRight') setFocus(focusIndex + 1); if (e.key === 'ArrowLeft') setFocus(focusIndex - 1); });
  addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });
  addEventListener('resize', () => { layoutTrack(); onScroll(); });

  bootStore(err => {
    if (err) { gridEl.innerHTML = '<p class="empty-note">تعذّر تحميل المنتجات حالياً.</p>'; return; }
    buildRail(); renderFilters(); renderGrid();
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 200));
    idle(startScene);
  });
})();
