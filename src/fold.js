// Origami fold engine: the sheet is a set of convex polygons ("pieces").
// A fold splits pieces along a crease line, then rigidly rotates one side
// around that line. Every op is precomputed so the UI can scrub back and forth.
import { Vector3, Vector2, Matrix4, MathUtils } from '../vendor/three.module.js';

export const PAPER = { w: 21, h: 29.7 }; // A4, cm
const LAYER = 0.02; // visual paper thickness used to stack folded layers

const cloneVert = (v) => ({ p: v.p.clone(), uv: v.uv.clone() });
const clonePiece = (pc) => ({ verts: pc.verts.map(cloneVert), tags: new Set(pc.tags) });

export function makeSheet() {
  const hw = PAPER.w / 2, hh = PAPER.h / 2;
  const vtx = (x, y) => ({
    p: new Vector3(x, y, 0),
    uv: new Vector2((x + hw) / PAPER.w, (y + hh) / PAPER.h),
  });
  return [{ verts: [vtx(-hw, -hh), vtx(hw, -hh), vtx(hw, hh), vtx(-hw, hh)], tags: new Set() }];
}

export function pieceArea(pc) {
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  let sum = 0;
  for (let i = 1; i < pc.verts.length - 1; i++) {
    a.subVectors(pc.verts[i].p, pc.verts[0].p);
    b.subVectors(pc.verts[i + 1].p, pc.verts[0].p);
    sum += c.crossVectors(a, b).length() / 2;
  }
  return sum;
}

// Split a convex piece by the plane through P with normal S (in-plane).
function splitPiece(pc, P, S) {
  const E = 1e-6;
  const d = pc.verts.map((v) => v.p.clone().sub(P).dot(S));
  if (d.every((x) => x >= -E)) return { pos: pc, neg: null };
  if (d.every((x) => x <= E)) return { pos: null, neg: pc };
  const pos = [], neg = [];
  const n = pc.verts.length;
  for (let i = 0; i < n; i++) {
    const a = pc.verts[i], b = pc.verts[(i + 1) % n];
    const da = d[i], db = d[(i + 1) % n];
    if (da >= -E) pos.push(cloneVert(a));
    if (da <= E) neg.push(cloneVert(a));
    if ((da > E && db < -E) || (da < -E && db > E)) {
      const t = da / (da - db);
      const m = { p: a.p.clone().lerp(b.p, t), uv: a.uv.clone().lerp(b.uv, t) };
      pos.push(cloneVert(m));
      neg.push(cloneVert(m));
    }
  }
  const mk = (verts) => {
    const pc2 = { verts, tags: new Set(pc.tags) };
    return verts.length >= 3 && pieceArea(pc2) > 1e-6 ? pc2 : null;
  };
  return { pos: mk(pos), neg: mk(neg) };
}

// Convex polygon overlap in the XY plane (touching edges do not count).
function overlapXY(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const ax = -(q.y - p.y), ay = q.x - p.x;
      const len = Math.hypot(ax, ay) || 1;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const v of a) { const d = (v.x * ax + v.y * ay) / len; minA = Math.min(minA, d); maxA = Math.max(maxA, d); }
      for (const v of b) { const d = (v.x * ax + v.y * ay) / len; minB = Math.min(minB, d); maxB = Math.max(maxB, d); }
      if (maxA <= minB + 1e-4 || maxB <= minA + 1e-4) return false;
    }
  }
  return true;
}

const rotAbout = (P, axis, rad) => {
  const toP = new Matrix4().makeTranslation(P.x, P.y, P.z);
  const fromP = new Matrix4().makeTranslation(-P.x, -P.y, -P.z);
  const rot = new Matrix4().makeRotationAxis(axis, rad);
  return toP.multiply(rot).multiply(fromP);
};

const bake = (before, M) =>
  before.map(({ pc, moving }) => {
    const c = clonePiece(pc);
    if (moving) c.verts.forEach((v) => v.p.applyMatrix4(M));
    return c;
  });

