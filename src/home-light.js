/* PowerPunch — hero lighting (WebGL).
   Re-lights the athlete photograph with a red key light that follows the
   cursor. The shader reads contours from the photo's luminance, so light only
   catches muscle edges and the silhouette rim; the photo itself is never
   warped. The canvas is composited with `mix-blend-mode: screen`, so black
   output leaves the original image untouched. Renders on demand only. */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){
  vUv = vec2(aPos.x * .5 + .5, .5 - aPos.y * .5);
  gl_Position = vec4(aPos, 0., 1.);
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform vec2 uLight;
uniform float uAspect;
uniform float uIntensity;

float lum(vec2 o){ return dot(texture2D(uTex, vUv + o * uTexel).rgb, vec3(.299,.587,.114)); }

void main(){
  float tl = lum(vec2(-1.,-1.)), t = lum(vec2(0.,-1.)), tr = lum(vec2(1.,-1.));
  float l  = lum(vec2(-1., 0.)), c = lum(vec2(0., 0.)), r  = lum(vec2(1., 0.));
  float bl = lum(vec2(-1., 1.)), b = lum(vec2(0., 1.)), br = lum(vec2(1., 1.));
  vec2 g = vec2((tr + 2.*r + br) - (tl + 2.*l + bl), (bl + 2.*b + br) - (tl + 2.*t + tr));

  float body = smoothstep(.03, .2, max(c, (t + b + l + r) * .25));
  vec2 d = uLight - vUv; d.x *= uAspect;
  float dist = length(d);
  vec2 dir = d / max(dist, 1e-4);

  float edge = smoothstep(.05, .42, length(g));
  float facing = max(dot(normalize(-g + 1e-5), dir), 0.);
  float fall = exp(-dist * dist * 2.2);

  float rim = edge * pow(facing, 1.6) * fall * body;
  float fill = body * c * fall * .18;
  float haze = exp(-dist * dist * 9.) * (1. - body) * .10;

  vec3 red = vec3(.973, .012, .024);
  vec3 col = red * (rim * 1.0 + fill + haze * 1.2) + vec3(1., .9, .88) * rim * rim * .12;
  vec2 e = min(vUv, 1. - vUv);
  float frame = smoothstep(0., .1, min(e.x, e.y));
  // Premultiplied output: the light is purely additive, so it composites over
  // the transparent-black photo and the page background without any box.
  vec3 lit = col * uIntensity * frame;
  // Mostly additive (like the original screen blend): low alpha, so the light
  // brightens the photo instead of covering it.
  gl_FragColor = vec4(lit, max(lit.r, max(lit.g, lit.b)) * .3);
}`;

export function initHeroLight(canvas, image, { coarse = false } = {}) {
  const gl = canvas.getContext('webgl', {
    alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power',
  });
  if (!gl) return null;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  } catch {
    return null;
  }

  const u = name => gl.getUniformLocation(program, name);
  const uTexel = u('uTexel'), uLight = u('uLight'), uAspect = u('uAspect'), uIntensity = u('uIntensity');
  gl.uniform2f(uTexel, 1.6 / image.naturalWidth, 1.6 / image.naturalHeight);

  // Light target = scroll path + mouse offset + device-tilt offset (all in uv space).
  const state = {
    x: 0.08, y: -0.12,            // current light position
    i: 0, ti: 1,                  // intensity
    scroll: 0,
    pointer: { x: 0, y: 0 },
    tilt: { x: 0, y: 0 },
  };
  const target = () => ({
    x: 0.74 - state.scroll * 0.55 + state.pointer.x * 0.6 + state.tilt.x * 0.18,
    y: 0.08 + state.scroll * 0.22 + state.pointer.y * 0.35 + state.tilt.y * 0.1,
  });
  let raf = 0;
  let visible = true;
  let lost = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1 : 1.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    const scale = Math.min(1, 1800 / w);
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw; canvas.height = ch;
      gl.viewport(0, 0, cw, ch);
    }
    gl.uniform1f(uAspect, canvas.clientWidth / Math.max(1, canvas.clientHeight));
    draw();
  }

  function draw() {
    if (lost) return;
    gl.uniform2f(uLight, state.x, state.y);
    gl.uniform1f(uIntensity, state.i * (1 - state.scroll * 0.45));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function tick() {
    raf = 0;
    if (!visible || lost) return;
    const t = target();
    state.x += (t.x - state.x) * 0.06;
    state.y += (t.y - state.y) * 0.06;
    state.i += (state.ti - state.i) * 0.04;
    draw();
    if (Math.abs(t.x - state.x) > 0.0008 || Math.abs(t.y - state.y) > 0.0008 || Math.abs(state.ti - state.i) > 0.002) {
      raf = requestAnimationFrame(tick);
    }
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; canvas.classList.remove('is-live'); });

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) wake();
  }).observe(canvas);

  resize();
  canvas.classList.add('is-live');
  wake();

  return {
    // Pointer position in the viewport, as -0.5..0.5 offsets.
    setPointer(clientX, clientY) {
      state.pointer.x = clientX / innerWidth - 0.5;
      state.pointer.y = clientY / innerHeight - 0.5;
      wake();
    },
    releasePointer() {
      state.pointer.x = 0; state.pointer.y = 0;
      wake();
    },
    // Device tilt, normalised to -1..1.
    setTilt(x, y) {
      state.tilt.x = x; state.tilt.y = y;
      wake();
    },
    // Progress of the hero exit, 0..1.
    setScroll(p) {
      state.scroll = p;
      wake();
    },
  };
}
