# 0001 — Three.js for the 3D turning view

- Status: **accepted** by the project owner on 2026-10-16 (chosen over a dependency-free canvas renderer)
- Stage: 9 (3D turning visualisation)
- Rule affected: CLAUDE.md rule 2 (no runtime dependencies without a written trade-off and approval)

## Context

The upgrade brief asks for an interactive 3D CNC turning visualisation: a rotating workpiece, a
cutting tool, feed movement and animated material removal, synchronised with cutting speed, feed and
depth of cut. MachinaLab has no runtime dependencies, must open from `file://` and GitHub Pages,
runs under a strict CSP (`script-src 'self'`) and loads no CDNs (rules 3 and 5).

## Options considered

| | Three.js r159, vendored | Hand-written Canvas 2.5D |
|---|---|---|
| Visual result | True 3D, lighting, free orbit camera | Fixed oblique view, convincing but flat |
| Size | +668 KB (three.min.js), loaded only when the simulator page opens | ~15 KB |
| `file://` / Pages | Works: classic `<script>` build | Works |
| CSP | Works: no `eval`/`new Function` (checked), served from `'self'` | Works |
| Maintenance | Frozen at r159 (2023): the last release with a classic script build. Newer releases are ES modules only, which rule 3 forbids | Ours to maintain |
| Hardware | Needs WebGL; some lab PCs block it, so a fallback is required | Canvas 2D everywhere |
| Rule 2 | New runtime dependency | No dependency |

## Decision

Use **Three.js r159** (`three@0.159.0`, `build/three.min.js`), copied unmodified into
`site/js/vendor/three.min.js` with its MIT licence (`three.LICENSE.txt`).

- Source: npm tarball `three@0.159.0`, integrity
  `sha512-eCmhlLGbBgucuo4VEA9IO3Qpc7dh8Bd4VKzr7WfW4+8hMcIfoAVi1ev0pJYN9PTTsCslbcKgBwr2wNZ1EvLInA==`
  (verified by npm). SHA-256 of the vendored file:
  `7b1c5d75b28d9de15042e2b374f83566d8c7146697af8fdeb4558b0fb528a585`. `tests/unit/turning.test.js`
  checks this hash so the file cannot change silently.
- Loaded lazily (a `<script>` element added the first time the Live Simulator page opens), so
  the other pages start as fast as before.
- Only core classes are used (no `examples/` add-ons: OrbitControls was removed from the classic
  build in r148, so camera orbit is our own ~40 lines in `site/js/lathe3d.js`).
- r159 prints one console **warning** on load ("build/three.min.js is deprecated"). It is harmless
  and does not count as a console error in the browser tests.

## Consequences

- A labelled SVG turning schematic (`site/js/turning.js`) is always shown alongside the 3D view.
  It is the fallback when WebGL or the script is unavailable, and the view used in print.
- The engine stays separate: `model.js` → `turning.js` (pure mapping from model results to
  drawing and motion, unit-tested) → `lathe3d.js` (Three.js scene, browser only).
- Upgrading Three.js beyond r159 would need ES modules or a build step, i.e. a new decision record.
- Security: the vendored file is third-party code running on the student's page. Its only network
  code (`fetch` in `FileLoader`/`ImageBitmapLoader`) is never called: all textures are drawn on canvases.
  Even if it were, the CSP (`default-src 'self'`, no `connect-src` exception) blocks any other origin.
  Re-verify the hash on any change (security-check skill).
