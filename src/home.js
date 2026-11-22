/* PowerPunch — Home page interactions.
   Vanilla JS, no dependencies. The WebGL hero light is loaded lazily from
   src/home-light.js only when the device and user preferences allow it. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const motion = !reducedQuery.matches;

  /* ---------- Editable landing copy (storefront API) ---------- */
  const load = typeof ppFetch === 'function' ? ppFetch : fetch;
  load('/api/storefront')
    .then(r => (r.ok ? r.json() : null))
    .then(storefront => {
      const landing = storefront && storefront.landing;
      if (!landing) return;
      document.querySelectorAll('[data-field]').forEach(el => {
        const text = landing[el.dataset.field];
        if (typeof text === 'string' && text.trim()) el.textContent = text;
      });
    })
    .catch(() => {});

  /* ---------- Contact links from the shared store config ---------- */
  if (typeof storeConfig !== 'undefined' && storeConfig) {
    const map = { whatsapp: storeConfig.whatsappContactUrl, instagram: storeConfig.instagramUrl, facebook: storeConfig.facebookUrl };
    document.querySelectorAll('[data-contact]').forEach(link => {
      const url = map[link.dataset.contact];
      if (typeof url === 'string' && url.startsWith('https://')) link.href = url;
    });
  }

  /* ---------- Header + dropdown menu ---------- */
  const header = document.querySelector('[data-header]');
  const menuRoot = document.querySelector('[data-menu-root]');
  const menu = document.querySelector('[data-menu]');
  const toggle = document.querySelector('[data-menu-toggle]');
  let menuOpen = false;

  function setMenu(open, focusToggle = false) {
    if (!menu || !toggle) return;
    menuOpen = open;
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) header.classList.remove('is-hidden');
    if (!open && focusToggle) toggle.focus();
  }
  toggle?.addEventListener('click', () => setMenu(!menuOpen));
  menu?.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('click', e => { if (menuOpen && !menuRoot.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) setMenu(false, true); });
  matchMedia('(min-width: 901px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  /* ---------- Pinned opening (hero -> brand) ---------- */
  const track = document.querySelector('[data-hero-track]');
  if (motion && track) root.classList.add('pin');

  /* ---------- Hero entrance ---------- */
  const hero = document.querySelector('[data-hero]');
  const heroPhoto = hero?.querySelector('[data-hero-photo]');
  let entered = false;
  function enter() {
    if (entered || !hero) return;
    entered = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      hero.classList.add('is-ready');
      setTimeout(() => hero.classList.add('is-settled'), motion ? 2600 : 0);
    }));
  }
  if (heroPhoto) {
    if (heroPhoto.complete) enter();
    else {
      heroPhoto.addEventListener('load', enter, { once: true });
      heroPhoto.addEventListener('error', enter, { once: true });
    }
  }
  setTimeout(enter, 1400);

  /* ---------- Scroll reveals ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && motion) {
    // Masked lines start outside their clipping parent, so observe the parent.
    const targets = new Map();
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        targets.get(entry.target)?.forEach(el => el.classList.add('is-in'));
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    revealEls.forEach(el => {
      const target = el.parentElement?.classList.contains('line') ? el.parentElement : el;
      if (!targets.has(target)) targets.set(target, []);
      targets.get(target).push(el);
      io.observe(target);
    });
  } else {
    revealEls.forEach(el => el.classList.add('is-in'));
  }

  /* ---------- Scroll-linked motion ---------- */
  const statement = document.querySelector('[data-statement]');
  let lastY = scrollY;
  let queued = false;
  let light = null;
  let lastP = 0;

  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  function update() {
    queued = false;
    const y = scrollY;
    const vh = innerHeight;

    if (header && !menuOpen) {
      header.classList.toggle('is-scrolled', y > 24);
      if (y > lastY + 4 && y > vh * 0.6) header.classList.add('is-hidden');
      else if (y < lastY - 4 || y < vh * 0.3) header.classList.remove('is-hidden');
    }
    lastY = y;

    if (!motion) return;

    if (track) {
      const distance = track.offsetHeight - vh;
      const p = distance > 0 ? clamp(-track.getBoundingClientRect().top / distance) : 0;
      if (Math.abs(p - lastP) > 0.0005 || p === 0 || p === 1) {
        lastP = p;
        track.style.setProperty('--p', p.toFixed(4));
        light?.setScroll(clamp(p / 0.5));
      }
    }

    if (statement) {
      const r = statement.getBoundingClientRect();
      if (r.bottom > -vh * 0.2 && r.top < vh * 1.2) {
        const p = clamp((vh - r.top) / (vh + r.height));
        statement.style.setProperty('--si', clamp((p - 0.08) / 0.4).toFixed(4));
        statement.style.setProperty('--sp', clamp((p - 0.12) / 0.5).toFixed(4));
      }
    }
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  update();

  /* ---------- Hero 3D parallax (fine pointers only) ---------- */
  if (hero && finePointer.matches && motion) {
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let raf = 0;
    const step = () => {
      current.x += (target.x - current.x) * 0.075;
      current.y += (target.y - current.y) * 0.075;
      hero.style.setProperty('--px', current.x.toFixed(4));
      hero.style.setProperty('--py', current.y.toFixed(4));
      raf = Math.abs(target.x - current.x) > 0.001 || Math.abs(target.y - current.y) > 0.001 ? requestAnimationFrame(step) : 0;
    };
    // Listen on the pinned frame so the brand scene on top does not block it.
    const area = hero.parentElement;
    area.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      target.x = (e.clientX / innerWidth) * 2 - 1;
      target.y = (e.clientY / innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(step);
      light?.setPointer(e.clientX, e.clientY);
    });
    area.addEventListener('pointerleave', () => {
      target.x = 0; target.y = 0;
      if (!raf) raf = requestAnimationFrame(step);
      light?.releasePointer();
    });
  }

  /* ---------- Category cards: tilt + cursor light (fine pointers only) ---------- */
  if (finePointer.matches && motion) {
    document.querySelectorAll('[data-tilt]').forEach(card => {
      let raf = 0;
      let pending = null;
      const apply = () => {
        raf = 0;
        if (!pending) return;
        const { x, y } = pending;
        card.style.setProperty('--lx', `${(x * 100).toFixed(2)}%`);
        card.style.setProperty('--ly', `${(y * 100).toFixed(2)}%`);
        card.style.setProperty('--ry', `${((x - 0.5) * 9).toFixed(2)}deg`);
        card.style.setProperty('--rx', `${((0.5 - y) * 7).toFixed(2)}deg`);
      };
      card.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') card.classList.add('is-tracking'); });
      card.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = card.getBoundingClientRect();
        pending = { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
        if (!raf) raf = requestAnimationFrame(apply);
      });
      card.addEventListener('pointerleave', () => {
        pending = null;
        card.classList.remove('is-tracking');
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ---------- WebGL hero lighting (lazy, progressive enhancement) ---------- */
  function supportsWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch { return false; }
  }

  function loadLight() {
    const canvas = hero?.querySelector('[data-hero-light]');
    if (!canvas || !heroPhoto || !motion || !supportsWebGL()) return;
    const start = () => import('./home-light.js')
      .then(mod => {
        light = mod.initHeroLight(canvas, heroPhoto, { coarse: !finePointer.matches });
        light?.setScroll(clamp(lastP / 0.5));
      })
      .catch(() => {});
    if (heroPhoto.complete && heroPhoto.naturalWidth) start();
    else heroPhoto.addEventListener('load', start, { once: true });
  }

  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 300));
  if (document.readyState === 'complete') idle(loadLight);
  else addEventListener('load', () => idle(loadLight), { once: true });
})();
