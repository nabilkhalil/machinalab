# Changelog

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
