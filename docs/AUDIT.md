# MachinaLab repository audit — 2026-10-15

> Updated the same day after the workbook arrived: findings E12–E15 added, E1 and E6 resolved.

Scope: everything in the repository at audit time: `index.html` (1.7 KB), `app.js` (20 KB),
`styles.css` (6.3 KB), `README.md`, `.github/workflows/deploy.yml`. No code was changed.
Added in Stage 0: `CLAUDE.md`, ten skills in `.claude/skills/`, `tools/characterise-legacy.js`,
`tests/fixtures/baseline-v1.json` and this document.

---

## 1. Architecture assessment

### What it is

A single-page app with no framework, no build and no dependencies. `app.js` holds everything:
global `state` (merged from `localStorage`), the model (`calc`, `trials`, `scores`),
seven page templates that return HTML strings, a full `innerHTML` re-render on every change, and
document-level event delegation. GitHub Pages deploys the repository root via Actions.

### Strengths worth keeping

- **Zero dependencies, zero build.** It opens by double-click, works offline after load, and
  can't break from npm churn. That's ideal for a course tool that a lecturer has to maintain
  between semesters.
- **Transparent model.** The equations are standard, short, and shown to students on the
  Models page. The formulas are correct for a textbook analytical turning model
  (Ra = f²/32rε is the standard ideal-roughness approximation, and cost per part = machine-time cost + edge
  consumption is the standard decomposition).
- **Privacy by design.** There's no server, no tracking, and student data stays on the device.
- **Text fields are escaped** (`safe()`), and the CSV is UTF-8 with BOM and RFC 4180 quoting.
- A clear learning flow: configure → simulate → compare → decide → report.

### Framework recommendation: keep vanilla JS

Adding React, Vue or Svelte would bring a build step, a toolchain the lecturer has to maintain,
and either a CDN dependency (which conflicts with CSP and offline use) or a bundled output that makes the
model harder for students to read. The app has seven pages and roughly 30 inputs. That's well within
what plain DOM code handles. The real problems are **structure** (everything in one
file, model tangled with the DOM) and **full re-rendering**, and both can be solved without a
framework. **Recommendation: keep vanilla JS. Split it into classic scripts under one global
namespace (`window.MachinaLab`), not ES modules,** because ES modules don't load from
`file://` in Chromium browsers and the README promises double-click opening.

---

## 2. Findings

Severity: **H** = wrong or unsafe behaviour students will hit; **M** = quality or maintainability
risk; **L** = polish.

### Engineering and model

| # | Sev | Finding | Evidence |
|---|---|---|---|
| E1 | ~~H~~ | ~~The Excel workbook isn't in the repo.~~ **Resolved 2026-10-15:** it's now in `reference/`. The model matches it exactly (see `excel-parity-report.md`). | reference/ |
| E2 | H | Invalid inputs still produce results. If initial ≤ final diameter, ap goes negative, force and power go negative, and the app shows "FEASIBLE". The validation message is shown but calculations and feasibility still render. | app.js:6, app.js:25 |
| E3 | M | **The power constraint never binds.** At defaults the peak input power is 0.71 kW against a 7.5 kW limit, about 10×. Students never see a power trade-off. | baseline-v1.json |
| E4 | M | **Change request B is a no-op for the decision.** Batch size scales batch cost only, and the feasible set and ranking are identical to BASE. | baseline: B ranking = BASE ranking |
| E5 | M | **Change request C is a no-op for the decision.** Tool life doesn't depend on Vc (no Taylor relation), so tool cost scales with tcut, the same ordering as machine cost. The ranking is unchanged. | baseline: C ranking = BASE ranking |
| E6 | M | Decision scores are min–max normalised over all nine trials **including infeasible ones**, so in scenario A the scores of feasible trials depend on trials that were rejected. **Answered:** the workbook does the same and states it (DECISION MATRIX!J12), so it's intended. | app.js:19 |
| E7 | M | Scenario A overrides the Ra limit silently. The simulator still shows the student's "Ra limit" field (1.6) as editable while 0.8 is enforced. | app.js:5, app.js:14 |
| E8 | L | The overview's "Industrial challenge" text hard-codes Ø50→Ø49, 100 mm, 2 000 parts, 1.6 µm and 7.5 kW, which go stale when inputs change. | app.js:13 |
| E9 | L | The weights total check uses exact `!== 100`, which is fragile for non-integer weights. | app.js:8 |
| E10 | L | Trial ids use `i*3+j+1`, which assumes exactly three feed levels. | app.js:7 |
| E12 | **H** | **Decision scores differ from the workbook.** Excel uses ratio-to-best for productivity, power and cost; JS uses min–max. Same best trial (7), but ranks 4–9 differ (trial 1 is 4th in Excel, 8th in JS). | app.js:19; DECISION MATRIX!C5:E13 |
| E13 | M | The workbook's COST ANALYSIS outputs (batch hours, tool cost/part, cost at T = 15/30/60 min) aren't in the web app. | COST ANALYSIS!D:H |
| E14 | L | JS adds a 1e-9 tolerance to the feasibility limits; Excel compares exactly. They differ only when Ra equals the limit (e.g. limit 1.5625, f = 0.2). Keep it and document it. | app.js:6 |
| E15 | L | The workbook's STUDENT WORK sheet has 9 guided prompts (problem statement, assumptions, effect of feed on Ra, …). The web app has 3 free-text boxes. | STUDENT WORK!A5:A13 |
| E11 | L | The model can't express an f ≥ rε validity warning, a tool-change time or a setup cost. These are possible extensions, through `model-change` only. | — |

