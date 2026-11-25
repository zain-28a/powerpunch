/* PowerPunch — Supplements page: product lab and catalog.
   All names, weights, flavours, prices and stock come from the storefront data. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  // Featured products per category (centre first). Only products whose
  // photos isolate cleanly; the cut-outs live in products/supplements/.
  const FEATURED = {
    protein: ['sup-50b5793a-d95a-4117-8f61-f31ce97d691e', 'sup-a3c60fb8-2b7e-4387-8f94-057cb32eabb9', 'sup-54dfe39e-0f0e-4e3f-b1a3-6b8193d9f382'],
    creatine: ['sup-36545bb6-f56f-4b63-91ba-fab46fc4a44b', 'sup-92eba9a7-711f-458b-ac86-f4f4bef47ee4', 'sup-54ffbb50-d552-4647-aa38-441cb2492176'],
    'pre-workout': ['sup-c65856e8-1aa7-4582-9f19-978cb0e528a7', 'sup-717292c6-661a-4e1f-b432-8d66462d703b', 'sup-a0d2c5ba-3197-45fe-a30f-b14f4570066d'],
    'cat-746bb801-eaad-4a74-98a0-063017a3d398': ['sup-2eb78ec7-a05c-4ef8-9fa5-d978425d0220'],
    'cat-eb8a3ae9-356f-4f86-bdc0-ee22f62434c7': ['sup-4dc01054-3f47-4664-97cb-e32c3a19d7d4', 'sup-de2cd038-9d7b-4474-993d-2ca2b96b61c8', 'sup-e112270b-e348-42d2-8058-e4f17b9778cf'],
    'cat-f434a7e6-65a2-4c75-95e9-d4b05d6b1c27': ['sup-2ce56554-7d1a-4aad-bb45-777e7926a6c1', 'sup-743e62d1-468b-44f6-9de6-78144835efd5', 'sup-19081150-f983-4f5b-b7e6-9d765881d83e'],
  };
  const $ = s => document.querySelector(s);
  const stage = $('[data-stage]'), labTabs = $('[data-lab-tabs]'), focusBox = $('[data-focus]');
  const gridEl = $('[data-grid]'), filtersEl = $('[data-filters]'), searchEl = $('[data-search]');
  const data = () => window.supplementCatalog;
  const byId = id => data().products.find(p => p.id === id);
  const flavorsOf = p => supplementFlavors(p);
  const stockOf = (p, w, f) => p.demo ? MAX_QUANTITY : (p.variants?.find(v => v.weight === (w ?? '') && v.flavor === (f ?? ''))?.quantity || 0);
  const totalStock = p => p.demo ? 1 : (p.variants || []).reduce((n, v) => n + v.quantity, 0);
  const photosOf = p => [...new Set([p.image, ...(Array.isArray(p.images) ? p.images : [])].filter(Boolean))];
  const metaOf = p => [p.weights?.join(' · '), flavorsOf(p).length ? `${flavorsOf(p).length} ${flavorsOf(p).length > 2 ? 'نكهات' : 'نكهة'}` : ''].filter(Boolean).join(' · ');

  /* ---------- Lab ---------- */
  let labCat = null, labItems = [], labFocus = 0;
  function labCategories() { return data().categories.filter(c => (FEATURED[c.id] || []).some(byId)); }
  function renderLabTabs() {
    labTabs.innerHTML = labCategories().map(c => `<button type="button" data-lab-cat="${esc(c.id)}" aria-pressed="${c.id === labCat}">${esc(c.name)}</button>`).join('');
  }
  function layout() {
    const n = labItems.length;
    [...stage.children].forEach((el, k) => {
      const slot = (k - labFocus + n) % n; // 0 = centre, 1 = right, n-1 = left
      const side = slot === 0 ? 0 : (slot === 1 ? 1 : -1);
      const x = n === 1 ? 50 : 50 + side * 33, h = side ? 70 : 100, w = side ? 27 : 38;
      el.style.left = `${x}%`; el.style.height = `${h}%`; el.style.width = `${w}%`;
      el.style.transform = `translateX(-50%)`;
      el.style.zIndex = side ? 1 : 2;
      el.classList.toggle('is-side', !!side);
      el.setAttribute('aria-label', `${byId(labItems[k]).name}${side ? '' : ' — المنتج المعروض'}`);
    });
  }
  function setLabCategory(id, first) {
    labCat = id; labFocus = 0;
    labItems = (FEATURED[id] || []).filter(byId);
    renderLabTabs();
    const fill = () => {
      stage.innerHTML = labItems.map((pid, k) => `<button type="button" class="lab-item" data-lab-item="${k}"><img src="products/supplements/${pid}.webp" alt="" decoding="async"></button>`).join('');
      layout(); renderFocus(true);
      requestAnimationFrame(() => stage.classList.remove('is-swapping'));
    };
    if (first || reduced) { fill(); return; }
    stage.classList.add('is-swapping'); setTimeout(fill, 320);
  }
  function renderFocus(instant) {
    const p = byId(labItems[labFocus]); if (!p) return;
    const fill = () => {
      $('[data-focus-name]').textContent = p.name;
      $('[data-focus-meta]').textContent = totalStock(p) ? metaOf(p) : 'نفدت الكمية';
      $('[data-focus-price]').innerHTML = money(p.price);
      focusBox.classList.remove('is-changing');
    };
    const one = labItems.length < 2; $('[data-prev]').disabled = one; $('[data-next]').disabled = one;
    if (instant) return fill();
    focusBox.classList.add('is-changing'); clearTimeout(renderFocus.t); renderFocus.t = setTimeout(fill, 180);
  }
  function moveFocus(d) { if (labItems.length < 2) return; labFocus = (labFocus + d + labItems.length) % labItems.length; layout(); renderFocus(); }
  labTabs.addEventListener('click', e => { const b = e.target.closest('[data-lab-cat]'); if (b && b.dataset.labCat !== labCat) setLabCategory(b.dataset.labCat); });
  stage.addEventListener('click', e => {
    const b = e.target.closest('[data-lab-item]'); if (!b) return;
    const k = Number(b.dataset.labItem);
    if (k === labFocus) openProduct(byId(labItems[k])); else { labFocus = k; layout(); renderFocus(); }
  });
  $('[data-prev]').addEventListener('click', () => moveFocus(-1));
  $('[data-next]').addEventListener('click', () => moveFocus(1));
  $('[data-focus-open]').addEventListener('click', () => openProduct(byId(labItems[labFocus])));
  // Subtle 2.5D tilt of the packaging photos with the pointer (desktop only).
  if (fine && !reduced) {
    let raf = 0, nx = 0, ny = 0;
    $('[data-lab]').addEventListener('pointermove', e => {
      nx = e.clientX / innerWidth - 0.5; ny = e.clientY / innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; stage.style.setProperty('--ry', `${(nx * 10).toFixed(2)}deg`); stage.style.setProperty('--rx', `${(-ny * 5).toFixed(2)}deg`); });
    });
    $('[data-lab]').addEventListener('pointerleave', () => { stage.style.setProperty('--ry', '0deg'); stage.style.setProperty('--rx', '0deg'); });
  }

  /* ---------- Catalog ---------- */
  let active = 'all', query = '';
  const norm = s => String(s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
  function renderFilters() {
    const P = data().products;
    const tabs = [{ id: 'all', name: 'الكل', n: P.length }, ...data().categories.map(c => ({ id: c.id, name: c.name, n: P.filter(p => p.categoryId === c.id).length })).filter(c => c.n)];
    filtersEl.innerHTML = tabs.map(t => `<button type="button" data-filter="${esc(t.id)}" aria-pressed="${t.id === active}">${esc(t.name)}<span class="count">${t.n}</span></button>`).join('');
  }
  function renderGrid() {
    const q = norm(query);
    const list = data().products.filter(p => (active === 'all' || p.categoryId === active) && (!q || norm(p.name).includes(q) || norm(p.description).includes(q)));
    gridEl.innerHTML = list.map(p => {
      const img = p.image || photosOf(p)[0];
      return `<button type="button" class="card" data-product="${esc(p.id)}" aria-label="${esc(p.name)}">
        <span class="card-media square">${img ? `<img src="${esc(cdn(img, 500))}" srcset="${esc(cdn(img, 360))} 360w, ${esc(cdn(img, 640))} 640w" sizes="(max-width:900px) 46vw, 23vw" alt="" loading="lazy" decoding="async">` : ''}${totalStock(p) ? '' : '<span class="sold-out">نفدت الكمية</span>'}</span>
        <span class="card-body ar"><span><span class="card-name">${esc(p.name)}</span><span class="card-sub">${esc(metaOf(p))}</span></span><span class="card-side"><span class="price">${money(p.price)}</span></span></span></button>`;
    }).join('') || '<p class="empty-note">لا توجد منتجات مطابقة.</p>';
  }
  filtersEl.addEventListener('click', e => { const b = e.target.closest('[data-filter]'); if (!b) return; active = b.dataset.filter; renderFilters(); renderGrid(); if (FEATURED[active] && active !== labCat) setLabCategory(active); });
  let st; searchEl.addEventListener('input', () => { clearTimeout(st); st = setTimeout(() => { query = searchEl.value; renderGrid(); }, 120); });
  gridEl.addEventListener('click', e => { const c = e.target.closest('[data-product]'); if (c) openProduct(byId(c.dataset.product)); });

  /* ---------- Product panel ---------- */
  let state = null;
  function openProduct(p) {
    if (!p) return;
    const weights = p.weights || [], flavors = flavorsOf(p);
    let weight = weights[0] ?? '', flavor = flavors[0] ?? '';
    const ok = weights.flatMap(w => (flavors.length ? flavors : ['']).map(f => [w, f])).find(([w, f]) => stockOf(p, w, f) > 0);
    if (ok) [weight, flavor] = ok;
    state = { p, weight, flavor, photo: 0, qty: 1 };
    renderPanel();
  }
  function renderPanel() {
    const { p, weight, flavor, photo } = state, photos = photosOf(p), flavors = flavorsOf(p), weights = p.weights || [];
    const stock = stockOf(p, weight, flavor), max = Math.min(stock, MAX_QUANTITY);
    state.qty = Math.min(Math.max(1, state.qty), Math.max(1, max));
    const html = `
      <div class="gallery-main">${photos[photo] ? `<img src="${esc(cdn(photos[photo], 900))}" alt="${esc(p.name)}">` : ''}</div>
      ${photos.length > 1 ? `<div class="thumbs" role="group" aria-label="صور المنتج">${photos.map((u, k) => `<button type="button" data-photo="${k}" aria-pressed="${k === photo}" aria-label="الصورة ${k + 1}"><img src="${esc(cdn(u, 160))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      <div><h2 class="sheet-title" id="sheet-title">${esc(p.name)}</h2><p class="price" style="margin-top:4px">${money(p.price)}</p></div>
      ${weights.length ? `<div><div class="field-label">الوزن</div>${weights.length > 1 ? `<div class="options" role="group" aria-label="الوزن">${weights.map(w => `<button type="button" data-weight="${esc(w)}" aria-pressed="${w === weight}" ${(flavors.length ? flavors : ['']).some(f => stockOf(p, w, f) > 0) ? '' : 'disabled'}>${esc(w)}</button>`).join('')}</div>` : `<p class="fixed-option">${esc(weights[0])}</p>`}</div>` : ''}
      ${flavors.length ? `<div><div class="field-label">النكهة</div><div class="options" role="group" aria-label="النكهة">${flavors.map(f => `<button type="button" data-flavor="${esc(f)}" aria-pressed="${f === flavor}" ${stockOf(p, weight, f) > 0 ? '' : 'disabled'}>${esc(f)}</button>`).join('')}</div></div>` : ''}
      <p class="stock-line ${stock ? '' : 'is-out'}">${stock ? 'متوفر' : 'غير متوفر حالياً'}</p>
      ${p.description ? `<p class="sheet-desc">${esc(p.description)}</p>` : ''}
      ${qtyControl(max)}
      <div class="sheet-actions"><button type="button" class="btn-solid" data-buy ${stock ? '' : 'disabled'}>اطلب عبر واتساب</button><button type="button" class="btn-line" data-add ${stock ? '' : 'disabled'}>أضف إلى السلة</button></div>`;
    const d = Sheet.open(html);
    const out = d.querySelector('[data-qty]'); out.textContent = state.qty; out.value = state.qty;
    d.querySelector('[data-step="-1"]').disabled = state.qty <= 1; d.querySelector('[data-step="1"]').disabled = state.qty >= max;
  }
  Sheet.el.addEventListener('click', e => {
    if (!state || !Sheet.el.open) return;
    const t = e.target.closest('button'); if (!t || t.disabled) return;
    const { p } = state;
    if (t.dataset.weight !== undefined) { state.weight = t.dataset.weight; if (!stockOf(p, state.weight, state.flavor)) state.flavor = (flavorsOf(p).find(f => stockOf(p, state.weight, f) > 0)) ?? state.flavor; renderPanel(); }
    else if (t.dataset.flavor !== undefined) { state.flavor = t.dataset.flavor; renderPanel(); }
    else if (t.dataset.photo !== undefined) { state.photo = Number(t.dataset.photo); renderPanel(); }
    else if (t.dataset.step) { state.qty = stepQty(Sheet.el, Number(t.dataset.step), Math.min(stockOf(p, state.weight, state.flavor), MAX_QUANTITY)); }
    else if (t.hasAttribute('data-buy') || t.hasAttribute('data-add')) {
      const item = { supplementId: p.id, weight: state.weight, flavor: state.flavor, quantity: state.qty };
      if (t.hasAttribute('data-buy')) { Sheet.close(); startQuickBuy(item); }
      else if (addOrderItem(item)) { Sheet.close(); toast('تمت الإضافة إلى السلة'); }
    }
  });

  bootStore(err => {
    if (err) { gridEl.innerHTML = '<p class="empty-note">تعذّر تحميل المنتجات حالياً.</p>'; return; }
    const first = labCategories()[0]; if (first) setLabCategory(first.id, true); else $('[data-lab]').hidden = true;
    $('[data-focus-open]').disabled = !first;
    renderFilters(); renderGrid();
  });
})();
