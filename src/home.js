const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

window.ppHomeReady = true;
root.classList.remove('no-anim');

/* ---------- Editable landing copy (served by the store dashboard) ---------- */
fetch('/api/storefront')
  .then(response => (response.ok ? response.json() : null))
  .then(storefront => {
    if (!storefront?.landing) return;
    document.querySelectorAll('[data-field]').forEach(el => {
      const text = storefront.landing[el.dataset.field];
      if (typeof text === 'string' && text.trim()) el.textContent = text;
    });
  })
  .catch(() => {});

document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

/* ---------- Header ---------- */
const header = document.querySelector('[data-header]');
const menu = document.querySelector('[data-menu]');
const menuToggle = document.querySelector('[data-menu-toggle]');

function setMenu(open) {
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.querySelector('.visually-hidden').textContent = open ? 'Close menu' : 'Open menu';
  menu.hidden = !open;
  menu.classList.toggle('is-open', open);
  document.body.classList.toggle('menu-open', open);
  header.classList.toggle('is-scrolled', open || scrollY > 24);
  if (open) menu.querySelector('a')?.focus();
}
menuToggle.addEventListener('click', () => setMenu(menu.hidden));
menu.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !menu.hidden) { setMenu(false); menuToggle.focus(); }
  if (event.key === 'Tab' && !menu.hidden) {
    const focusable = [menuToggle, ...menu.querySelectorAll('a')];
    const index = focusable.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1).focus(); }
    else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
  }
});
matchMedia('(min-width: 901px)').addEventListener('change', event => { if (event.matches) setMenu(false); });

/* ---------- Word-split headlines ---------- */
function splitWords(el) {
  let i = 0;
  const walk = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(' ')); return; }
          const outer = document.createElement('span');
          const inner = document.createElement('span');
          outer.className = 'w';
          outer.style.setProperty('--i', i++);
          inner.textContent = part;
          outer.append(inner);
          frag.append(outer);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };
  walk(el);
}
document.querySelectorAll('.split-words').forEach(splitWords);

/* ---------- Scroll reveals ---------- */
const revealTargets = document.querySelectorAll('.reveal-up:not(.hero .reveal-up), .split-words, .reveal-card');
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  revealTargets.forEach(el => revealObserver.observe(el));
} else {
  revealTargets.forEach(el => el.classList.add('is-in'));
}

/* ---------- Hero entrance ---------- */
const hero = document.querySelector('[data-hero]');
const heroImage = hero.querySelector('.hero-photo img');
let heroShown = false;
const showHero = () => {
  if (heroShown) return;
  heroShown = true;
  requestAnimationFrame(() => hero.classList.add('is-loaded'));
};
if (heroImage.complete) showHero();
else {
  heroImage.decode?.().then(showHero, showHero);
  heroImage.addEventListener('load', showHero, { once: true });
  heroImage.addEventListener('error', showHero, { once: true });
  setTimeout(showHero, 1800);
}

/* ---------- Pointer parallax + scroll-linked motion ---------- */
const statement = document.querySelector('[data-statement]');
const intro = document.querySelector('.intro');
const tickerTrack = document.querySelector('[data-ticker-track]');
const tickerSource = [...tickerTrack.children];
let tickerPeriod = 1;
function measureTicker() {
  const firstCopy = tickerSource[0];
  if (tickerTrack.children.length === tickerSource.length) {
    tickerSource.forEach(node => tickerTrack.append(node.cloneNode(true)));
  }
  tickerPeriod = tickerTrack.children[tickerSource.length].offsetLeft - firstCopy.offsetLeft;
  while (tickerTrack.scrollWidth < tickerPeriod + innerWidth * 1.5) {
    tickerSource.forEach(node => tickerTrack.append(node.cloneNode(true)));
  }
}
measureTicker();
document.fonts?.ready.then(measureTicker);
addEventListener('resize', measureTicker, { passive: true });
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
let heroVisible = true;
let frame = 0;
let tickerOffset = 0;
let lastScroll = scrollY;

new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; }).observe(hero);

