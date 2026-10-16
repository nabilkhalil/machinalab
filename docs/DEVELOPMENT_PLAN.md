# MachinaLab 2 — development plan (from v1.1)

Brief received 2026-10-16: upgrade MachinaLab 1.1 into an engaging, student-centred virtual CNC
machining laboratory (industrial dashboard, synchronised 3D turning view, guided challenges with
prediction questions and feedback, local progress tracking, accessibility and mobile work), while
keeping the validated engine, Excel parity, GitHub Pages compatibility and the security rules.

## Ground rules carried over (CLAUDE.md)

- `site/js/model.js` is untouched. Every stage must pass the baseline lock and Excel parity unchanged.
  Any new physical quantity shown to students (e.g. feed rate vf = f·N) goes through `model-change`.
- No ES modules, no CDNs, no network calls, no build step. Three.js is the one approved runtime
  dependency ([decision 0001](decisions/0001-three-js-3d-turning-view.md)).
- One stage = one coherent change, on a `stage-N-*` branch. Pull request into `main`; CI runs both
  suites on the PR; `main` deploys to students only after merge. **No untested change reaches `main`.**
- Every visual element is classed as **model prediction** (computed by `model.js`, workbook-verified)
  or **illustration** (drawn for understanding, scaled, not physical). The UI labels both.

## Audit summary (2026-10-16)

| Area | State | Implication for the upgrade |
|---|---|---|
| Engine (`model.js`, 74 lines) | Pure, workbook-verified, baseline-locked | Reuse as is. Visual layers consume its outputs only |
| UI (`app.js`, 279 dense lines; `index.html`, `styles.css` minified) | Works, axe-clean, but hard to extend | Refactor into readable modules **before** the redesign (separate stage, no behaviour change) |
| Charts (`charts.js`) | Dependency-free SVG with tables | Keep; extend for prediction-question feedback |
| Tests | 169 unit, 53 browser, all passing; CI gates deploy | Every stage adds tests for its feature |
| Skills | 10 project skills cover model, UI, PBL, release | Followed per stage; `visualisation` updated for 3D |
| PBL | Free-text workbook only | Guided challenges need the lecturer's CLO wording (open question 5) |
| Change requests | B and C cannot change the ranking (audit E4, E5) | Challenges frame them as "does your decision survive?" until the lecturer decides |

## Stages

| Stage | Brief phase | Content | Status |
|---|---|---|---|
| 9 | 2 + 3 | **3D turning view prototype**, synchronised with Vc, f and ap; SVG schematic fallback; reduced-motion; illustration vs prediction labels | **done on branch `stage-9-turning-3d`, awaiting review** |
| 10 | 1 | Refactor `app.js`/`index.html`/`styles.css` into readable files, numerically and visually identical (rule 4: refactor separate from behaviour) | planned |
| 11 | 1 | Industrial dashboard redesign: machine-console layout, status strip (spindle, feed, power vs limit, Ra vs limit), global reduce-motion and high-contrast settings, mobile layout | planned |
| 12 | 4 | Guided industrial challenges: predict → run → compare → explain. Prediction questions with immediate, model-computed ✓/✗ feedback; written reasoning never auto-graded; CLO tags once supplied | planned, needs CLOs |
| 13 | 4 | Progress tracking in `localStorage` (separate versioned key, no personal data, included in the progress file and CSV) | planned |
| 14 | 5 | Accessibility, mobile and performance pass (low-end laptop budget), full release checklist, merge to `main`, deploy, live check | planned |

Phase 1 of the brief (redesign) is placed after the 3D prototype on purpose: the dashboard layout
depends on where the 3D view sits, and the `app.js` refactor (stage 10) makes the redesign safe.

## Stage 9 design

```
model.js  ──calc()──►  turning.js (pure)  ──motion──►  lathe3d.js (Three.js, browser only)
 (prediction)           maps a result to drawing       rotating bar, tool, feed, chips,
                        scales, timing and an SVG       material removal; orbit by drag
                        schematic; Node-tested          or buttons; pauses when hidden
```

### Synchronisation (constant factors, so comparisons between settings stay honest)

- Spindle rotation is drawn at **1/10 of the predicted spindle speed N**: doubling Vc visibly doubles
  the rotation. Capped at 4 rev/s on screen to avoid strobing (the UI says when it is capped).
- Feed per revolution is drawn **× 50** so the feed marks are visible; the tool advances exactly one
  drawn feed mark per drawn revolution, so the helix and the tool motion agree.
- Consequence: one pass on screen takes **cutting time × 0.2**. Doubling f or Vc halves the pass
  time, exactly as the predicted cutting time halves. Clamped to 2–45 s (UI says when).
- Depth of cut is drawn at true proportion unless it is under 12 % of the bar radius, then it is
  exaggerated to 12 % and labelled ("depth drawn × 6").
- Bar length is drawn in true proportion to the diameter, limited to 2–8 radii (labelled when limited).

### Not modelled by the view (shown on the Models page)

Chips, colours and the look of the surface are illustrative. The view shows no
temperatures, vibration, tool wear, chip form or measured roughness. Only the numbers in the readout
come from the validated model.

### Performance budget (ordinary student laptop, integrated graphics)

Three.js loads only when the simulator opens; under 2,000 triangles; pixel ratio capped at 1.5;
animation stops when the page is hidden, another page is open, or the student pauses; one static
frame is drawn in reduced-motion mode.
