# Changelog

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
