---
name: model-change
description: Governed procedure for changing any machining equation, constant, unit, scenario rule, feasibility criterion or decision-scoring rule in MachinaLab. Use whenever an edit touches calc(), scores(), scenario functions (effRa/batch/life), defaults with engineering meaning, or js/model.js — including "small" fixes and pure refactors of that code.
---

# Model change protocol

The model is the engineering core students are assessed on. A silent numeric change
corrupts every past and future student report. Follow every step; do not skip ahead.

## 1. Classify the change

| Class | Example | Numeric output may change? |
|---|---|---|
| R — Refactor | Move calc() into js/model.js, rename variables | **No.** Must match baseline to ≤ 1e-12 relative |
| C — Correction | Formula disagrees with the workbook or a cited reference | Yes, to match the reference |
| E — Extension | Add Taylor tool life, setup cost, tool-change time | Only when the new option is enabled; default output unchanged |
| P — Policy | Change scenario values, default limits, scoring normalisation | Yes. Needs lecturer approval |

State the class in your plan. Classes C, E and P require the user's explicit approval before you edit.

## 2. Write the engineering basis first

Before you change any code, add an entry to `docs/MODEL_CHANGELOG.md`:

```
## YYYY-MM-DD — <short title> (Class X)
Quantity: <e.g. theoretical Ra>
Before: <formula with units>
After:  <formula with units>
Basis: <textbook + edition + page/equation number, ISO standard clause, or workbook sheet!cell>
Assumptions/validity range: <e.g. f < rε; sharp nose; no BUE>
Dimensional check: <show units cancel to the output unit>
Expected effect: <which outputs move, direction, magnitude at default inputs>
Student-facing text updated: <Models page / hints / README>
```

Acceptable references include Kalpakjian & Schmid, *Manufacturing Engineering and
Technology*; Groover, *Fundamentals of Modern Manufacturing*; Trent & Wright, *Metal
Cutting*; Sandvik Coromant technical guide (for kc values); ISO 3685 (tool life testing);
ISO 4287/21920 (roughness parameters). Do not invent page numbers. If you cannot verify a
reference, write "reference to be confirmed by lecturer" and say so in your reply.

## 3. Sanity checks for any formula

- Dimensional consistency: write out the units and cancel them.
- Limiting cases: f→0 gives Ra→0 and tcut→∞, and the UI must handle that; Vc doubles, so N doubles and tcut halves.
- Monotonicity: Ra rises with f and doesn't depend on Vc; MRR rises with Vc, f and ap;
  Pinput rises with Vc, f, ap and kc and falls as η rises.
- Order of magnitude at the defaults: N ≈ 965 rpm, Ra ≈ 0.88 µm, Pinput ≈ 0.40 kW,
  cost ≈ RM 1.39 (trial 5, base scenario).

## 4. Update tests in the same change

- Class R: the baseline fixture must not change. If it does, you made a behaviour change: stop.
- Class C/E/P: update `tests/fixtures/baseline-*.json` by generating a **new versioned file**
  (`baseline-v2.json`). Never edit v1 in place. Add a test for each new limiting case.
- If the workbook is available, run the `excel-parity` skill. Parity must not get worse.

## 5. Update student-facing explanations

The Models & Assumptions page, the README "Models" section and any hint text must show the
same formula and units as the code. Grep for the old formula text.

## 6. Report

Your final message lists: class, basis, a before/after table at default inputs for
all nine trials (or "identical" for Class R), test results, and anything left unverified.
