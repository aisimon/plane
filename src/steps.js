// Folding recipe. Paper is centred at the origin: x in [-10.5, 10.5], y in [-14.85, 14.85],
// seen from +z. A fold rotates the side that S points to over toward n (the viewer) by `deg`.
import { Vector3 } from '../vendor/three.module.js';

const v = (x, y, z = 0) => new Vector3(x, y, z);
const Z = v(0, 0, 1);
const NZ = v(0, 0, -1);
const HH = 14.85; // half height
const A = Math.PI / 8; // 22.5 deg: bisector between slanted edge (45 deg) and centre line
const WING_Y = 0.25; // wing crease, 5.5 cm above the spine once the plane is turned on its side
const DIHEDRAL = 10; // degrees the wings tilt up

export const STEPS = [
  {
    title: 'Create the center crease',
    blurb: 'Fold in half, crease, unfold',
    points: [
      'Lay the sheet flat in portrait orientation.',
      'Fold it in half from left to right (“hot dog style”), aligning the side edges precisely.',
      'Crease firmly with a fingernail or the flat of your thumb.',
      'Unfold completely — one vertical crease runs down the center.',
    ],
    ops: [
      { type: 'fold', caption: 'Fold the left half over the right, edges aligned', P: v(0, 0, 0), S: v(-1, 0, 0), n: Z, deg: 180, lift: true, addTags: ['tmp'], cam: 'top' },
      { type: 'fold', caption: 'Unfold — a single crisp crease remains', P: v(0, 0, 0), S: v(1, 0, 0), n: Z, deg: 180, only: { has: 'tmp' }, removeTags: ['tmp'], lift: 'level', cam: 'top' },
    ],
  },
  {
    title: 'Fold the top corners',
    blurb: 'Top edge meets the center line',
    points: [
      'Fold the top-left corner down diagonally until the top edge sits exactly on the center crease.',
      'Repeat with the top-right corner.',
      'Check: the top half is now a symmetrical triangle point.',
    ],
    ops: [
      { type: 'fold', caption: 'Top-left corner to the center line', P: v(0, HH, 0), S: v(-Math.SQRT1_2, Math.SQRT1_2, 0), n: Z, deg: 180, lift: true, cam: 'top' },
      { type: 'fold', caption: 'Top-right corner to the center line', P: v(0, HH, 0), S: v(Math.SQRT1_2, Math.SQRT1_2, 0), n: Z, deg: 180, lift: true, cam: 'top' },
    ],
  },
  {
    title: 'Taper the nose',
    blurb: 'Slanted edges onto the center fold',
    points: [
      'Take the outer slanted edge on the top-left and fold it inward so it lines up along the center fold.',
      'Repeat on the top-right side.',
      'Press firmly down the full length of both folds.',
      'Check: you now have a sharp, narrow dart with a steep point.',
    ],
    ops: [
      { type: 'fold', caption: 'Slanted edge (left) onto the center fold', P: v(0, HH, 0), S: v(-Math.cos(A), Math.sin(A), 0), n: Z, deg: 180, lift: true, cam: 'top' },
      { type: 'fold', caption: 'Slanted edge (right) onto the center fold', P: v(0, HH, 0), S: v(Math.cos(A), Math.sin(A), 0), n: Z, deg: 180, lift: true, cam: 'top' },
    ],
  },
  {
    title: 'Fold the airplane in half',
    blurb: 'Close it along the original crease',
    points: [
      'Fold the whole structure in half along the original center crease.',
      'Keep every internal fold tucked inside the body.',
      'Smooth the folded edge — you should have a long, slim triangle.',
    ],
    ops: [
      { type: 'fold', caption: 'Close the dart along the center crease — flaps stay inside', P: v(0, 0, 0), S: v(-1, 0, 0), n: Z, deg: 180, lift: true, addTags: ['B'], cam: 'top' },
    ],
  },
  {
    title: 'Form the wings',
    blurb: 'Fold each side down parallel to the spine',
    points: [
      'Position the folded paper with the straight fold (spine) toward you and the point facing left.',
      'Fold the top flap down toward the bottom edge, parallel to the spine, about 5.5 cm up from it.',
      'Flip the airplane over and repeat the exact same fold on the other side — both wings must match in height and length.',
    ],
    ops: [
      { type: 'rigid', caption: 'Turn it: spine toward you, point to the left', P: v(5.25, 0, 0), axis: Z, deg: 90, translate: v(-5.25, 0, 0), cam: 'top' },
      { type: 'fold', caption: 'Fold the top flap down, parallel to the spine', P: v(0, WING_Y, 0), S: v(0, 1, 0), n: Z, deg: 180, only: { has: 'B' }, lift: true, addTags: ['wB'], cam: 'top' },
      { type: 'rigid', caption: 'Flip the airplane over', P: v(0, 0, 0), axis: v(0, 1, 0), deg: 180, cam: 'top' },
      { type: 'fold', caption: 'Repeat the same fold on the other side', P: v(0, WING_Y, 0), S: v(0, 1, 0), n: Z, deg: 180, only: { not: 'B' }, lift: true, addTags: ['wA'], cam: 'top' },
      { type: 'rigid', caption: 'Flip it back, spine down', P: v(0, 0, 0), axis: v(0, 1, 0), deg: 180, cam: 'top' },
    ],
  },
  {
    title: 'Final adjustment & launch',
    blurb: 'Open the wings and throw',
    points: [
      'Open the wings so they sit nearly perpendicular to the fuselage — a slight “V” seen from behind (positive dihedral).',
      'Make sure the nose is straight and sharp.',
      'Hold the fuselage right under the wings, just behind the center of gravity, and toss it forward with a smooth, straight motion.',
    ],
    ops: [
      { type: 'fold', caption: 'Lift the near wing — just past horizontal', P: v(0, WING_Y, 0), S: v(0, -1, 0), n: Z, deg: 90 + DIHEDRAL, only: { has: 'wB' }, lift: 'level', cam: 'rear' },
      { type: 'fold', caption: 'Lift the far wing — a slight V from behind', P: v(0, WING_Y, 0), S: v(0, -1, 0), n: NZ, deg: 90 + DIHEDRAL, only: { has: 'wA' }, lift: 'level', cam: 'rear' },
      { type: 'fly', caption: 'Smooth, straight toss — enjoy the flight!', cam: 'fly', grid: true, w: 2 },
    ],
  },
];

export const TIPS = [
  ['Keep folds crisp', 'Press along every fold with a ruler or credit card for maximum aerodynamics.'],
  ['Symmetry is key', 'If the plane turns in the air, one wing is probably larger or folded at a different angle than the other.'],
  ['Wing elevator adjustment', 'Dives straight down? Bend the back edges of the wings slightly up. Stalls and drops? Bend them slightly down.'],
];