if (!reducedMotion.matches && finePointer.matches) {
  addEventListener('pointermove', event => {
    if (!heroVisible) return;
    pointer.tx = (event.clientX / innerWidth) * 2 - 1;
    pointer.ty = (event.clientY / innerHeight) * 2 - 1;
    requestTick();
  }, { passive: true });
}

function requestTick() {
  if (!frame) frame = requestAnimationFrame(tick);
}

function sectionProgress(el) {
  const rect = el.getBoundingClientRect();
  return clamp((innerHeight - rect.top) / (innerHeight + rect.height));
}

function tick() {
  frame = 0;
  const y = scrollY;
  header.classList.toggle('is-scrolled', y > 24 || !menu.hidden);
  if (reducedMotion.matches) return;

  if (heroVisible) {
    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;
    hero.style.setProperty('--px', pointer.x.toFixed(4));
    hero.style.setProperty('--py', pointer.y.toFixed(4));
    hero.style.setProperty('--hp', clamp(y / hero.offsetHeight).toFixed(4));
    if (Math.abs(pointer.tx - pointer.x) > 0.001 || Math.abs(pointer.ty - pointer.y) > 0.001) requestTick();
  }

  intro.style.setProperty('--sp', sectionProgress(intro).toFixed(4));
  statement.style.setProperty('--sp', sectionProgress(statement).toFixed(4));

  tickerOffset = (tickerOffset + (y - lastScroll) * 0.45) % tickerPeriod;
  if (tickerOffset < 0) tickerOffset += tickerPeriod;
  tickerTrack.style.setProperty('--tick', tickerOffset.toFixed(1));
  lastScroll = y;
}
addEventListener('scroll', requestTick, { passive: true });
addEventListener('resize', requestTick, { passive: true });
tick();

/* ---------- Category cards: tilt + cursor light ---------- */
document.querySelectorAll('[data-tilt]').forEach(card => {
  let rafId = 0;
  let last = null;
  const apply = () => {
    rafId = 0;
    if (!last) return;
    const rect = card.getBoundingClientRect();
    const nx = clamp((last.clientX - rect.left) / rect.width);
    const ny = clamp((last.clientY - rect.top) / rect.height);
    card.style.setProperty('--mx', `${(nx * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(ny * 100).toFixed(1)}%`);
    if (reducedMotion.matches) return;
    card.style.setProperty('--ry', `${((nx - 0.5) * 7).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${((0.5 - ny) * 6).toFixed(2)}deg`);
    card.style.setProperty('--lx', ((nx - 0.5) * 2).toFixed(3));
    card.style.setProperty('--ly', ((ny - 0.5) * 2).toFixed(3));
  };
  card.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse') return;
    card.classList.add('is-tilting');
  });
  card.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    last = event;
    if (!rafId) rafId = requestAnimationFrame(apply);
  });
  card.addEventListener('pointerleave', () => {
    last = null;
    card.classList.remove('is-tilting');
    ['--rx', '--ry', '--lx', '--ly', '--mx', '--my'].forEach(prop => card.style.removeProperty(prop));
  });
});

/* ---------- Leave transition for internal department links ---------- */
const curtain = document.createElement('div');
curtain.className = 'page-curtain';
curtain.setAttribute('aria-hidden', 'true');
document.body.append(curtain);
document.querySelectorAll('a[href^="/"]:not([href="/"])').forEach(link => {
  link.addEventListener('click', event => {
    if (reducedMotion.matches || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    curtain.classList.add('is-active');
    setTimeout(() => location.assign(link.href), 380);
  });
});
addEventListener('pageshow', () => curtain.classList.remove('is-active'));

/* ---------- WebGL hero light (progressive enhancement) ---------- */
function canUseWebGL() {
  if (reducedMotion.matches || navigator.connection?.saveData) return false;
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch {
    return false;
  }
}
const lightHost = hero.querySelector('[data-hero-light]');
if (canUseWebGL()) {
  const start = () => import('./home-light.js')
    .then(module => module.mountHeroLight(lightHost, { hero, pointer }))
    .catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1200 });
  else setTimeout(start, 400);
}
