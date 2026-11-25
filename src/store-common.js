/* PowerPunch — shared behaviour for the shop pages: header, mobile menu,
   bag button and the product panel. Ordering uses the existing cart.js. */
(() => {
  'use strict';
  const header = document.querySelector('[data-header]');
  const menuRoot = document.querySelector('[data-menu-root]');
  const menu = document.querySelector('[data-menu]');
  const toggle = document.querySelector('[data-menu-toggle]');
  let open = false;
  const setMenu = (v, focus = false) => {
    if (!menu || !toggle) return;
    open = v; menu.hidden = !v;
    toggle.setAttribute('aria-expanded', String(v));
    toggle.setAttribute('aria-label', v ? 'Close menu' : 'Open menu');
    if (!v && focus) toggle.focus();
  };
  toggle?.addEventListener('click', () => setMenu(!open));
  document.addEventListener('click', e => { if (open && !menuRoot.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) setMenu(false, true); });
  matchMedia('(min-width: 901px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  let lastY = scrollY, queued = false;
  addEventListener('scroll', () => {
    if (queued) return; queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const y = scrollY;
      header?.classList.toggle('is-scrolled', y > 24);
      if (!open && !document.querySelector('dialog[open]')) {
        if (y > lastY + 4 && y > innerHeight * 0.6) header?.classList.add('is-hidden');
        else if (y < lastY - 4 || y < innerHeight * 0.3) header?.classList.remove('is-hidden');
      }
      lastY = y;
    });
  }, { passive: true });

  if (typeof storeConfig !== 'undefined') {
    const map = { whatsapp: storeConfig.whatsappContactUrl, instagram: storeConfig.instagramUrl, facebook: storeConfig.facebookUrl };
    document.querySelectorAll('[data-contact]').forEach(a => { const u = map[a.dataset.contact]; if (typeof u === 'string' && u.startsWith('https://')) a.href = u; });
  }
  if (!document.querySelector('.toast')) document.body.insertAdjacentHTML('beforeend', '<div class="toast" role="status" aria-live="polite"></div>');
})();

/* Bag button + catalog boot. Pages call bootStore(callback). */
function bootStore(onReady) {
  const bag = document.querySelector('[data-bag]');
  const syncBag = () => { const n = Number(bag?.querySelector('.bag-count')?.textContent || 0); bag?.classList.toggle('has-items', n > 0); };
  if (bag) {
    bag.addEventListener('click', () => { if (!bag.disabled) openCart(); });
    new MutationObserver(syncBag).observe(bag.querySelector('.bag-count'), { childList: true, characterData: true, subtree: true });
  }
  loadCatalog().then(() => {
    cart = readCart();
    initializeCart({ social: false });
    if (bag) bag.disabled = false;
    syncBag();
    onReady?.();
  }).catch(() => {
    onReady?.(new Error('catalog'));
    toast('تعذّر تحميل المنتجات. حدّث الصفحة وحاول من جديد.');
  });
}

/* Product panel (<dialog class="sheet">). Returns the dialog element. */
const Sheet = (() => {
  let dialog, returnFocus;
  function ensure() {
    if (dialog) return dialog;
    document.body.insertAdjacentHTML('beforeend', '<dialog class="sheet" aria-labelledby="sheet-title"><div class="sheet-inner" dir="rtl" lang="ar"></div></dialog>');
    dialog = document.querySelector('dialog.sheet');
    dialog.addEventListener('click', e => { if (e.target === dialog || e.target.closest('[data-sheet-close]')) close(); });
    dialog.addEventListener('close', () => { document.body.style.overflow = ''; returnFocus?.focus?.(); });
    return dialog;
  }
  function open(html) {
    ensure(); returnFocus = document.activeElement;
    dialog.firstElementChild.innerHTML = `<button type="button" class="sheet-close" data-sheet-close dir="ltr">Close <span aria-hidden="true">✕</span></button>${html}`;
    if (!dialog.open) dialog.showModal();
    dialog.firstElementChild.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    return dialog;
  }
  function close() { if (dialog?.open) dialog.close(); }
  return { open, close, get el() { return ensure(); } };
})();

const esc = v => escapeHTML(v ?? '');
const money = v => `<span dir="ltr">${formatPrice(Number(v) || 0)}</span>`;
const cdn = (url, w) => typeof url === 'string' && url.includes('/image/upload/f_auto,q_auto/') ? url.replace('/f_auto,q_auto/', `/f_auto,q_auto,w_${w}/`) : url;
function qtyControl(max) {
  return `<div><div class="field-label">الكمية</div><div class="qty" role="group" aria-label="الكمية"><button type="button" data-step="-1" aria-label="إنقاص الكمية" disabled>−</button><output data-qty>1</output><button type="button" data-step="1" aria-label="زيادة الكمية" ${max > 1 ? '' : 'disabled'}>+</button></div></div>`;
}
function stepQty(root, delta, max) {
  const out = root.querySelector('[data-qty]'); if (!out) return 1;
  const v = Math.max(1, Math.min(max, Number(out.value || out.textContent) + delta));
  out.textContent = v; out.value = v;
  root.querySelector('[data-step="-1"]').disabled = v <= 1;
  root.querySelector('[data-step="1"]').disabled = v >= max;
  return v;
}
