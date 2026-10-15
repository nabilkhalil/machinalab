# MachinaLab — MMT15603 Virtual Machinability Simulator

Browser-based teaching simulator for CNC finish-turning of AISI 1045 steel. Students on the
MMT15603 *Assessment of Machinability* course run virtual experiments and assess feasibility and cost, then justify a
cutting-parameter recommendation through a PBL workbook. The app is a translation of
`MMT15603_Virtual_Machinability_Simulator.xlsx`, which is the engineering reference.

Audience: undergraduate engineering students with **no programming experience**, plus
lecturers who set the PBL tasks and mark the exported results.

## Current state (as of the 2026-10-15 audit — see `docs/AUDIT.md`)

- Stage 1 done (see `docs/CHANGELOG.md`). Git repo on `main`.
- App: `site/index.html`, `site/app.js` (single minified-style script), `site/styles.css`.
  Code unchanged since the audit. Only `site/` is deployed.
- Workbook: `reference/MMT15603_Virtual_Machinability_Simulator.xlsx`. Parity run on 2026-10-15
  (`docs/excel-parity-report.md`): **all machining quantities match exactly**. The **decision matrix does
  not** (E12): Excel scores productivity, power and cost by ratio to best, and JS uses min–max. Awaiting
  lecturer confirmation before changing `scores()`.
- Tests: `npm test` runs the baseline lock and Excel parity (62 pass, 9 `todo` = known
  discrepancies E12/E13). `npm run test:browser` runs 13 Playwright tests. Two of them are `test.fail` for
  known bugs U1 and S2. Never delete a `todo` or `test.fail`. Remove the marker only when the fix lands.
- Python venv `.venv/` (openpyxl) is used by `npm run excel:extract`. It's git-ignored.
- Next: Stage 2, workbook alignment (E12 scoring, E13 cost outputs, E15 student prompts).

## Non-negotiable rules

1. **Equations are controlled.** Do not change any formula, constant, unit or
   scenario rule in the model without using the `model-change` skill. Each change needs a
   written engineering basis (a cited textbook or standard, or a workbook cell reference),
   updated golden tests, and an entry in `docs/MODEL_CHANGELOG.md`. Refactors must be
   numerically identical (relative difference ≤ 1e-12) to the baseline.
2. **No framework replacement without justification.** The app stays vanilla HTML/CSS/JS with
   no build step and no runtime dependencies. Proposals to add a framework or a bundler need a
   written trade-off in `docs/decisions/` and the user's approval first.
3. **Must work from `file://` and from GitHub Pages.** Do not use ES modules (`type="module"`), `fetch()` of
   local files, or absolute paths (`/styles.css`), because these break double-click opening or a project-pages sub-path.
   Use classic `<script>` tags in dependency order. Shared code goes in a global
   namespace (`window.MachinaLab`), with `module.exports` when loaded under Node so it can be tested.
4. **Incremental stages.** One stage = one coherent change. Before the stage, run the
   full test suite and record the result. After it, run the suite again plus a manual or Playwright
   smoke test, then record the results in `docs/CHANGELOG.md`. Never mix a refactor with
   a behaviour change in the same stage.
5. **No student data leaves the browser.** No analytics, no network calls, no external
   fonts or CDNs at runtime. Data persists only in `localStorage` and in files the student
   exports.

## Target architecture (introduced in Stages 1–3; don't create it all at once)

```
site/                    ← the ONLY folder deployed to GitHub Pages
  index.html
  styles.css
  js/model.js            ← pure machining calculations, no DOM, no state; Node-testable
  js/params.js           ← parameter schema: key, label, unit, min, max, step, default, help text
  js/validate.js         ← validate + sanitise (also used on localStorage load)
  js/export.js           ← pure CSV/JSON builders (injection-safe)
  js/charts.js           ← SVG chart builders
  js/app.js              ← state, rendering, event wiring
tests/unit/*.test.js     ← node:test (built-in, zero deps)
tests/browser/*.spec.js  ← Playwright
tests/fixtures/          ← baseline-v1.json, excel-golden.json
tools/extract_excel.py   ← workbook → excel-golden.json
reference/               ← the .xlsx workbook (not deployed)
docs/                    ← AUDIT, CHANGELOG, MODEL_CHANGELOG, decisions/
```

Script load order in `index.html`: `params.js → model.js → validate.js → export.js →
charts.js → app.js`.

## Commands (available once Stage 1 lands)

