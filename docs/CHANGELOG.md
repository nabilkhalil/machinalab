# Changelog

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
