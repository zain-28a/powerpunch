/* PowerPunch — clothing showroom (Three.js).
   Each garment is its real cut-out photo on a plane cut to its shape, hung
   from a thin wire on a rail. Colours are passed through unchanged (no tone
   mapping or colour-space conversion). A light vertex sway is the only idle
   motion; rendering pauses when the showroom is off screen or the tab is hidden. */
import * as THREE from './vendor/three.module.min.js';

const VERT = `
uniform float uTime; uniform float uPhase; uniform float uSway;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec3 p = position;
  float k = 1.0 - uv.y;                       // 0 at the hanger, 1 at the hem
  p.z += sin(uTime * 1.1 + uPhase + p.y * 2.4) * 0.018 * k * k * uSway;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FRAG = `
uniform sampler2D map; uniform float uLight; uniform float uOpacity;
varying vec2 vUv;
void main(){
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.04) discard;
  float shade = mix(0.9, 1.0, smoothstep(0.0, 0.55, vUv.y));
  gl_FragColor = vec4(c.rgb * shade * uLight, c.a * uOpacity);
}`;

export function createShowroom(canvas, items, { mobile = false, motion = true, onPick, onCenter, onNavigate, onFallback } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: mobile ? 'low-power' : 'high-performance' });
  } catch { return null; }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // pass texture colours through untouched
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const SPACING = mobile ? 1.45 : 1.75, RAIL_Y = 1.22, TOP_Y = 1.04, FLOOR_Y = -1.45, SCALE = 1.62;
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const garments = [];

  // Rail and floor shadows (one shared radial texture).
  const railLen = (items.length - 1) * SPACING + 8;
  const rail = new THREE.Mesh(new THREE.PlaneGeometry(railLen, 0.006), new THREE.MeshBasicMaterial({ color: 0x5a5a5e }));
  rail.position.set((items.length - 1) * SPACING / 2, RAIL_Y, -0.02); scene.add(rail);
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const g2 = sc.getContext('2d'), grad = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); g2.fillStyle = grad; g2.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sc);
  const shadowGeo = new THREE.PlaneGeometry(1, 1), wireMat = new THREE.MeshBasicMaterial({ color: 0x8a8a90, transparent: true, opacity: 0.6 });

  function makeGarment(item, i) {
    const h = item.length * SCALE, w = h * item.aspect;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      uniforms: { map: { value: null }, uTime: { value: 0 }, uPhase: { value: i * 1.7 }, uSway: { value: motion && !mobile ? 1 : 0 }, uLight: { value: 0.6 }, uOpacity: { value: 0 } },
    });
    const geo = new THREE.PlaneGeometry(w, h, 8, 16); geo.translate(0, -h / 2, 0); // pivot at the hanger
    const mesh = new THREE.Mesh(geo, mat);
    const group = new THREE.Group(); group.position.set(i * SPACING, TOP_Y, 0); group.add(mesh); scene.add(group);
    const wire = new THREE.Mesh(new THREE.PlaneGeometry(0.006, RAIL_Y - TOP_Y), wireMat);
    wire.position.set(i * SPACING, (RAIL_Y + TOP_Y) / 2, -0.01); scene.add(wire);
    const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.scale.set(w * 0.9, 0.5, 1); shadow.position.set(i * SPACING, FLOOR_Y + 0.002, 0.05); scene.add(shadow);
    const g = { group, mesh, mat, geo, shadow, w, h, fade: 0, request: 0 };
    garments.push(g);
    load(i, item.url, item.aspect);
    return g;
  }
  function load(i, url, aspect) {
    const g = garments[i], request = ++g.request;
    loader.load(url, tex => {
      if (request !== g.request) { tex.dispose(); return; }
      tex.anisotropy = maxAniso; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
      const old = g.mat.uniforms.map.value;
      g.mat.uniforms.map.value = tex; old?.dispose();
      if (aspect && Math.abs(aspect * g.h - g.w) > 0.001) { // colour photos differ slightly in proportion
        const w = g.h * aspect, ng = new THREE.PlaneGeometry(w, g.h, 8, 16); ng.translate(0, -g.h / 2, 0);
        g.mesh.geometry.dispose(); g.mesh.geometry = ng; g.geo = ng; g.w = w; g.shadow.scale.x = w * 0.9;
      }
      g.fade = 1; wake();
    });
  }
  items.forEach(makeGarment);

  // ---------- Camera follows the independently controlled horizontal rail ----------
  let pos = 0, target = 0, t0 = performance.now(), visible = true, inView = true, raf = 0;
  let centered = -1, velocity = 0, drag = null;
  const clamp = p => THREE.MathUtils.clamp(p, 0, items.length - 1);
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    // Keep the rail near the top and fit at least ~2.6 garments across on narrow screens.
    const minWidth = mobile ? 2.3 : 4.7, vfov = THREE.MathUtils.degToRad(camera.fov);
    const zForWidth = minWidth / (2 * Math.tan(vfov / 2) * camera.aspect);
    const zForHeight = (mobile ? 2.9 : 3.05) / (2 * Math.tan(vfov / 2));
    camera.userData.z = Math.max(zForWidth, zForHeight, 3.2);
    camera.updateProjectionMatrix(); wake();
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
    if (!motion || drag?.horizontal) {
      pos = target;
      velocity = 0;
    } else {
      // Analytic critically damped spring, stable across different frame rates.
      const distance = pos - target, rate = 19, decay = Math.exp(-rate * dt);
      const tangent = velocity + rate * distance;
      pos = clamp(target + (distance + tangent * dt) * decay);
      velocity = (velocity - rate * tangent * dt) * decay;
      if (Math.abs(pos - target) < 0.001 && Math.abs(velocity) < 0.02) {
        pos = target;
        velocity = 0;
      }
    }
    const z = camera.userData.z || 4;
    camera.position.set(pos * SPACING, 0, z);
    camera.lookAt(pos * SPACING, 0, 0);
    const time = now / 1000;
    let settling = pos !== target;
    if (!drag?.horizontal && !settling && centered !== target) { centered = target; onCenter?.(centered); }
    garments.forEach((g, i) => {
      const d = i - pos, ad = Math.min(Math.abs(d), 3);
      g.group.position.z = Math.max(0, 0.32 - ad * 0.32);           // focused garment steps forward
      g.group.scale.setScalar(1 + Math.max(0, 1 - ad) * 0.065);
      g.group.rotation.y = THREE.MathUtils.clamp(-d * 0.16, -0.42, 0.42);
      const light = 1 - Math.min(ad, 2.2) * 0.26;
      g.mat.uniforms.uLight.value = light; g.mat.uniforms.uTime.value = time;
      const op = g.mat.uniforms.uOpacity; op.value += (g.fade - op.value) * (motion ? 0.12 : 1);
      if (Math.abs(g.fade - op.value) > 0.002) settling = true;
      g.shadow.material.opacity = 0.9 * op.value * (1 - Math.min(ad, 2) * 0.3);
    });
    renderer.render(scene, camera);
    if (visible && ((motion && !mobile) || settling)) raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf && visible) { t0 = performance.now(); raf = requestAnimationFrame(frame); } }

  // ---------- Horizontal input and garment picking ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const meshes = garments.map(g => g.mesh);
  canvas.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, start: pos };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (drag?.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.horizontal) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      drag.horizontal = true;
      drag.step = Math.max(90, canvas.clientWidth * SPACING / Math.max(2.6,
        (camera.userData.z || 4) * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
      canvas.classList.add('is-dragging');
    }
    if (motion) { target = clamp(drag.start - dx / drag.step); wake(); }
  });
  function release(e, cancelled = false) {
    if (drag?.id !== e.pointerId) return;
    const gesture = drag;
    drag = null;
    canvas.classList.remove('is-dragging');
    if (gesture.horizontal) {
      const distance = (gesture.x - e.clientX) / gesture.step;
      const offset = Math.abs(distance) >= 0.22 ? Math.sign(distance) * Math.max(1, Math.round(Math.abs(distance))) : 0;
      onNavigate?.(cancelled ? 0 : offset);
      return;
    }
    if (cancelled || Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 8) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(meshes)[0];
    if (hit) onPick?.(meshes.indexOf(hit.object));
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', e => release(e, true));
  canvas.addEventListener('lostpointercapture', e => release(e, true));

  let wheelDistance = 0, wheelTime = -Infinity, wheelLocked = false;
  canvas.addEventListener('wheel', e => {
    if (e.ctrlKey || drag || Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2) return;
    e.preventDefault();
    const now = performance.now();
    if (now - wheelTime > 160) { wheelDistance = 0; wheelLocked = false; }
    wheelTime = now;
    if (wheelLocked) return;
    wheelDistance += e.deltaX * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientWidth : 1);
    if (Math.abs(wheelDistance) >= 36) {
      wheelLocked = true;
      onNavigate?.(Math.sign(wheelDistance));
    }
  }, { passive: false });

  function updateVisibility() {
    visible = inView && !document.hidden;
    if (visible) wake();
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; updateVisibility(); }).observe(canvas);
  document.addEventListener('visibilitychange', updateVisibility);
  canvas.addEventListener('webglcontextlost', () => {
    inView = false;
    updateVisibility();
    canvas.closest('[data-showroom]')?.classList.remove('is-3d');
    onFallback?.();
  }, { once: true });
  resize();

  return {
    snapTo(i, instant) {
      target = clamp(Math.round(i));
      velocity = 0;
      if (instant || !motion) pos = target;
      wake();
    },
    setTexture(i, url, aspect) { if (garments[i]) load(i, url, aspect); },
  };
}
