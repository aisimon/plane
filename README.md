# plane — fold a paper airplane in 3D

An interactive 3D walkthrough for folding a classic high-performance dart from one sheet of A4 / Letter paper.
Every fold is real geometry: the sheet is split along each crease and the flaps are rotated about it, so you can
scrub, pause and orbit around the paper at any moment.

## Run

```bash
npm start            # = python3 -m http.server 8080  →  http://localhost:8080
```

(Any static file server works; ES modules need `http://`, not `file://`.) three.js is vendored in `vendor/`, so it runs offline.

## Use

- **Play / Next / Prev / scrub** through the 6 steps; click a step in the sidebar to jump to it.
- Drag to orbit, scroll to zoom. Dragging turns off *Auto camera*; tick it again to resume the guided views.
- White side = front of the sheet, coral side = back, so you can follow every flip. The yellow dashed line is the crease being folded.
- Keys: `Space` play/pause · `←/→` step · `R` restart.

## Layout

| file | purpose |
|---|---|
| `src/steps.js` | the folding recipe (crease lines, directions, captions) |
| `src/fold.js` | fold engine: polygon splitting, hinge rotation, layer stacking |
| `src/main.js` | three.js scene, timeline/scrubber, UI |
| `test/fold.test.mjs` | `npm test` — checks paper area & edge lengths are conserved and the final pose |
