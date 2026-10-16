# Changelog

## Stage 9 — 3D turning view prototype (2026-10-16) · released as version 1.2.0

First stage of the MachinaLab 2 upgrade ([development plan](DEVELOPMENT_PLAN.md)). Branch `stage-9-turning-3d`.

**Changed**
- **3D turning view** at the top of the Live Simulator page: a lathe (headstock, chuck, bar, tailstock centre, tool) turning the
  live cutting condition, with a rotating bar, tool feed towards the chuck, material removal, feed marks and chips.
  Drag to orbit, or use the buttons (turn, raise, lower, zoom, reset view). Play/Pause and Restart pass.
- **Synchronised with the model:** spindle rotation ∝ predicted N (1/10 speed, capped at 4 rev/s), feed marks and tool travel ∝ f (× 50),
  removed layer = ap (drawn ≥ 12 % of the radius), pass time = predicted cutting time × 0.2 (2–45 s). Constant factors, so doubling
  f or Vc visibly halves the pass time. All scaling lives in the new pure module `site/js/turning.js`.
- **Prediction vs illustration:** a "MODEL PREDICTION" panel (N, Vc, f, ap, cutting time, Ra, input power, feasibility, copied
  unchanged from `model.js`) sits beside an "ILLUSTRATION" panel listing every scale factor in plain words. The card is badged
  "ILLUSTRATION · NOT TO SCALE". New card "About the 3D turning view" on the Models & Assumptions page.
- **Direction arrows** (added after review): cutting speed Vc (down past the tool, tangent to the bar), feed f (towards the chuck),
  depth of cut ap (radial dimension across the removed layer) and cutting force Fc (down on the tool, along Vc). Each is labelled
  with its model value (Vc 150 m/min, f 0.15 mm/rev, ap 0.5 mm, Fc 135 N), with a text legend under the view that states the direction
  in words. Lengths are not to scale, and the legend says so. Only the tangential force is modelled, and the legend says that too. "Show direction
  arrows" switch, remembered in the preferences key (`{reduceMotion, showArrows}`).
- **Fixed:** the bar turned the wrong way (front surface moving up past the tool). It now moves down onto the tool's top face.
- **Sliders** for Vc (10–400 m/min) and f (0.01–0.5 mm/rev), kept in step with the number boxes in both directions.
- **Labelled SVG schematic** (Di, Df, ap, f, Vc, N): optional on the page, and the replacement view when WebGL is unavailable.
- **Reduced motion:** honours the system setting and a new "Reduce motion" checkbox (still picture until Play; also turns off
  the changed-value highlight). Stored under a separate key `machinalab:mmt15603:prefs:v1` = `{reduceMotion}`; no personal data,
  student work untouched, tampered values ignored.
- **Three.js r159** vendored in `site/js/vendor/` (decision record [0001](decisions/0001-three-js-3d-turning-view.md)), loaded
  only when the simulator first opens; SHA-256 pinned by a unit test.
- Performance: ≈1,000 triangles, pixel ratio ≤ 1.5, 30 fps cap, and the loop stops when paused, scrolled out of view, on another
  page or in a hidden tab.
- Tests: Playwright now launches Chromium with SwiftShader so WebGL runs on CI machines without a GPU.

**Unchanged (verified)**
- `site/js/model.js`, `params.js`, `validate.js`, `export.js`, `charts.js`: not modified. Baseline lock and Excel parity pass unchanged.
- CSV export, progress files, print report (the 3D card is hidden in print) and the main storage key/schema.

**Verification**
- Before: unit 169/169, browser 53/53.
- After: unit **194/194** (25 new in `turning.test.js`, including arrow labels, legend wording and colour contrast; pass-through of predictions, scale factors, proportional response to f and Vc,
  every clamp, notes, schematic accessibility, 500 random valid inputs with no NaN/Infinity, vendored file hash).