function planFold(pieces, def) {
  const n = def.n.clone().normalize();
  const S = def.S.clone().normalize(); // in-plane, points toward the side that moves
  const D = new Vector3().crossVectors(S, n).normalize(); // hinge axis: rotates S toward n
  const only = def.only || {};
  const eligible = (pc) => (!only.has || pc.tags.has(only.has)) && (!only.not || !pc.tags.has(only.not));
  const P = def.P.clone();

  const before = [];
  for (const pc of pieces) {
    if (!eligible(pc)) { before.push({ pc: clonePiece(pc), moving: false }); continue; }
    const { pos, neg } = splitPiece(clonePiece(pc), P, S);
    if (pos) before.push({ pc: pos, moving: true });
    if (neg) before.push({ pc: neg, moving: false });
  }
  const mov = before.filter((b) => b.moving);
  const fix = before.filter((b) => !b.moving);

  // The hinge sits at the height of the moving layers' crease edge.
  const onLine = (v) => Math.abs(v.p.clone().sub(P).dot(S)) < 1e-4;
  const hingeZ = mov.flatMap((b) => b.pc.verts.filter(onLine).map((v) => v.p.dot(n)));
  const zm = hingeZ.length ? hingeZ.reduce((a, b) => a + b, 0) / hingeZ.length : P.dot(n);
  P.addScaledVector(n, zm - P.dot(n));

  const rad = MathUtils.degToRad(def.deg);
  const Mrot = rotAbout(P, D, rad);

  let shift = 0;
  const mode = def.lift ?? false;
  if (mode === true) {
    // stack folded layers on top of whatever they land on
    const moved = mov.map((b) => b.pc.verts.map((v) => v.p.clone().applyMatrix4(Mrot)));
    let need = 0;
    moved.forEach((mv) => {
      const mMin = Math.min(...mv.map((p) => p.dot(n)));
      fix.forEach((f) => {
        const fv = f.pc.verts.map((v) => v.p);
        if (overlapXY(mv, fv)) need = Math.max(need, Math.max(...fv.map((p) => p.dot(n))) - mMin + LAYER);
      });
    });
    shift = need;
  } else if (mode === 'level') {
    // keep the hinge continuous with the closest fixed layer
    const cands = fix.flatMap((b) => b.pc.verts.filter(onLine).map((v) => v.p.dot(n)));
    if (cands.length) {
      const zf = cands.reduce((best, z) => (Math.abs(z - zm) < Math.abs(best - zm) ? z : best), cands[0]);
      shift = zf - zm;
    }
  }

  const shiftVec = n.clone().multiplyScalar(shift);
  const matrixAt = (u) =>
    new Matrix4()
      .makeTranslation(shiftVec.x * u, shiftVec.y * u, shiftVec.z * u)
      .multiply(rotAbout(P, D, rad * u));

  const after = bake(before, matrixAt(1));
  after.forEach((pc, i) => {
    if (!before[i].moving) return;
    (def.addTags || []).forEach((t) => pc.tags.add(t));
    (def.removeTags || []).forEach((t) => pc.tags.delete(t));
  });
  return { def, kind: 'fold', before, after, matrixAt, guide: { P, D } };
}

function planRigid(pieces, def) {
  const before = pieces.map((pc) => ({ pc: clonePiece(pc), moving: true }));
  const rad = MathUtils.degToRad(def.deg);
  const t = def.translate || new Vector3();
  const matrixAt = (u) =>
    new Matrix4().makeTranslation(t.x * u, t.y * u, t.z * u).multiply(rotAbout(def.P, def.axis, rad * u));
  return { def, kind: 'rigid', before, after: bake(before, matrixAt(1)), matrixAt, guide: null };
}

// The finished plane glides away from the camera (not baked into later state).
function planFly(pieces, def) {
  const before = pieces.map((pc) => ({ pc: clonePiece(pc), moving: true }));
  const matrixAt = (u) => {
    const run = 1 - Math.pow(1 - u, 1.6);
    const x = -120 * run;
    const y = 9 * Math.sin(Math.PI * 0.85 * run) - 6 * run * run;
    const dy = 9 * Math.PI * 0.85 * Math.cos(Math.PI * 0.85 * run) - 12 * run;
    const pitch = -Math.atan2(dy, 120);
    const roll = MathUtils.degToRad(7) * Math.sin(run * 6);
    return new Matrix4()
      .makeTranslation(x, y, 0)
      .multiply(new Matrix4().makeRotationZ(pitch))
      .multiply(new Matrix4().makeRotationX(roll));
  };
  return { def, kind: 'fly', before, after: before.map((b) => clonePiece(b.pc)), matrixAt, guide: null };
}

export function buildTimeline(stepDefs) {
  let pieces = makeSheet();
  const steps = [];
  const ops = [];
  stepDefs.forEach((sd, si) => {
    const st = { def: sd, ops: [] };
    sd.ops.forEach((od) => {
      const op = od.type === 'rigid' ? planRigid(pieces, od) : od.type === 'fly' ? planFly(pieces, od) : planFold(pieces, od);
      op.stepIndex = si;
      op.index = ops.length;
      pieces = op.after;
      ops.push(op);
      st.ops.push(op);
    });
    steps.push(st);
  });
  return { steps, ops, finalPieces: pieces };
}
