import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { buildTimeline, PAPER } from './fold.js';
import { STEPS, TIPS } from './steps.js';

const timeline = buildTimeline(STEPS);
const N = timeline.steps.length;
const STEP_SECONDS = [3.4, 4.2, 4.2, 3.0, 9.5, 8.5];
const HOLD = 0.7; // pause between steps when auto-advance is on

// ---------- three.js scene ----------
const canvas = document.getElementById('c');
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 4, 600);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxDistance = 220;
controls.minDistance = 12;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 1.35));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(-20, 40, 60);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xbcd0ff, 0.6);
fill.position.set(30, -10, -40);
scene.add(fill);

// Ground grid, only shown for the flight
const grid = new THREE.GridHelper(400, 80, 0x7c8fb0, 0x9fb0cc);
grid.position.y = -26;
grid.material.transparent = true;
grid.material.opacity = 0;
scene.add(grid);

// ---------- paper textures ----------
function paperTexture(front) {
  const W = 1024, H = Math.round(W * PAPER.h / PAPER.w);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const px = W / PAPER.w; // pixels per cm
  if (front) {
    g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, W, H);
    for (let i = 0; i <= PAPER.w; i++) { g.strokeStyle = i % 5 === 0 ? '#9bbbe0' : '#d6e4f4'; g.lineWidth = i % 5 === 0 ? 2 : 1; g.beginPath(); g.moveTo(i * px, 0); g.lineTo(i * px, H); g.stroke(); }
    for (let j = 0; j <= PAPER.h; j++) { g.strokeStyle = j % 5 === 0 ? '#9bbbe0' : '#d6e4f4'; g.lineWidth = j % 5 === 0 ? 2 : 1; g.beginPath(); g.moveTo(0, H - j * px); g.lineTo(W, H - j * px); g.stroke(); }
    // arrow marking the top / nose end
    g.fillStyle = '#4a78b8'; g.globalAlpha = 0.55;
    g.beginPath(); g.moveTo(W / 2, 40); g.lineTo(W / 2 + 55, 130); g.lineTo(W / 2 + 18, 130); g.lineTo(W / 2 + 18, 210); g.lineTo(W / 2 - 18, 210); g.lineTo(W / 2 - 18, 130); g.lineTo(W / 2 - 55, 130); g.closePath(); g.fill();
    g.globalAlpha = 1;
  } else {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#ff7a55'); gr.addColorStop(1, '#ff4f6d');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 8;
    for (let k = -H; k < W; k += 38) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + H, H); g.stroke(); }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}
const mkMat = (front) => new THREE.MeshStandardMaterial({
  map: paperTexture(front), roughness: 0.85, metalness: 0,
  side: front ? THREE.FrontSide : THREE.BackSide,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});
const frontMat = mkMat(true);
const backMat = mkMat(false);
const lineMat = new THREE.LineBasicMaterial({ color: 0x3c4a63, transparent: true, opacity: 0.75 });

// ---------- model (rebuilt whenever the active op changes) ----------
const model = new THREE.Group();
scene.add(model);
let shownOp = -1;
let moving = []; // meshes that follow the op matrix

const guideMat = new THREE.LineDashedMaterial({ color: 0xffc02e, dashSize: 1.2, gapSize: 0.8, depthTest: false, transparent: true });
let guideLine = null;

function disposeModel() {
  model.traverse((o) => o.geometry && o.geometry.dispose());
  model.clear();
  moving = [];
  guideLine = null;
}

function buildOp(op) {
  disposeModel();
  for (const { pc, moving: mv } of op.before) {
    const n = pc.verts.length;
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    pc.verts.forEach((v, i) => { pos.set([v.p.x, v.p.y, v.p.z], i * 3); uv.set([v.uv.x, v.uv.y], i * 2); });
    const idx = [];
    for (let i = 1; i < n - 1; i++) idx.push(0, i, i + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, frontMat), new THREE.Mesh(geo, backMat), new THREE.LineLoop(geo, lineMat));
    grp.matrixAutoUpdate = false;
    model.add(grp);
    if (mv) moving.push(grp);
  }
  if (op.guide) {
    const { P, D } = op.guide;
    const a = P.clone().addScaledVector(D, -34), b = P.clone().addScaledVector(D, 34);
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    guideLine = new THREE.Line(g, guideMat);
    guideLine.computeLineDistances();
    guideLine.renderOrder = 10;
    model.add(guideLine);
  }
}