### Security

| # | Sev | Finding | Evidence |
|---|---|---|---|
| S1 | **H** | **The deploy publishes the repo root** (`path: .`). Once CLAUDE.md, `.claude/`, docs, tests and a future answer key are committed, they become public on Pages. | deploy.yml:22 |
| S2 | M | **CSV formula injection.** Student notes starting with `=`, `+`, `-` or `@` are exported raw, and they execute when a lecturer opens the file in Excel. | app.js:26 |
| S3 | M | **Unescaped interpolation of stored state.** `field()` writes `state[key]` into `value="…"` unescaped, and state comes unsanitised from `localStorage`. All project pages under `<user>.github.io` share an origin, so another page by the same owner can plant markup. The risk is low but real, and it's cheap to fix. | app.js:3, app.js:9 |
| S4 | M | Stored state isn't schema-checked. Wrong types or array lengths (e.g. `speeds:[1]`) silently break the page. | app.js:3 |
| S5 | M | `localStorage.setItem` isn't wrapped in try/catch. It throws in some private modes and when the quota is full, which breaks every interaction. | app.js:4 |
| S6 | L | No Content-Security-Policy. Inline `style=` attributes in the templates would need refactoring first. | app.js:14, app.js:22 |
| S7 | L | Actions are pinned to major tags (`@v4`), not commit SHAs. | deploy.yml |

### Usability, accessibility and education

| # | Sev | Finding | Evidence |
|---|---|---|---|
| U1 | **H** | **Focus is lost when tabbing between fields.** The `change` event fires on blur, `render()` replaces the whole view, and the field just tabbed into is destroyed. Students filling in the form will hit this constantly. | app.js:25, app.js:28 |
| U2 | **H** | **"Print report" prints only the experiments table**, without the student's notes, decision matrix or charts. That isn't a report. | app.js:27 |
| U3 | M | The live simulator only updates on `change` (blur or Enter), not while typing, which weakens cause-and-effect exploration. | app.js:28 |
| U4 | M | Labels aren't linked to inputs for the speed and feed levels, the weights, the scenario select and the text fields (no `for`/`id`). | app.js:16, 20, 22 |
| U5 | M | Muted text `#71899a` on white is about 3.4:1, below the WCAG AA 4.5:1 for 11–12 px text. | styles.css |
| U6 | M | Charts have no y-axis title, no limit lines and no data-table alternative. The axis floor `Math.max(…,1)` compresses small series. | app.js:17 |
| U7 | M | The bar-by-trial-number charts hide the 3×3 factorial structure. A response plot (output vs f, one line per Vc) teaches the effects directly. | app.js:17–18 |
| U8 | L | The footer says "Offline capable", but there's no service worker. That's only true when opened as a local file. | index.html |
| U9 | L | Decorative glyphs in the nav are read aloud by screen readers. | index.html |
| U10 | L | There's no way to move work between devices except notes in one browser. Add a save/open progress file. | — |