- Browser **70/70** (after the arrows were added); before that, 69/69 on two consecutive full runs; `lathe.spec.js` (17 new) 48/48 over 3 repeats. New tests cover lazy loading, readout
  values at defaults (965 rev/min, 41.5 s, 0.879 µm), slider ↔ number box sync, animation running and pausing (frame comparison),
  reduced motion (system and checkbox, persisted), tampered preferences, blocked state, canvas surviving re-render and navigation,
  keyboard view buttons, schematic staying open, the no-WebGL fallback, axe 0 violations with the 3D view loaded, 375 px width, file://.
- Existing tests adjusted: four smoke locators scoped to `[data-region="simResults"]` because the page now shows a second
  feasibility pill; the page-wide "no FEASIBLE for invalid input" check is kept. The phone-width axe test is marked `test.slow()`
  (≈ 7 s alone with software WebGL; it exceeded 30 s once under full parallel load).
- Visual review of screenshots: desktop 1366 px, phone 375 px, schematic, and no-WebGL fallback. The review caught an over-close camera,
  overlapping schematic labels and animation notes shown on the still fallback; all three were fixed.

**Release (1.2.0)**
- `APP_VERSION` 1.2.0 (sidebar shows "Version 1.2"); CSS/JS links carry `?v=1.2.0` so returning students get the new scripts.
- README rewritten for students and lecturers (live link, quick start, 3D view, privacy, troubleshooting), maintainer notes last.

**Known issues / deferred**
- Three.js r159 logs one console warning ("build/three.min.js is deprecated"). Harmless; see decision 0001.
- Feed rate vf = f·N is not shown: it is a new displayed quantity and needs the `model-change` procedure.
- On a very short bar (length < 2 radii) the schematic's Di and Df labels can overlap.
- Not yet tried on a real low-end lab PC or on Safari/Firefox (CI covers Chromium only).

## Stage 8 — Visualisation (2026-10-15)

**Changed**
- New `site/js/charts.js`: pure SVG builders (`niceScale`, `barChart`, `stackedBarChart`, `lineChart`,
  `feasibilityMap`), with no libraries, so they work offline, under the CSP and in print.
- The **Data Analysis** page now has three sections:
  1. **Feasibility map** (Vc against f). The feasible region is shaded by evaluating the model itself on a
     60 × 40 grid, so no new equations were introduced. It shows the nine trials (●, or ⊗ when not feasible) and the live point (◆).
     The text below states which limit binds. At the defaults only roughness caps the feed (about 0.20 mm/rev) and power
     is never reached. Under change request A the band drops to about 0.14 mm/rev.
  2. **Response plots** of Ra, MRR, input power and cost against feed, with one line per cutting speed. These make the 3 × 3
     design visible. For Ra the three lines coincide, and the chart says that speed has no effect in this model.
  3. **Trial by trial**: the six original bar charts are kept as requested in the skill, now improved, plus a **cost breakdown**
     stacked chart (machine-time cost and tool cost), which makes change request C visible.
- **Accuracy:**
  - axes use "nice" numbers chosen from the data, replacing the fixed `Math.max(…,1)` floor that flattened power (0.7 kW) against 1.0;
  - y-axis titles carry units;
  - the x-axis title explains the trial numbering;
  - MRR is shown in cm³/min to match the tables;
  - limit lines (Ra limit, power limit) are drawn and labelled, or a note explains when a limit is far above the data
    ("Power limit 7.50 kW … 9 % of the limit");
  - infeasible trials are drawn as pale bars with a dashed outline, so status is not shown by colour alone.
