// Sanity checks for the fold engine: run with `node test/fold.test.mjs`
import assert from 'node:assert/strict';
import { Box3, Vector3 } from '../vendor/three.module.js';
import { buildTimeline, pieceArea, PAPER } from '../src/fold.js';
import { STEPS } from '../src/steps.js';

const tl = buildTimeline(STEPS);
const total = PAPER.w * PAPER.h;

// 1. paper is conserved through every op (folding never creates/destroys area)
tl.ops.forEach((op) => {
  const sum = (list) => list.reduce((s, pc) => s + pieceArea(pc), 0);
  assert.ok(Math.abs(sum(op.before.map((b) => b.pc)) - total) < 1e-3, `area before op ${op.index}`);
  assert.ok(Math.abs(sum(op.after) - total) < 1e-3, `area after op ${op.index}`);
});

// 2. edge lengths preserved (rigid pieces): each piece keeps its perimeter
tl.ops.forEach((op) => {
  op.before.forEach((b, i) => {
    const a = op.after[i];
    b.pc.verts.forEach((v, j) => {
      const w = b.pc.verts[(j + 1) % b.pc.verts.length];
      const v2 = a.verts[j], w2 = a.verts[(j + 1) % a.verts.length];
      assert.ok(Math.abs(v.p.distanceTo(w.p) - v2.p.distanceTo(w2.p)) < 1e-6);
    });
  });
});

// 3. final shape: nose points to -x, wings extend to both sides in z, wings tilt up
const box = new Box3();
tl.finalPieces.forEach((pc) => pc.verts.forEach((v) => box.expandByPoint(v.p)));
const size = box.getSize(new Vector3());
console.log('final bbox size', size.toArray().map((x) => x.toFixed(2)).join(' x '), 'min', box.min.toArray().map((x) => x.toFixed(2)), 'max', box.max.toArray().map((x) => x.toFixed(2)));
assert.ok(box.min.z < -3 && box.max.z > 3, 'wings span both sides');
assert.ok(Math.abs(box.min.x + 14.85) < 0.05, 'nose at x=-14.85');
console.log('pieces:', tl.finalPieces.length, 'ops:', tl.ops.length);
console.log('OK');