### Maintainability and testing

| # | Sev | Finding |
|---|---|---|
| M1 | **H** | There are no automated tests, and code style (minified-like single lines) makes review and diffing very hard. |
| M2 | M | Model, state, templates and events are all in one 20 KB file. The model can't be imported in isolation. |
| M3 | M | The repository isn't under git, so there's no history or rollback for incremental stages. |
| M4 | L | Parameter metadata (labels, units, ranges) is scattered across templates, validation and CSV headers. |

---

## 3. Baseline characterisation (current code, default inputs)

From `tests/fixtures/baseline-v1.json`. The trial values have since been confirmed identical to the workbook. The ranking
below is the **web app's** ranking, which differs from the workbook (E12).

| Trial | Vc | f | N (rpm) | MRR (mm³/min) | Ra (µm) | Fc (N) | Pin (kW) | tcut (s) | Cost (RM) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 100 | 0.10 | 643.05 | 5 000 | 0.391 | 90 | 0.176 | 93.31 | 2.509 |
| 2 | 100 | 0.15 | 643.05 | 7 500 | 0.879 | 135 | 0.265 | 62.20 | 1.839 |
| 3 | 100 | 0.20 | 643.05 | 10 000 | 1.563 | 180 | 0.353 | 46.65 | 1.504 |
| 4 | 150 | 0.10 | 964.58 | 7 500 | 0.391 | 90 | 0.265 | 62.20 | 1.839 |
| 5 | 150 | 0.15 | 964.58 | 11 250 | 0.879 | 135 | 0.397 | 41.47 | 1.393 |
| 6 | 150 | 0.20 | 964.58 | 15 000 | 1.563 | 180 | 0.529 | 31.10 | 1.170 |
| 7 | 200 | 0.10 | 1286.10 | 10 000 | 0.391 | 90 | 0.353 | 46.65 | 1.504 |
| 8 | 200 | 0.15 | 1286.10 | 15 000 | 0.879 | 135 | 0.529 | 31.10 | 1.170 |
| 9 | 200 | 0.20 | 1286.10 | 20 000 | 1.563 | 180 | 0.706 | 23.33 | 1.002 |

| Scenario | Feasible | Ranking (weighted score) |
|---|---|---|
| BASE | 9/9 | 7 (68.3), 8 (65.8), 4 (60.0), 5 (58.9), 9 (55.0), 6, 2, 1, 3 |
| A (Ra ≤ 0.8) | 3/9 | 7 (68.3), 4 (60.0), 1 (45.0) |
| B (batch 3 500) | 9/9 | identical to BASE |
| C (life −40 %) | 9/9 | identical to BASE (costs rise 7.5–12 %) |

Spot-check by hand, trial 5: N = 1000·150/(π·49.5) = 964.6 rpm ✓; Ra = 1000·0.15²/(32·0.8) =
0.879 µm ✓; Fc = 1800·0.5·0.15 = 135 N ✓; Pin = 135·150/60000/0.85 = 0.397 kW ✓.

---

## 4. Prioritised improvement plan

