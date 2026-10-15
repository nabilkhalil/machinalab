---
name: stage-release
description: Close out an incremental MachinaLab implementation stage — verify existing behaviour is preserved, document changes, and release to GitHub Pages safely. Use at the end of every stage, before committing/pushing, or when asked to "deploy", "release", "publish" or "verify the stage".
---

# Stage verification and release

## Before starting a stage

1. Make sure the work is in git (`git status`). If the folder isn't a repo yet, ask the user before running
   `git init`. Work on a branch named `stage-N-<slug>`.
2. Run `npm test` (and `npm run test:browser` if it exists). Save the summary as the
   "before" result. If something already fails, record it. Don't fix it silently.

## Closing a stage — all steps required

1. **Automated tests**: unit, baseline, excel-parity (if the workbook exists) and browser. Paste the
   summary lines.
2. **Baseline check**: if the stage was not an approved model change, the baseline fixture
   must pass unchanged.
3. **Manual smoke** (or Playwright equivalent), in this order: open each of the 7 pages, change Vc
   and f, switch scenarios A/B/C, export CSV and open it, print preview, reload to check notes
   persist, then check a 375 px viewport.
4. **file:// check**: double-click `site/index.html` and confirm the app works.
5. **Security**: run the `security-check` items affected by this stage.
6. **Docs**: add a `docs/CHANGELOG.md` entry:

   ```
   ## Stage N — <title> (YYYY-MM-DD)
   Changed: …
   Unchanged (verified): …
   Verification: unit X/X, browser Y/Y, baseline identical, manual smoke ✓ (list)
   Known issues / deferred: …
   ```

   Also update `README.md` if run or deploy steps changed, and the `CLAUDE.md` "Current state" section.
7. **Commit**, only if the user asked. Use a conventional message (`stage 3: extract pure model
   to site/js/model.js`).

## GitHub Pages release

- The workflow deploys `site/` only (`upload-pages-artifact` with `path: site`). Confirm this
  before the first push that contains CLAUDE.md, tests or docs.
- All asset paths are relative (`styles.css`, `js/model.js`), so the site works under
  `https://<user>.github.io/machinalab/`.
- Cache-busting: append `?v=<app version>` to the CSS/JS references when releasing, so
  students don't keep a stale script after a model change.
- Pushing to `main` deploys to students immediately. **Ask before pushing.** Avoid releasing
  mid-assessment week unless it's a fix the lecturer requested.
- After deploying, load the live URL and check the version shown in the sidebar footer, one calculation
  (trial 5 Ra = 0.879 µm at defaults), and that `/machinalab/CLAUDE.md` returns 404.

## Report format

End the stage with a short report: what changed, what was verified (with the evidence), what was not
verified and why, and the proposed next stage.
