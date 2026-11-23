/* PowerPunch — page background (WebGL).
   Three layers of soft smoke at different depths drift past each other as the
   page scrolls (parallax), lit by two red lights whose positions also follow
   the scroll. Rendered on demand only (scroll / pointer), never in a loop.
   Dithering in the shader removes gradient banding. */

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0., 1.); }`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uScroll;
uniform vec2 uPointer;

float hash(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + vec2(17., 9.); a *= .5; }
  return v;
}

void main(){
  vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float s = uScroll;

  // Smoke at three depths: nearer layers are larger and move faster.
  float smoke = 0.;
  for (int i = 0; i < 3; i++){
    float z = 1. + float(i) * .9;
    vec2 q = p * (1.5 / z) + vec2(float(i) * 3.1, s * .6 / z) + uPointer * .05 / z;
    smoke += fbm(q * 1.8) / z;
  }
  smoke = smoothstep(.45, 1.35, smoke);

  // Two red lights travelling with the scroll.
  vec2 l1 = vec2(.62 * sin(s * 1.2 + .7), .30 * cos(s * .8));
  vec2 l2 = vec2(-.7 * cos(s * .7 + 1.1), -.28 + .22 * sin(s * 1.05));
  vec2 d1 = p - l1, d2 = p - l2;
  // Tight falloff: red only appears as a few small glows, the rest stays black.
  float light = .6 * exp(-dot(d1, d1) * 4.2) + .4 * exp(-dot(d2, d2) * 5.2);

  vec3 col = vec3(.031);
  col += vec3(.973, .012, .024) * light * (.045 + smoke * .2);
  col += vec3(.07) * smoke * .16;
  col *= 1. - .22 * dot(p, p);
  col += (hash(gl_FragCoord.xy * .5) - .5) / 255.;
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}`;

export function initBackground(canvas, { coarse = false } = {}) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(program, 'uRes');
  const uScroll = gl.getUniformLocation(program, 'uScroll');
  const uPointer = gl.getUniformLocation(program, 'uPointer');

  const state = { s: 0, ts: 0, px: 0, py: 0, tpx: 0, tpy: 0 };
  let raf = 0;
  let lost = false;

  function resize() {
    const scale = coarse ? 0.75 : 1; // soft image, so a lower resolution is fine
    const w = Math.max(1, Math.round(innerWidth * scale));
    const h = Math.max(1, Math.round(innerHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
    draw();
  }
  function draw() {
    if (lost) return;
    gl.uniform1f(uScroll, state.s);
    gl.uniform2f(uPointer, state.px, state.py);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function tick() {
    raf = 0;
    state.s += (state.ts - state.s) * 0.12;
    state.px += (state.tpx - state.px) * 0.06;
    state.py += (state.tpy - state.py) * 0.06;
    draw();
    if (Math.abs(state.ts - state.s) > 0.0005 || Math.abs(state.tpx - state.px) > 0.001 || Math.abs(state.tpy - state.py) > 0.001) {
      raf = requestAnimationFrame(tick);
    }
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; canvas.classList.remove('is-live'); });
  addEventListener('resize', resize, { passive: true });
  resize();
  canvas.classList.add('is-live');

  return {
    setScroll(screens) { state.ts = screens; wake(); },
    setPointer(x, y) { state.tpx = x; state.tpy = y; wake(); },
  };
}