| Priority | Item | Findings | Skill |
|---|---|---|---|
| P0 | ~~Get the Excel workbook~~ (done); put the repo under git | M3 | stage-release |
| P0 | Align decision scoring with the workbook (after lecturer confirmation) | E12 | model-change (C) |
| P0 | Restrict deploy to `site/` | S1 | stage-release, security-check |
| P0 | Test harness + baseline regression lock | M1 | test-suite |
| P1 | Extract the pure model (identical numbers), parameter schema, validation and sanitising | M2, M4, E2, S3, S4, S5 | model-change (R), input-validation |
| P1 | Fix focus loss and live updating; hide results on invalid input | U1, U3, E2 | student-ui |
| P1 | CSV injection fix + versioned export + real print report + progress file | S2, U2, U10 | data-export |
| P1 | Add COST ANALYSIS outputs and the 9 STUDENT WORK prompts | E13, E15 | model-change (E), pbl-activity |
| P2 | Accessibility pass + CSP | U4, U5, U9, S6 | student-ui, security-check |
| P2 | Charts: nice axes, limit lines, response plots, feasibility map, data tables | U6, U7 | visualisation |
| P2 | Guided PBL tasks with self-checks; scenario override shown in UI | E7, E8 | pbl-activity |
| P3 | Meaningful change requests B/C (model extension, needs lecturer approval) | E3, E4, E5 | model-change (E/P), pbl-activity |
| P3 | Pin actions to SHAs, cache-busting, honest "offline" wording | S7, U8 | stage-release |

---

## 5. Implementation sequence

Each stage is independently releasable and closes with the `stage-release` checklist. Stages
1–3 must leave every number identical to `baseline-v1.json`.

| Stage | Content | Exit criteria |
|---|---|---|
| **0** (this) | Audit, CLAUDE.md, skills, baseline fixture | Done |
| **1** Foundation | `git init` (with approval); move the app into `site/` unchanged; deploy `path: site`; `package.json` with `npm test`; `tests/unit/baseline.test.js` running the legacy app through `tools/characterise-legacy.js`; first Playwright smoke test on the unchanged app | Baseline test green; app is byte-identical apart from its location; Pages preview works |
| **2** Model extraction | `site/js/model.js` (pure, Class R refactor), `params.js` schema; `app.js` calls the model | Baseline identical at ≤ 1e-12; property tests pass |
| **3** Validation and storage | `validate.js`; sanitised load; try/catch storage; results hidden when invalid; `esc()` everywhere | Corrupted-storage and XSS-payload tests pass; E2, S3, S4, S5 closed |
| **4** Excel parity | **Done early (2026-10-15):** workbook in `reference/`; extractor, golden file and parity tests; report | 49 pass / 9 todo; E12–E15 raised |
| **4b** Workbook alignment | Fix E12 scoring (class C); add E13 outputs (class E); baseline-v2 | All parity todos removed; needs lecturer approval |
| **5** Interaction fixes | Focus preservation and targeted output updates; live updating while typing; scenario overrides shown | Keyboard-only walkthrough passes; Playwright focus test |
| **6** Export and report | `export.js` with injection guard and v2 CSV; print report view; save/open progress file | Export tests pass; PDF print reviewed |
| **7** Accessibility and CSP | Labels, contrast, aria; remove inline styles; CSP meta | Zero CSP violations; axe-core run in Playwright with no serious issues |
| **8** Visualisation | Nice-number axes, limit lines, data tables, then response plots and feasibility map | Chart unit tests; screenshots reviewed |
| **9** Guided PBL | Task data with CLO mapping, self-checks, answer key (not deployed) | End-to-end walkthrough matches the answer key |
| **10** Model extensions *(optional, needs approval)* | e.g. Taylor tool life, setup cost or capacity, so B and C affect the decision | `model-change` entries approved; baseline-v2 published |

---

## 6. Open questions for the lecturer

1. ~~Workbook~~: received. ~~Normalisation over infeasible trials (E6)~~: confirmed intended by the workbook.
2. **E12:** should the web app adopt the workbook's ratio-to-best scoring for productivity, power and cost? (Recommended: yes, since the workbook is the reference.)
3. Should the change requests B and C be able to change the recommended trial (E4, E5)? If yes,
   which mechanism: capacity hours, setup cost, or Taylor tool life (with which C and n for
   AISI 1045 with your insert grade)?
4. Is the 7.5 kW power limit meant to be non-binding (E3), or should the depth of cut or kc
   make it active in some trials?
5. What is the wording of the course learning outcomes (CLOs) that the PBL tasks should map to?
6. Should the GitHub repository be public? An answer key must never sit in `site/`.
