// Hero lighting: a single full-screen fragment shader that renders a soft red
// volumetric haze behind the athlete. The photo above it is blended with
// `lighten`, so the haze only shows through the dark backdrop, never over the
// athlete. Falls back silently to the CSS gradients when anything fails.

const VERTEX = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform vec2 uCenter;
uniform float uFade;
uniform float uScroll;

float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2((uv.x - uCenter.x) * aspect, uv.y - uCenter.y);
  float t = uTime * 0.035;

  vec2 q = vec2(fbm(p * 1.6 + vec2(0.0, t)), fbm(p * 1.6 + vec2(5.2, 1.3) - t));
  float smoke = fbm(p * 2.4 + q * 1.8 + vec2(t * 0.6, t * 0.9));

  vec2 lp = p - vec2(uPointer.x * 0.18, -uPointer.y * 0.12);
  float d = length(lp * vec2(0.85, 1.15));
  float core = exp(-d * d * 4.2);
  float halo = exp(-d * 1.9);
  float floorGlow = exp(-pow(uv.y * 3.2, 2.0)) * (0.4 + 0.6 * smoke);

  float light = core * (0.45 + 0.9 * smoke) + halo * 0.18 * smoke + floorGlow * 0.3;
  light *= uFade * (1.0 - uScroll * 0.6);

  vec3 col = vec3(0.973, 0.012, 0.024) * light * 0.27;
  col += vec3(0.125, 0.129, 0.141) * smoke * smoke * 0.35 * (1.0 - core) * uFade;
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || 'Shader compile failed');
  }
  return shader;
}

export function mountHeroLight(host, { hero, pointer }) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  if (!gl) return;

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Program link failed');
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = name => gl.getUniformLocation(program, name);
  const uRes = u('uRes'), uTime = u('uTime'), uPointer = u('uPointer');
  const uCenter = u('uCenter'), uFade = u('uFade'), uScroll = u('uScroll');

  const coarse = matchMedia('(pointer: coarse)').matches;
  const frameInterval = coarse ? 1000 / 30 : 0;
  const photo = hero.querySelector('.hero-photo img');
  let center = [0.58, 0.62];

  function resize() {
    const rect = host.getBoundingClientRect();
    const scale = (coarse ? 0.35 : 0.5) * Math.min(1, 1400 / rect.width);
    canvas.width = Math.max(2, Math.round(rect.width * scale));
    canvas.height = Math.max(2, Math.round(rect.height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    const img = photo.getBoundingClientRect();
    if (img.width && rect.width) {
      const cx = (img.left + img.width / 2 - rect.left) / rect.width;
      const cy = (img.top + img.height * 0.45 - rect.top) / rect.height;
      center = [cx, 1 - cy];
    }
    gl.uniform2f(uCenter, center[0], center[1]);
  }

  let running = false;
  let raf = 0;
  let last = 0;
  const startTime = performance.now();
  let visible = true;

  function render(now) {
    raf = 0;
    if (!running) return;
    raf = requestAnimationFrame(render);
    if (frameInterval && now - last < frameInterval) return;
    last = now;
    const elapsed = (now - startTime) / 1000;
    gl.uniform1f(uTime, elapsed + 20.0);
    gl.uniform1f(uFade, Math.min(1, elapsed / 1.6));
    gl.uniform2f(uPointer, pointer.x, pointer.y);
    gl.uniform1f(uScroll, Math.min(1, scrollY / hero.offsetHeight));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function update() {
    const shouldRun = visible && !document.hidden;
    if (shouldRun && !running) { running = true; raf = requestAnimationFrame(render); }
    if (!shouldRun && running) { running = false; cancelAnimationFrame(raf); raf = 0; }
  }

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    running = false;
    cancelAnimationFrame(raf);
    host.classList.remove('has-webgl');
    canvas.remove();
  });

  host.append(canvas);
  resize();
  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }).observe(hero);
  document.addEventListener('visibilitychange', update);
  update();
  requestAnimationFrame(() => host.classList.add('has-webgl'));
}
