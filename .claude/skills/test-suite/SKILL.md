---
name: test-suite
description: Write, run and maintain MachinaLab's automated tests — zero-dependency unit tests with node:test for the pure model/validation/export code, and Playwright browser tests for the pages. Use when adding features, fixing bugs, refactoring, or when asked to "test", "verify" or "check nothing broke".
---

# Test suite

## Layers

| Layer | Tool | Location | Covers |
|---|---|---|---|
| Unit | `node:test` + `node:assert/strict` (built-in, no install) | `tests/unit/` | model.js, validate.js, export.js, scoring |
| Baseline | `node:test` | `tests/unit/baseline.test.js` | Regression lock vs `tests/fixtures/baseline-v1.json` |
| Excel parity | `node:test` | `tests/unit/excel-parity.test.js` | see `excel-parity` skill |
| Browser | `@playwright/test` (devDependency only) | `tests/browser/` | navigation, inputs, export, print, storage, a11y smoke |

Runtime code must never `require` anything. Test-only dependencies live in
`devDependencies` and are never deployed, because only `site/` is published.

## Loading browser scripts in Node

Site scripts are classic scripts that end with:

```js
if (typeof module !== 'undefined' && module.exports) module.exports = MachinaLab.model;
```

So unit tests can do `const model = require('../../site/js/model.js')`. If you meet the
legacy single-file `app.js`, load it through `vm` with stubbed `document` and `localStorage`
(see `tools/characterise-legacy.js`) instead of editing it just to make it testable.

## What every unit test file should include

- **Golden values**: default inputs → exact outputs for all nine trials and four scenarios.
  Tolerance is `Math.abs(a-b) <= 1e-12 * Math.max(1, Math.abs(b))`.
- **Physical properties** that hold for any valid input. Loop over a grid of inputs:
  Ra is independent of Vc; doubling f quadruples Ra; MRR, Fc and Pc rise monotonically; and
  cost per part = machine part + tool part.
- **Boundaries**: the minimum and maximum allowed value of each parameter, Ra exactly equal to the limit (feasible),
  efficiency = 1, edges = 1.
- **Invalid input**: each rejected case returns a student-readable message and never NaN output.

## Browser tests (minimum smoke set)

1. Every nav page renders with no console errors and no "NaN", "undefined" or "Infinity" text.
2. Changing Vc and f on the simulator updates Ra, power and cost to the expected values.
3. Tab moves from one input to the next and focus is kept after re-render.
4. Invalid input (final ≥ initial) shows the notice and hides or greys the results.
5. Scenario A gives "3 feasible" with default levels.
6. CSV export downloads, parses, has the header row, and neutralises `=SUM(1)` in notes.
7. Notes persist across reload. A corrupted `localStorage` value falls back to defaults.
8. Works on a 375 px viewport (no horizontal page scroll).
9. Also run once against `file://` (`page.goto('file://' + path)`) to guard rule 3 in CLAUDE.md.

Serve with `python -m http.server 8000 -d site` through Playwright's `webServer` config.

## Running and reporting

`npm test` and then `npm run test:browser`. In your reply, paste the summary lines
(pass/fail counts) verbatim. If a test fails, show the assertion output. Never weaken
a test's tolerance or delete a test to get a pass. Explain the failure and ask.
