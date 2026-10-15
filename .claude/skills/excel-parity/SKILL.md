---
name: excel-parity
description: Extract reference values from MMT15603_Virtual_Machinability_Simulator.xlsx and verify the JavaScript model reproduces them. Use when the workbook is added or updated, when asked to "validate against Excel", before any model-change of class C, and before each release.
---

# Excel parity validation

Goal: show, cell by cell, that the web model and the workbook produce the same numbers
for the same inputs. List every difference you find.

## Preconditions

- The workbook must be at `reference/MMT15603_Virtual_Machinability_Simulator.xlsx`.
  If it is missing, **stop and ask the user for it**. Do not reconstruct "expected"
  values from the JS code and call that Excel validation.
- Treat the workbook as untrusted input. Read it with `openpyxl` only. Never open it with
  macros enabled or execute anything from it. If it is `.xlsm`, report the presence of macros.

## Step 1 — Map the workbook (once, then commit the map)

Read the workbook twice: with `data_only=False` for formulas and `data_only=True` for
cached values. Cached values exist only if Excel last saved the file, so warn if they are `None`.

Write `tests/fixtures/excel-map.json` that maps each model input and output to a sheet and cell:

```json
{ "inputs":  { "initial": "Inputs!C5", "final": "Inputs!C6", ... },
  "trials":  { "sheet": "Experiments", "firstRow": 8, "columns": { "v": "B", "f": "C", "rpm": "D", ... } },
  "scenarios": { "A": "...", "B": "...", "C": "..." } }
```

For every output column, record the **Excel formula text** next to the JS formula in
`docs/excel-formula-map.md`. Flag any that differ algebraically, for example Excel using the initial
diameter for N where JS uses the mean diameter, `ROUND()` calls, or hidden helper cells.

## Step 2 — Extract golden values

`tools/extract_excel.py` (create it if missing) writes `tests/fixtures/excel-golden.json`:
the input set plus every trial's outputs plus the scenario outputs, as raw floats (unrounded).
Use a virtualenv: `python -m venv .venv && .venv/Scripts/python -m pip install openpyxl`
(Windows) and run it with `-I`.

If the workbook has scenario switches as inputs, record each scenario's cached
values only when they're present. Otherwise document that the scenario values were taken from the
lecturer-confirmed cases.

## Step 3 — Compare

`tests/unit/excel-parity.test.js` loads the golden file, runs the JS model with the same inputs,
and asserts:

- relative error ≤ 1e-9 for direct formulas (both sides use IEEE-754 doubles);
- relative error ≤ 1e-6 when Excel uses `PI()` or iterative functions;
- feasibility flags and ranking order are exactly equal.

On failure, print a table of quantity, trial, Excel value, JS value, relative error and the Excel formula.

## Step 4 — Report

Write `docs/excel-parity-report.md` with the date, workbook file hash (SHA-256), pass/fail
per quantity, and each discrepancy with your diagnosis. Discrepancies are fixed **only**
through the `model-change` skill (class C), after the user confirms which side is correct.
Sometimes the workbook is the side that's wrong.