// ---------- timeline <-> progress ----------
const ease = (u) => u * u * (3 - 2 * u);
function locate(P) {
  const si = Math.min(N - 1, Math.max(0, Math.floor(P)));
  const t = Math.min(1, Math.max(0, P - si));
  const ops = timeline.steps[si].ops;
  const weights = ops.map((o) => o.def.w || 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0, k = 0;
  for (; k < ops.length - 1; k++) { if (t * total < acc + weights[k]) break; acc += weights[k]; }
  const u = Math.min(1, Math.max(0, (t * total - acc) / weights[k]));
  return { si, op: ops[k], u };
}

// ---------- camera presets ----------
const CAMS = {
  top: { pos: new THREE.Vector3(0, -12, 66), target: new THREE.Vector3(0, -3.5, 0) },
  rear: { pos: new THREE.Vector3(34, 14, 30), target: new THREE.Vector3(0, -1, 0) },
  fly: { pos: new THREE.Vector3(48, 10, 30), target: new THREE.Vector3(-26, 2, 0) },
};
let camGoal = null;
function setCamGoal(key) {
  const c = CAMS[key] || CAMS.top;
  const aspect = camera.aspect || 1;
  const mult = key === 'fly' ? 1 : Math.max(1, 0.85 / aspect);
  camGoal = { pos: c.target.clone().add(c.pos.clone().sub(c.target).multiplyScalar(mult)), target: c.target.clone() };
}

// ---------- state ----------
let P = 0;
let playing = false;
let hold = 0;
let stopAt = null;
const ui = {
  speed: document.getElementById('speed'),
  advance: document.getElementById('chk-advance'),
  creases: document.getElementById('chk-creases'),
  camera: document.getElementById('chk-camera'),
  scrub: document.getElementById('scrub'),
  play: document.getElementById('play'),
  caption: document.getElementById('caption'),
};
ui.scrub.max = N; ui.scrub.step = 0.001;

function render(Pv) {
  const { si, op, u } = locate(Pv);
  if (shownOp !== op.index) {
    shownOp = op.index;
    buildOp(op);
    if (ui.camera.checked) setCamGoal(op.def.cam);
    ui.caption.innerHTML = `${op.def.caption}<small>Step ${si + 1} of ${N} · ${timeline.steps[si].def.title}</small>`;
    document.querySelectorAll('#steps > li').forEach((li, i) => {
      li.classList.toggle('active', i === si);
      li.classList.toggle('done', i < si);
    });
  }
  const M = op.matrixAt(op.kind === 'fly' ? u : ease(u));
  if (op.kind === 'fly' && ui.camera.checked) {
    // chase camera: trail the plane from behind and a little above
    const at = new THREE.Vector3().setFromMatrixPosition(M);
    camGoal = { pos: at.clone().add(new THREE.Vector3(52, 13, 36)), target: at.clone().add(new THREE.Vector3(-6, 0, 0)) };
  }
  moving.forEach((m) => { m.matrix.copy(M); m.matrixWorldNeedsUpdate = true; });
  if (guideLine) guideLine.visible = u < 0.995 && op.kind === 'fold';
  guideMat.opacity = 1 - 0.7 * ease(u);
  lineMat.visible = ui.creases.checked;
  grid.userData.goal = op.def.grid ? 0.35 : 0;
  ui.scrub.value = Pv;
}

// ---------- UI wiring ----------
const stepsEl = document.getElementById('steps');
STEPS.forEach((s, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<button class="head"><span class="num">${i + 1}</span><span><span class="t">${s.title}</span><span class="b">${s.blurb}</span></span></button>
    <div class="body"><ul>${s.points.map((p) => `<li>${p}</li>`).join('')}</ul></div>`;
  li.querySelector('.head').addEventListener('click', () => goStep(i, true));
  stepsEl.appendChild(li);
});
document.getElementById('tiplist').innerHTML = TIPS.map(([h, t]) => `<li><b>${h}:</b> ${t}</li>`).join('');

function setPlaying(on) {
  playing = on;
  ui.play.textContent = on ? '⏸ Pause' : P >= N - 1e-6 ? '⟲ Replay' : '▶ Play';
}
function goStep(i, play) {
  P = Math.min(N, Math.max(0, i));
  hold = 0;
  stopAt = ui.advance.checked ? null : Math.floor(P) + 1;
  setPlaying(!!play);
}
document.getElementById('play').addEventListener('click', () => {
  if (!playing) {
    if (P >= N - 1e-6) P = 0;
    const atStart = Math.abs(P - Math.round(P)) < 1e-3;
    stopAt = ui.advance.checked ? null : atStart ? Math.round(P) + 1 : Math.ceil(P);
  }
  setPlaying(!playing);
});
document.getElementById('next').addEventListener('click', () => goStep(Math.min(N, Math.floor(P + 1e-3) + 1), false));
document.getElementById('prev').addEventListener('click', () => goStep(Math.abs(P - Math.round(P)) < 1e-3 ? Math.max(0, Math.round(P) - 1) : Math.floor(P), false));
document.getElementById('restart').addEventListener('click', () => goStep(0, true));
ui.scrub.addEventListener('input', () => { P = parseFloat(ui.scrub.value); setPlaying(false); });
ui.camera.addEventListener('change', () => { shownOp = -1; });
controls.addEventListener('start', () => { ui.camera.checked = false; camGoal = null; });
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'Space') { e.preventDefault(); document.getElementById('play').click(); }
  else if (e.key === 'ArrowRight') document.getElementById('next').click();
  else if (e.key === 'ArrowLeft') document.getElementById('prev').click();
  else if (e.key.toLowerCase() === 'r') document.getElementById('restart').click();
});

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------- main loop ----------
camera.position.copy(CAMS.top.pos);
controls.target.copy(CAMS.top.target);
setCamGoal('top');
camera.position.copy(camGoal.pos);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (playing) {
    if (hold > 0) hold -= dt;
    else {
      const si = Math.min(N - 1, Math.floor(P + 1e-9));
      const before = P;
      P += (dt * parseFloat(ui.speed.value)) / STEP_SECONDS[si];
      const edge = Math.floor(before + 1e-9) + 1;
      if (P >= edge) {
        if (edge >= N) { P = N; setPlaying(false); }
        else if (stopAt !== null && edge >= stopAt) { P = edge; setPlaying(false); }
        else { P = edge; hold = HOLD; }
      }
    }
  }
  render(P);

  if (camGoal && ui.camera.checked) {
    const k = 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(camGoal.pos, k);
    controls.target.lerp(camGoal.target, k);
  }
  grid.material.opacity += ((grid.userData.goal ?? 0) - grid.material.opacity) * (1 - Math.exp(-dt * 4));
  grid.visible = grid.material.opacity > 0.01;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// test / debug hook
window.__plane = { view: (p, t) => { ui.camera.checked = false; camGoal = null; camera.position.set(...p); controls.target.set(...t); }, setProgress: (v) => { P = v; setPlaying(false); }, total: N, snap: () => { camGoal && camera.position.copy(camGoal.pos) && controls.target.copy(camGoal.target); } };
