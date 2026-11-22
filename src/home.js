/* PowerPunch — Home page interactions.
   Vanilla JS, no dependencies. Heavy WebGL lighting is loaded lazily from
   /src/home-light.js only when the device and user preferences allow it. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

  /* ---------- Editable landing copy (existing storefront API) ---------- */
  ppFetch('/api/storefront')
    .then(r => (r.ok ? r.json() : null))
    .then(storefront => {
      const landing = storefront && storefront.landing;
      if (!landing) return;
      document.querySelectorAll('[data-field]').forEach(el => {
        const text = landing[el.dataset.field];
        if (typeof text === 'string' && text.trim()) el.textContent = text;
      });
    })
    .catch(() => {}); // Built-in copy stays visible when the API is unavailable.

  /* ---------- Contact links from the shared store config ---------- */
  if (typeof storeConfig !== 'undefined' && storeConfig) {
    const map = {
      whatsapp: storeConfig.whatsappContactUrl,
      instagram: storeConfig.instagramUrl,
      facebook: storeConfig.facebookUrl,
    };
    document.querySelectorAll('[data-contact]').forEach(link => {
      const url = map[link.dataset.contact];
      if (typeof url === 'string' && url.startsWith('https://')) link.href = url;
    });
  }

  /* ---------- Header ---------- */
  const header = document.querySelector('[data-header]');
  const menu = document.querySelector('[data-menu]');
  const toggle = document.querySelector('[data-menu-toggle]');
  let menuOpen = false;

  function setMenu(open) {
    if (!menu || !toggle) return;
    menuOpen = open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.menu-toggle-label').textContent = open ? 'Close' : 'Menu';
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      document.body.style.overflow = 'hidden';
      header.classList.add('is-scrolled');
      header.classList.remove('is-hidden');
      menu.querySelector('a')?.focus();
    } else {
      menu.classList.remove('is-open');
      menu.hidden = true;
      document.body.style.overflow = '';
      onScroll();
    }
  }
  toggle?.addEventListener('click', () => setMenu(!menuOpen));
  menu?.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menuOpen) { setMenu(false); toggle.focus(); }
  });
  matchMedia('(min-width: 901px)').addEventListener('change', e => { if (e.matches && menuOpen) setMenu(false); });

  /* ---------- Hero entrance ---------- */
  const hero = document.querySelector('[data-hero]');
  const heroPhoto = hero?.querySelector('[data-hero-photo]');
  let entered = false;
  function enter() {
    if (entered || !hero) return;
    entered = true;
    // Two frames so the initial (hidden) state is painted before transitioning.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      hero.classList.add('is-ready');
      setTimeout(() => hero.classList.add('is-settled'), reducedQuery.matches ? 0 : 2600);
    }));
  }
  if (heroPhoto) {
    if (heroPhoto.complete) enter();
    else {
      heroPhoto.addEventListener('load', enter, { once: true });
      heroPhoto.addEventListener('error', enter, { once: true });
    }
  }
  setTimeout(enter, 1400); // Never keep the hero hidden on a slow connection.

  /* ---------- Scroll reveals ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reducedQuery.matches) {
    // Masked lines (.line > .line-inner) start outside their clipping parent,
    // so the parent is observed instead of the translated element itself.
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
  const intro = document.querySelector('.intro');
  const statement = document.querySelector('[data-statement]');
  const railCount = document.querySelector('[data-rail-count]');
  let lastY = scrollY;
  let scrollQueued = false;
  let heroProgress = 0;
  let light = null; // WebGL controller, once loaded

  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(updateScroll);
  }

  function updateScroll() {
    scrollQueued = false;
    const y = scrollY;
    const vh = innerHeight;

    if (header && !menuOpen) {
      header.classList.toggle('is-scrolled', y > 24);
      // Hide while scrolling down past the hero, show when scrolling up.
      const goingDown = y > lastY + 4;
      const goingUp = y < lastY - 4;
      if (goingDown && y > vh * 0.9) header.classList.add('is-hidden');
      else if (goingUp || y < vh * 0.5) header.classList.remove('is-hidden');
    }
    lastY = y;

    if (reducedQuery.matches) return;

    if (hero) {
      const h = hero.offsetHeight || vh;
      heroProgress = clamp(y / h);
      const hp = heroProgress.toFixed(4);
      if (hero.style.getPropertyValue('--hp') !== hp) {
        hero.style.setProperty('--hp', hp);
        light?.setScroll(heroProgress);
      }
    }

    if (intro) {
      const r = intro.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) intro.style.setProperty('--ip', clamp((vh - r.top) / (vh + r.height)).toFixed(4));
    }

    if (statement) {
      const r = statement.getBoundingClientRect();
      if (r.bottom > -vh * 0.2 && r.top < vh * 1.2) {
        const p = clamp((vh - r.top) / (vh + r.height));
        const inP = clamp((p - 0.08) / 0.4);
        const fill = clamp((p - 0.25) / 0.5);
        statement.style.setProperty('--si', inP.toFixed(4));
        statement.style.setProperty('--sp', fill.toFixed(4));
        if (railCount) railCount.textContent = String(Math.round(fill * 100)).padStart(3, '0');
      }
    }
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  updateScroll();
  if (reducedQuery.matches && railCount) railCount.textContent = '100';

  /* ---------- Hero mouse parallax (fine pointers only) ---------- */
  if (hero && finePointer.matches && !reducedQuery.matches) {
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let raf = 0;
    const step = () => {
      current.x += (target.x - current.x) * 0.075;
      current.y += (target.y - current.y) * 0.075;
      hero.style.setProperty('--px', current.x.toFixed(4));
      hero.style.setProperty('--py', current.y.toFixed(4));
      if (Math.abs(target.x - current.x) > 0.001 || Math.abs(target.y - current.y) > 0.001) {
        raf = requestAnimationFrame(step);
      } else raf = 0;
    };
    hero.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      target.x = (e.clientX / innerWidth) * 2 - 1;
      target.y = (e.clientY / innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(step);
      light?.setPointer(e.clientX, e.clientY);
    });
    hero.addEventListener('pointerleave', () => {
      target.x = 0; target.y = 0;
      if (!raf) raf = requestAnimationFrame(step);
      light?.releasePointer();
    });
  }

  /* ---------- Category cards: tilt + cursor light (fine pointers only) ---------- */
  if (finePointer.matches && !reducedQuery.matches) {
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
      card.addEventListener('pointerenter', e => {
        if (e.pointerType !== 'mouse') return;
        card.classList.add('is-tracking');
      });
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
    if (!canvas || !heroPhoto || reducedQuery.matches || !supportsWebGL()) return;
    const start = () => import('./home-light.js')
      .then(mod => {
        light = mod.initHeroLight(canvas, heroPhoto, { coarse: !finePointer.matches });
        light?.setScroll(heroProgress);
      })
      .catch(() => {}); // CSS glow remains as the fallback.
    if (heroPhoto.complete && heroPhoto.naturalWidth) start();
    else heroPhoto.addEventListener('load', start, { once: true });
  }

  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 300));
  if (document.readyState === 'complete') idle(loadLight);
  else addEventListener('load', () => idle(loadLight), { once: true });
})();