```
npm test                 # node --test tests/unit
npm run test:browser     # npx playwright test
npm run serve            # python -m http.server 8000 -d site
npm run check            # unit + browser + security grep checks
```

Node ≥ 18 is required for `node:test`. Python is needed only for `tools/extract_excel.py` (needs `openpyxl`).

## Engineering model (matches the workbook exactly; see docs/excel-formula-map.md)

| Quantity | Formula | Unit |
|---|---|---|
| Depth of cut | ap = (Di − Df)/2 | mm |
| Mean diameter | Dm = (Di + Df)/2 | mm |
| Spindle speed | N = 1000·Vc/(π·Dm) | rev/min |
| MRR | 1000·Vc·f·ap | mm³/min |
| Theoretical Ra | 1000·f²/(32·rε) | µm |
| Cutting force | Fc = kc·ap·f | N |
| Cutting power | Pc = Fc·Vc/60000 | kW |
| Input power | Pc/η | kW |
| Cutting time | 60·L/(f·N) | s |
| Cost/part | tcycle/3600·rate + tcut/60/T·insert/edges | RM |
| Feasible | Ra ≤ Ra_limit AND Pinput ≤ Pmax | — |

Scenarios: A sets Ra_limit = 0.8 µm; B sets batch = 3500; C sets T = 0.6·T.
Decision scores are normalised across all nine trials, including infeasible ones. This is intended,
per DECISION MATRIX!J12. Only feasible trials receive a weighted score. Workbook method (the reference):
Ra uses min–max (lower is better); productivity = 100·MRR/max; power = 100·min/P; cost = 100·min/C.
The current JS uses min–max for all four, which is known discrepancy E12.

Units shown to students must always match this table. MRR is shown as cm³/min in the UI
and stored as mm³/min in data. Label which one you use every time.

## Educational requirements

- Plain language first, symbol second: "Feed per revolution, f (mm/rev)".
- Every input shows its unit and allowed range, plus a one-line "what this means" hint.
- Error messages say what is wrong, why it matters physically, and how to fix it.
  Never show `NaN`, `Infinity`, stack traces or raw JS errors to students.
- Every predicted value is labelled as a model prediction, not a measurement.
- Do not let invalid inputs produce results: show the message and hide or grey out the outputs.
- Keyboard focus must survive re-rendering (students Tab between fields).
- Meet WCAG 2.2 AA: labelled controls, contrast ≥ 4.5:1 for text, charts have text alternatives.

## Security requirements

- Escape every interpolated value in HTML templates (`esc()`), including numbers loaded
  from `localStorage`, which a user or another page on the same `github.io` origin can tamper with.
- Validate and sanitise the `localStorage` state against the parameter schema on load. Fall back to
  defaults per field, never wholesale crash.
- Wrap all `localStorage` access in try/catch. Private mode and quota limits can throw.
- CSV export: neutralise formula injection. Prefix cells starting with `= + - @ \t \r` with `'`.
- Content-Security-Policy via `<meta>`: `default-src 'self'; script-src 'self'; style-src 'self';
  img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'`. No inline
  scripts, inline event handlers or `style=` attributes.
- Pin GitHub Action versions. Deploy only `site/`.

## Skills (`.claude/skills/`)

| Skill | Use when |
|---|---|
| `model-change` | Touching any formula, constant, unit or scenario rule |
| `excel-parity` | Extracting reference values from the workbook and comparing them with the JS model |
| `test-suite` | Writing or running unit and browser tests |
| `input-validation` | Adding or changing any input, parameter or stored-state field |
| `security-check` | Before any release; after touching templates, storage, export or deploy |
| `student-ui` | Any user-facing text, layout, form or accessibility work |
| `visualisation` | Charts, plots, process diagrams |
| `pbl-activity` | Authoring guided tasks, change requests and reflection prompts |
| `data-export` | CSV/JSON/print report output |
| `stage-release` | Closing a stage: verify, document, deploy to GitHub Pages |

## Working conventions

- Readable code over compact code: one statement per line, named functions, short comments
  that explain *engineering intent*, not syntax. The current `app.js` style is not the target.
- British/Malaysian English spelling in UI (`visualisation`, `colour`). Currency is RM.
  Number format is `en-MY`.
- When you are unsure whether a behaviour is intended (e.g. scores normalised over
  infeasible trials), keep current behaviour, flag it in `docs/AUDIT.md` → *Open questions*,
  and ask.
