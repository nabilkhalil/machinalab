# Model changelog

Every change to an equation, constant, unit, scenario rule, feasibility criterion or decision
score is recorded here before the code changes (see `.claude/skills/model-change`).

## 2026-10-15 — Decision scores aligned with the workbook (Class C, audit E12)

Approved by the user on 2026-10-15 ("yes please" to Stage 2).

Quantity: decision-matrix criterion scores (0–100, higher is better), weighted total, rank.

| Criterion | Before (web app) | After (= workbook) |
|---|---|---|
| Ra | 100·(max−Ra)/(max−min); 100 if max = min | unchanged |
| Productivity | 100·(MRR−min)/(max−min) | **100·MRR / max(MRR)** |
| Power | 100·(max−P)/(max−min) | **100·min(P) / P** |
| Cost | 100·(max−C)/(max−min) | **100·min(C) / C** |

Max and min are taken over all nine trials, including infeasible ones. Weighted total =
Σ score·weight, for feasible trials only.

Basis: `reference/MMT15603_Virtual_Machinability_Simulator.xlsx`, sheet DECISION MATRIX,
B5:B13 (Ra), C5:C13 (productivity), D5:D13 (power), E5:E13 (cost), F5:F13 (weighted),
H5:H13 (rank). Normalisation over nine trials is stated in J12.

Assumptions/validity range: MRR, P and C > 0 for every trial, which is guaranteed when the inputs pass
validation (positive Vc, f, ap, kc, η, rates). Ratio scores lie in (0, 100], and the best trial
scores 100.

Dimensional check: each score is a ratio of like quantities (mm³/min ÷ mm³/min, kW ÷ kW,
RM ÷ RM), so it's dimensionless and then scaled by 100.

Engineering rationale: ratio-to-best keeps proportional differences. A trial costing 10 % more than the
cheapest scores about 91, wherever the other trials fall. Min–max always stretches the spread to
0–100, so tiny absolute differences look large. That matters here because every trial is far below
the power limit (0.18–0.71 kW against 7.5 kW).

Expected effect (BASE, defaults): the feasibility of each trial and the best trial (7) don't change.
Weighted totals rise by 1–6 points. Ranks 4–9 reorder, and trial 1 moves from 8th to 4th. See the
before/after table in the Stage 2 entry of `docs/CHANGELOG.md`.

Student-facing text updated: Cost & Decisions page (scoring explanation), Models & Assumptions
page (new "Decision scores" card).

## 2026-10-15 — Cost-analysis outputs added (Class E, audit E13)

Approved by the user on 2026-10-15. These are new display-only outputs, and no existing output changes.

| Output | Formula | Unit | Workbook |
|---|---|---|---|
| Tool cost per part | tcut/60 / T_eff · (insert cost / edges) | RM | COST ANALYSIS!E |
| Batch cycle hours | tcycle · batch_eff / 3600 | h | COST ANALYSIS!D |
| Cost per part at T = 15, 30, 60 min | tcycle/3600·rate + tcut/60/T·(insert/edges) | RM | COST ANALYSIS!F, G, H |

Basis: the workbook cells above. T_eff and batch_eff include scenarios B and C (INPUTS!E14, E15). The
15/30/60 min columns use fixed tool lives, as the workbook does, and don't depend on the scenario.

Dimensional check: s ÷ (s/min) ÷ min × RM = RM; s × parts ÷ (s/h) = h.

Expected effect: none on existing outputs. The tool cost part is already included in cost per
part. At defaults, trial 7 batch hours are 42.58 h (2 000 parts) and 74.52 h under change request B.

Student-facing text updated: Cost & Decisions page (new table), Models page, CSV export.

## 2026-10-15 — Feasibility tolerance kept (decision record, audit E14)

No change. The web app keeps `Ra ≤ limit + 1e-9` and `P ≤ Pmax + 1e-9`, while the workbook compares
exactly. They differ only when a value equals the limit to the last floating-point bit (e.g. Ra limit
1.5625 µm, f = 0.2 mm/rev). Treating rounding noise as a failure isn't physically meaningful, so this
difference is intentional.
