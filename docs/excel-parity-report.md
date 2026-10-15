# Excel parity report — 2026-10-15

> **Update after Stage 2 (same day):** E12 and E13 were fixed. All parity checks now pass,
> including the decision matrix (scores, weighted totals, rank order) and every COST ANALYSIS
> column. E14 was kept as an intentional difference. The details below describe the state before Stage 2.

| | |
|---|---|
| Workbook | `reference/MMT15603_Virtual_Machinability_Simulator.xlsx` |
| SHA-256 | `c5edbe8f2d7e061e68cc272b5b8456749524ddc86e33db4575a9a3c4237753f7` |
| Scenario cached in workbook | BASE |
| Web app | legacy `app.js` (SHA-256 `a737c6ef122a…`), unmodified |
| Test | `npm test` → `tests/unit/excel-parity.test.js` |
| Result | **58 tests: 49 pass, 0 fail, 9 todo (known discrepancies)** |

## Summary

The **machining model is reproduced exactly.** All 9 trials × 12 quantities, the live
simulator point, feasibility flags and batch cost match the workbook's cached values. The
maximum relative difference is 1.4 × 10⁻¹⁶ (Ra, the last floating-point bit), well inside the
1 × 10⁻⁹ tolerance. The engineering equations in the web app can therefore be described as
**validated against the reference workbook (BASE scenario, default inputs)**.

The **decision matrix is not reproduced.** Three of the four criterion scores use a different
normalisation, which changes the weighted totals and the ranking. The **best trial (7) is the same**, but
places 4–9 differ.

## Pass/fail by quantity

| Area | Quantity | Result | Max rel. error |
|---|---|---|---|
| Inputs | all 16 scalars, speed/feed levels, weights, scenario | ✓ identical | 0 |
| 9 TRIALS | v, f, ap, rpm, MRR, Ra, Fc, Pc, Pin, tcut, tcycle, cost | ✓ | 1.4e-16 |
| 9 TRIALS | feasibility status | ✓ 9/9 equal | — |
| SIMULATOR | all 10 outputs + status | ✓ | ≤ 1.4e-16 |
| COST ANALYSIS | batch cost | ✓ | 0 |
| COST ANALYSIS | batch hours, tool cost/part, cost at 15/60 min life | ✗ not in web app | — |
| DECISION MATRIX | Ra score | ✓ | 0 |
| DECISION MATRIX | productivity, power, cost scores | ✗ different method | up to 1.0 (100 %) |
| DECISION MATRIX | weighted total | ✗ | 6.4e-2 |
| DECISION MATRIX | rank order | ✗ | — |
| DECISION MATRIX | best feasible trial | ✓ trial 7 | — |

## Discrepancies

### E12 — Decision-matrix normalisation (affects student conclusions)

| Criterion | Workbook | Web app |
|---|---|---|
| Ra (lower better) | min–max: 100·(max−x)/(max−min) | same |
| Productivity (higher better) | **ratio to best**: 100·x/max | min–max: 100·(x−min)/(max−min) |
| Power (lower better) | **ratio to best**: 100·min/x | min–max |
| Cost (lower better) | **ratio to best**: 100·min/x | min–max |

Effect at the defaults (BASE scenario):

| Rank | Workbook (score) | Web app (score) |
|---|---|---|
| 1 | 7 (69.99) | 7 (68.33) |
| 2 | 8 (66.96) | 8 (65.83) |
| 3 | 4 (65.72) | 4 (60.00) |
| 4 | **1 (63.23)** | 5 (58.89) |
| 5 | 5 (59.82) | 9 (55.00) |
| 6 | 9 (58.75) | 6 (48.33) |
| 7 | 2 (53.22) | 2 (47.50) |
| 8 | 6 (49.46) | **1 (45.00)** |
| 9 | 3 (39.99) | 3 (38.33) |

A student comparing the spreadsheet with the web app would see trial 1 ranked 4th in one and
8th in the other.

**Diagnosis:** the web app applied min–max scaling to all four criteria, while the workbook mixes
methods. The workbook is the declared reference, so the web app is most likely the side to fix. As an
engineering observation, the mixed method is defensible, because ratio scoring keeps proportional
differences in cost and power, but it should be a deliberate choice. Ratio scoring of a criterion
whose minimum is 0 would divide by zero, which isn't possible with valid inputs here.

**Proposed fix (needs lecturer confirmation, through the `model-change` skill, class C):** change
`scores()` to the workbook's method for productivity, power and cost. Publish `baseline-v2.json`
and remove the `todo` markers from the five decision tests.

### E13 — COST ANALYSIS outputs missing from the web app

The workbook shows batch cycle hours, the tool-cost share per part, and a tool-life sensitivity
table (cost/part at T = 15, 30 and 60 min). The web app shows none of these. They're useful
for the scenario B and C discussion: batch hours give B a visible consequence, and the sensitivity table
gives C one. **Proposed:** add them as display-only outputs (class E, no change to existing numbers).

### E14 — Feasibility tolerance (edge case, no effect at defaults)

The web app accepts Ra up to the limit + 1e-9, while Excel compares exactly. With an Ra limit of
exactly 1.5625 µm and f = 0.2 mm/rev, Excel computes Ra = 1.5625000000000002 and reports NOT FEASIBLE,
while the web app reports FEASIBLE. **Proposed:** keep the JS tolerance. It's the physically
sensible behaviour, since the limit is met to within rounding. Document it as an intentional difference.

## Not covered

- **Scenarios A, B and C:** the workbook only caches values for the scenario selected when it was saved
  (BASE). Their scenario logic (INPUTS!E13:E15) was verified **formula by formula** and is
  identical to the JS (see `excel-formula-map.md`). To test them numerically, save the workbook
  three more times with E11 set to A, B and C, and re-run `npm run excel:extract` for each, or confirm
  the formula-level check is enough.
- **Non-default inputs:** cached values exist for one input set only. The formula map shows the
  same algebra for every row, so parity at other inputs follows from the formula comparison.

## Reproduce

```
python -m venv .venv
.venv/Scripts/python -m pip install openpyxl
npm run excel:extract   # writes tests/fixtures/excel-golden.json
npm test
```