- **Accessibility:**
  - every chart is `role="img"` labelled by its `<title>` and a data-derived `<desc>` sentence;
  - every chart has a **"Show data table"** (`<details>`), giving 12 tables;
  - the three speed series also differ by marker shape and dash pattern;
  - series colours were checked with the dataviz palette validator (#2667a0, #c2611c, #7b4fae all pass);
  - bar colours reach at least 4.18:1 on white;
  - on phones, charts scroll sideways inside a focusable region instead of shrinking the text.
- **Model (Class R):** added `model.limitsMet(s, r)`. `calc()` now derives `feasible` from it, so the map uses the exact same
  feasibility rule as the trials. The bit-exact test still passes.
- The printed report uses the improved bar charts. Ids are prefixed per context (`an-` on the page, `rep-` in the report),
  so they stay unique.

**Unchanged (verified)**
- All calculated values: the bit-exact model test, the baseline and Excel parity pass.

**Verification**
- Unit: 169/169, including 23 new chart tests:
  - nice axes for the real data ranges, plus the edge cases (all zeros, negative, NaN, single value, values below 1)
    and a sweep over 1e-3 to 1e5;
  - title, desc, limit line, outline and data table for every value;
  - a far-away limit described rather than drawn;
  - escaping;
  - response-plot coincidence detection and secondary encodings;
  - map descriptions for BASE, A and a low power limit.
- Browser: 53/53, and 265/265 over 5 repeats. New tests cover the analysis page structure (12 charts, 12 tables), opening a table and checking its values,
  charts following change request A, and unique ids when printing from the analysis page.
  axe still reports 0 violations, now also on the analysis page at 375 px.
- Visual review of the full analysis page in BASE and scenario A, and of the A4 report PDF. The review caught
  charts **cropped** in half-width cards (the phone-only minimum width was applying on desktop) and chart text too small. Both were fixed:
  text is now 15 px in chart units, and the minimum width applies only at 750 px or less.

**Known issues / deferred**
- Turning schematic (visualisation skill, priority 4) and Vc/f sliders are not yet built.
- In the Ra response plot the three markers overlap exactly, which is the point being made. The legend and note explain it.


## Stage 7 — Accessibility, Content-Security-Policy and CI hardening (2026-10-15)

**Baseline measured first:** axe-core (WCAG 2.0/2.1/2.2 A and AA rules) flagged only one rule as failing: **colour contrast
(serious), on every page**, across 7 colour pairs. The worst was the page footer at 2.66:1, against the 4.5:1 required.

**Changed**
- **Contrast:** 8 grey and teal text colours darkened within the same palette, for example `#71899a` to `#526a7a` and `#188a96` to
  `#0e6f79`. Every one is at least 5.08:1 on every background it is used on, which was checked by calculation before the change.
- **Keyboard and screen readers:**
  - a "Skip to main content" link as the first Tab stop;
  - choosing a page sets `aria-current="page"` and moves focus to the page heading;
  - the nav landmark is named "Pages";
  - decorative glyphs (◫ ⚙ ▦ …, the brand "M", the hero gear) are hidden from screen readers;
  - a visible focus ring (`:focus-visible`) on every control;
  - the wide tables are focusable, labelled regions, so they can be scrolled with the keyboard on a phone.
- **Charts** carry a one-sentence description, for example "Ideal surface roughness, bar chart of the nine trials. Lowest 0.391 µm
  (trial 1, 4, 7), highest 1.563 µm (trial 3, 6, 9)."
- **Content-Security-Policy** (`<meta>` in index.html): `default-src 'self'; script-src 'self'; style-src 'self';
  img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'`. The last inline `style=` attribute was
  replaced by a class.
- **CI (S7):** the workflow now runs a `test` job (`npm ci`, unit tests, Playwright with Chromium) on every push and pull request.
  **Deployment needs that job to pass** and runs only for `main`.
  - All 7 actions are pinned to full commit SHAs, resolved from GitHub's tags. The `upload-artifact` SHA was re-verified after it was
    first written from memory.
  - Permissions are least-privilege per job.
  - Pages concurrency no longer cancels an in-progress deployment, which is GitHub's recommendation.
  - Playwright traces are kept on failure.
- Dev dependency: `@axe-core/playwright` (test-only, never deployed).

**Unchanged (verified)**
- All calculated values: the bit-exact model test, the baseline and Excel parity pass. All 34 earlier browser tests pass.

**Verification**
- Unit: 148/148. Browser: 50/50 (34 smoke + 16 new in `tests/browser/a11y.spec.js`):
  - axe has **0 violations** on all 7 pages, in the error/warning/override state and at 375 px;
  - **no CSP violations** while exercising every page, live typing, the print report, CSV and the progress file, over both http **and
    `file://`** (double-click still works);
  - **the CSP is enforced**: an injected inline script, an `onerror` handler and an inline style are all blocked. A negative check with the CSP
    removed showed all three succeed, so the test is meaningful;
  - focus moves to the heading with `aria-current` set;
  - the skip link works;
  - glyph-free accessible names and chart descriptions;
  - keyboard scrolling of tables on a phone.
- The workflow YAML was parsed and checked (triggers, `needs`, `if`, permissions, upload path `site`). The CI steps were reproduced locally
  from a clean `npm ci`: 148 unit and 46 browser tests passed.
- Visual check of the Cost page with keyboard focus at 1280 px.

**Known limits**
- Automated tools find only part of accessibility issues. A short manual pass with a screen reader (NVDA on Windows) is still
  recommended before a formal accessibility statement.
- The workflow's first real run will happen on the first push. It can't be run locally.


## Stage 6 — Live interaction, change-request overrides, dynamic overview (2026-10-15)

**Changed** (behaviour only; no model change)
- **Results update while typing** (150 ms debounce) on the simulator, experiments and cost pages. The page is
  rebuilt off-screen and only marked output regions are copied across: results, tables, totals, field messages and notes.
  The `aria-invalid` and `aria-describedby` attributes are synced in place. **Input boxes are never replaced while
  a student types.** Committing a value (Tab, blur or Enter) still does the full render with focus restore from Stage 3.
- Results that change are highlighted briefly. This is disabled when the system's "reduce motion" setting is on.
- **E7:** inputs a change request overrides are shown disabled with an explanation. For A, the Ra limit shows 0.8 with "Set by
  change request A… Your value, 1.6 µm, applies in the other scenarios". For B, the batch shows 3,500. For C, the tool life
  stays editable with a live note: "Change request C uses 60 % of this value: 18.0 min/edge".
- **E8:** the overview's industrial challenge now uses the actual batch, diameters, length, Ra limit and power
  limit. At the defaults it reads exactly as before.
- "Reset levels" asks for confirmation (student-ui skill: destructive actions).

**Unchanged (verified)**
- All calculated values: the bit-exact model test, the baseline and Excel parity pass. All 28 earlier browser tests pass unchanged.

**Verification**
- Unit: 148/148. Browser: 34/34, and 170/170 over 5 repeats. New tests:
  - live typing: a value typed key by key with 250 ms pauses stays intact, focus stays, results update before blur, and the
    same input element survives, tagged and checked;
  - an invalid value appears live and clears live;
  - the experiment table and weight total update while typing;
  - E7 for A, B and C, including the live tool-life note and the return to BASE;
  - E8;
  - reset confirmation, both declined and accepted.
- **Why region updates:** a negative check temporarily swapped live updating for a full re-render while typing. Typing "210"
  then produced **"12"**, because the caret jumps when a number box is re-created. The test caught it. The real
  implementation was restored and the diff confirmed.

**Known issues / deferred**
- Sliders for Vc and f (suggested in the student-ui skill) are not added yet, and could come with Stage 8.
- Accessibility pass and CSP are planned for Stage 7.


## Stage 5 — Model extraction (Class R refactor) (2026-10-15)

**Changed**
- The machining model moved from `site/app.js` into **`site/js/model.js`**: pure functions of the state
  (`calc`, `trials`, `live`, `scores`, `effective`), each annotated with its workbook cell. `app.js` keeps
  thin wrappers with the same names (`calc`, `trials`, `live`, `scores`, `effRa`, `batch`, `life`), so no page code changed.
  Load order: `params → model → validate → export → app`.
- New `tests/unit/model.test.js` (11 tests) requires the model directly under Node.

**Unchanged (verified)**
- **Every output is bit-for-bit identical** to `baseline-v2.json` in all four scenarios (`Object.is` on every
  trial, live and score value). The 1e-12 baseline test and Excel parity also pass.
- No visible change: 28/28 browser tests.

**Verification**
- Unit: 148/148, including the new bit-exact test, a purity check (the input state isn't modified), effective values per change
  request, and physical properties over a 27-point grid:
  - Ra is independent of Vc, and doubling f quadruples Ra;
  - doubling Vc doubles N, MRR and Pc, and halves tcut;
  - force and power rise with depth and kc, and input power falls as η rises;
  - trial 5 is in the expected order of magnitude.
- Mutation check: rewriting `1000*f*f` as `f*f*1000`, which is algebraically identical, changes the last bit of Ra in 6 of 9 trials,
  and the bit-exact test detects it. This is why `model.js` warns against reordering expressions.


## Stage 4 — Export, print report and progress files (2026-10-15)

**Changed**
- New `site/js/export.js` (pure, Node-tested): `buildCsv`, `exportFilename`, `buildProgressFile`,
  `parseProgressFile`.
- **S2: CSV formula injection fixed.** Any text cell starting with `= + - @`, tab or CR gets a leading `'`.
  This covers student name, group and all answers. Numbers are written as numbers.
- **CSV format version 2** (it replaces the unversioned layout, so markers' spreadsheets need updating). Its contents are:
  1. a metadata block: format, version, app version, course, export time with UTC offset, student, group,
     scenario with description, effective limits, and a "model predictions" note;
  2. every input as Parameter / Symbol / Value / Unit;
  3. the trial table with **units in the headers**, Feasible as Yes/No, weighted score and rank;
  4. the live simulator point;
  5. all 9 student answers.

  Numbers are unformatted at full precision.
  The filename is `MMT15603_<group>_<student>_<YYYYMMDD-HHmm>.csv`, sanitised. With invalid inputs, the file contains inputs,
  problems and answers but no results. With invalid weights, scores and ranks are omitted and a note explains why.
- **U2: Print report is now a real report.** It's built on demand into a hidden `#report` section, and is also built when
  the student prints with Ctrl+P. Sections:
  - header (course, student, group, date, change request);
  - 1. inputs;
  - 2. nine-trial results with the feasible count and best trial;
  - 3. three key charts;
  - 4. cost and tool-life sensitivity;
  - 5. decision matrix;
  - 6. all student answers, with "(not answered)" marking blanks;
  - a disclaimer footer.

  It uses an A4 print stylesheet. With invalid inputs, the report lists the problems instead of results.
- **U10: Save / open progress file** on the PBL Workbook page. Students can move work between computers without accounts. The file
  (`format: machinalab-state`, `schemaVersion: 2`) is size-limited to 200 KB and fully sanitised on open. Opening asks
  for confirmation before replacing current work, and wrong or corrupted files give a clear message.
- **Storage:** the new namespaced key is `machinalab:mmt15603:v2`, holding `{schemaVersion: 2, state}`. Work saved under the old
  `machinalab-v1` key is still read automatically.
- **Units are no longer uppercased in table headers.** The old style turned `µm` into "ΜM" and `mm/rev` into "MM/REV".
- Chart legends read "Unit: …". The "hover" hint is screen-only.
- Sidebar now says "Version 1.1 · Runs in your browser" (U8: there's no offline caching, so "Offline capable" was removed).

**Unchanged (verified)**
- All calculated values: the baseline v2 and Excel parity tests pass.

**Verification**
- Unit: 137/137, including 20 new export tests:
  - injection for `=1+1`, `@SUM(A1)`, `-2+3`, `+1`, tab, CR and `=HYPERLINK(…)`;
  - a "no text cell starts with a trigger" sweep;
  - quotes, commas and line breaks surviving a round trip;
  - a metadata snapshot;
  - full-precision values checked against workbook cells;
  - Yes/No, score and rank, with infeasible trials unranked;
  - invalid weights and invalid inputs;
  - CRLF line endings;
  - filename sanitising (including `../`);
  - a progress-file round trip, plus sanitising and rejection of malformed, wrong-format, newer and oversize files.
- Browser: 28/28, and 140/140 over 5 repeats. **S2 is now a normal passing test.** New tests:
  - the print report (sections, charts, answers, hidden on screen, no duplicate ids);
  - the report with invalid inputs;
  - progress save, then open in a fresh browser profile ("another computer");
  - refusing a non-progress file;
  - declining the confirmation;
  - the CSV filename, BOM and format.
- Visual check: generated the A4 PDF with Chromium and reviewed every page. That review found and fixed the uppercase-unit bug, a grey
  background on the last page, hover text on paper, and a duplicate `id="costAnalysis"` when the report was built next to the Cost page.

**Known issues / deferred**
- Not yet checked with "Save as PDF" in Edge or Firefox; the Chromium PDF is fine.
- Contrast, nav glyphs, CSP and the remaining inline styles are planned for Stage 7. Chart quality (axis titles, limit lines) is planned for Stage 8.

## Stage 3 — Input validation, safe storage and keyboard focus (2026-10-15)

**Changed**
- New `site/js/params.js`: a schema for every input (label, unit, min/max, default, reason for the range).
  It's loaded before `app.js` as a classic script, so the app still works from `file://`.
- New `site/js/validate.js`: `validate()` returns student-readable errors and warnings and never throws.
  `sanitise()` rebuilds the state from untrusted saved data field by field (type, range, array
  length, scenario list, text type and 5 000-character limit). Both are unit-testable under Node.
- **E2: invalid inputs never produce results.** Predictions, the trial table, charts, cost analysis,
  ranking, the feasible count and CSV results are replaced by a "No results yet" panel. An invalid weight
  total blocks only the ranking. The CSV still exports the student's notes plus the list of input problems.
- **Errors are shown at the field:** red border, `aria-invalid`, and a message linked by `aria-describedby`.
  The notice banner lists every problem with a **Show me** button that opens the page and focuses the field.
  Warnings, such as feed ≥ nose radius (where the ideal-Ra formula is unreliable) or unordered levels, are shown in amber
  and don't block results.
- An emptied number box stays empty and reports "Enter a number for …". Previously it silently became 0.
- **S3 and S4:** saved data passes through `sanitise()` on load. Every value written into the page is escaped
  (`esc()`, which replaces `safe()`), including numbers from storage and experiment levels.
- **S5:** saving is wrapped in try/catch. If the browser blocks storage, the app keeps working and tells the
  student to export a CSV.
- **U1: keyboard focus survives re-rendering.** The page re-renders after the browser has moved focus, then
  restores focus and the caret. Labels are now linked to the speed/feed level, weight and scenario inputs (part of U4).
- **E9:** the weight total is checked with a 1e-6 tolerance instead of exact equality.
- The notice is now a polite live region (`role="status"`).

**Input ranges introduced** (generous teaching limits, to be confirmed by the lecturer; see `params.js`)

| Input | Allowed | Input | Allowed |
|---|---|---|---|
| Initial / final diameter | 2–500 / 1–500 mm | Machine rate | 0–2 000 RM/h |
| Machining length | 1–2 000 mm | Non-cutting time | 0–3 600 s |
| Nose radius | 0.1–3.2 mm | Insert cost | 0–2 000 RM |
| kc | 300–6 000 N/mm² | Usable edges | 1–12 (whole) |
| Drive efficiency | 0.1–1 | Tool life | 1–480 min/edge |
| Max input power | 0.1–200 kW | Batch | 1–1 000 000 (whole) |
| Ra limit | 0.025–50 µm | Vc (live and levels) | 10–1 000 m/min |
| Weights | 0–100 % each, total 100 | f (live and levels) | 0.01–2 mm/rev |

Previously any positive value was accepted. The defaults and the full workbook case are well inside these ranges.

**Unchanged (verified)**
- Every calculated value: `baseline-v2.json` passes unchanged in all four scenarios, and Excel parity passes.

**Verification**
- Unit: 117/117 (84 earlier + 33 new validation tests). The new tests cover min, max and just outside for every parameter;
  NaN, null, '', string and Infinity values; whole-number rules; cross-field diameters; weight totals; warnings; corrupted and
  tampered storage blobs; text truncation; and start-up with unreadable storage.
- Browser: 24/24, and 120/120 with `--repeat-each=5` (no flakiness from the deferred render). New tests:
  - no FEASIBLE shown for invalid inputs, on any page;
  - "Show me" navigation and focus;
  - empty field;
  - weights blocking only the ranking;
  - feed ≥ nose radius warning;
  - an XSS payload in storage produces no dialog and no injected element;
  - blocked storage;
  - CSV export with invalid inputs.

  **U1 is now a normal passing test**: focus is kept when tabbing on the simulator, experiments and cost pages, and typing continues in the new field. S2 is
  still confirmed as a known defect (Stage 4).
- Security: every `state` interpolation in templates is escaped or numeric-formatted (grep reviewed).
- Visual check of the error state at 1280 px.
- **Test infrastructure:** an intermittent failure appeared during a full run (`ERR_CONNECTION_REFUSED`,
  plus 44 s page-load stalls). The cause was Python `http.server`'s 5-connection listen backlog under parallel test
  browsers, not the app. It was replaced by the dependency-free `tools/serve.js`, which also blocks path traversal
  (checked: `../` gives 404, `%2e%2e%2f` gives 403). Afterwards, two runs of 10× repeats gave 480/480 passes.

**Known issues / deferred**
- S2 (CSV formula injection) and U2 (print report) are next, in Stage 4.
- The storage key is still `machinalab-v1` without a `schemaVersion`. This is harmless for now because `sanitise()` copes with any shape,
  and a versioned key is planned with the save/open progress file in Stage 4.
- Contrast, nav glyphs and the remaining inline styles are planned for Stage 7.

## Stage 2 — Workbook alignment (2026-10-15)

**Changed** (the engineering basis is in `docs/MODEL_CHANGELOG.md`)
- **E12 (Class C): decision scores now follow the workbook.** Productivity = 100·MRR/max,
  power = 100·min/P, cost = 100·min/C. Ra is still min–max. Explanations were added to the Cost & Decisions
  page and as a new "Decision scores" card on the Models page.
- **E13 (Class E): new cost-analysis outputs.** Tool cost per part, batch cycle hours, and cost per
  part at T = 15/30/60 min, shown in a new "Production cost and tool-life sensitivity" table on
  Cost & Decisions, with formula cards on the Models page. They're also appended as 5 new CSV columns after `Feasible`,
  so existing columns keep their positions.
- **E15: the student workbook uses the workbook's 9 STUDENT WORK prompts**, with guiding placeholder text and
  labels properly linked to fields. Notes saved before this stage carry over: "Recommendation" goes to
  *Recommended trial and reasons*, "Reflection" to *Limitations / validation plan*, and "Observations" to
  *Other observations (optional)*. The CSV notes section now lists all prompts.
- **E14:** kept the web app's 1e-9 feasibility tolerance as an intentional, documented difference.
- Removed inline `style=` attributes from the workbook page (new `.stack` CSS class).

**Before/after at defaults (BASE)**

| Trial | Weighted before | Rank before | Weighted after | Rank after |
|---|---|---|---|---|
| 1 | 45.00 | 8 | 63.23 | **4** |
| 2 | 47.50 | 7 | 53.22 | 7 |
| 3 | 38.33 | 9 | 39.99 | 9 |
| 4 | 60.00 | 3 | 65.72 | 3 |
| 5 | 58.89 | 4 | 59.82 | **5** |
| 6 | 48.33 | 6 | 49.46 | **8** |
| 7 | 68.33 | 1 | 69.99 | 1 |
| 8 | 65.83 | 2 | 66.96 | 2 |
| 9 | 55.00 | 5 | 58.75 | **6** |

The best trial is still 7 in every scenario. Scenario A's ranking order (7, 4, 1) is unchanged.

**Unchanged (verified)**
- Every machining quantity (N, MRR, Ra, Fc, Pc, Pin, tcut, tcycle, cost/part, batch cost,
  feasibility) in all four scenarios. A field-by-field diff of `baseline-v1.json` against `baseline-v2.json`
  shows only the new output fields, the scores/ranks and the new prompt defaults.

**Verification**
- Unit: 84/84 pass, 0 todo. **Excel parity: all checks pass, including the decision matrix and the cost analysis.**
  New `tests/unit/scoring.test.js` checks properties over 3 level sets: best trial = 100, ratio scores
  proportional to best, Ra degenerate case, cost = machine + tool, sensitivity columns ignore C,
  and batch hours scale with B.
- Baseline: `baseline-v2.json` (v1 kept for history). The baseline test now locks v2.
- Browser: 17/17. 15 smoke tests pass, including new ones for workbook ranking order, the cost-analysis table under BASE and B,
  the 9 prompts, and migration of old notes. U1 and S2 are still confirmed as known defects. The S2 test briefly
  showed a false pass because the "Observations" label was renamed, so it now checks every CSV cell regardless of label.
- Visual check of the cost table, ranking table and workbook page at 1280 px.

**Known issues / deferred**
- U1 (focus loss), S2 (CSV injection) and the remaining audit items, as planned.
- The PBL task list (right column) is unchanged. Rewriting it with self-checks is Stage 9.

## Stage 1 — Foundation (2026-10-15)

**Changed**
- Put the project under git (branch `main`). Stage 0 was committed first as a snapshot of the original app.
- Moved `index.html`, `app.js` and `styles.css` into `site/` with `git mv`. The files are byte-identical
  (SHA-256 `a737c6ef…`, `777ff6ea…`, `b31c485b…`, unchanged from the audit).
- Deploy workflow uploads `site/` only (`path: site`). CLAUDE.md, `.claude/`, docs, tests,
  tools and the workbook are no longer published to the website.
- Added `tests/unit/baseline.test.js`, which locks every trial, live-point, score and rank value in all four
  scenarios to `baseline-v1.json` at relative error ≤ 1e-12.
- Added Playwright (dev-only) and `tests/browser/smoke.spec.js` with 13 tests, plus `playwright.config.js`.
- Added npm scripts `test:browser`, `serve` and `check`. The README has updated run and deploy steps plus a maintainer section.
- Moved the shared legacy loader to `tools/legacy-loader.js`, which the baseline, parity and characterise tools use.

**Unchanged (verified)**
- All app behaviour and numbers. The baseline test passes for BASE, A, B and C, and the app files' hashes are identical.
- Excel parity is unchanged: all machining quantities match the workbook.

**Verification**
- Unit: 71 tests, 62 pass, 0 fail, 9 todo (the known Excel discrepancies E12 and E13).
- Mutation check: changing the Ra constant 32 to 31.2 in a copy of `app.js` is detected by the baseline.
- Browser (Chromium): 13/13. That's 11 passing smoke tests plus 2 `test.fail` tests that confirm the known
  defects U1 (focus lost on Tab) and S2 (CSV formula injection) still exist. The smoke set covers:
  all 7 pages render with no console errors or NaN; live simulator recalculation; trial table
  values; scenario A (3 feasible, best #7); invalid-diameter notice; notes persist across reload;
  CSV download (BOM, header, row count, values); print media hides navigation; no horizontal scroll at 375 px;
  works from `file://`.
- Security (stage-relevant items): deploy scope `site/` only ✓; no runtime external requests in
  `site/` ✓; no secrets or emails in tracked files ✓; `npm audit` reported 0 vulnerabilities ✓.

**Known issues / deferred**
- U1, S2 and the other audit findings are unchanged. They're scheduled for later stages.
- Actions are still pinned to major tags, not SHAs (S7, Stage 7).
- Nothing has been pushed. There's no GitHub remote yet, so the live Pages deploy hasn't been verified.
