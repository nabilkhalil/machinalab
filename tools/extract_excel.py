"""Extract golden reference values from the MMT15603 workbook.

Reads the workbook twice with openpyxl (formulas and Excel's cached values),
following the cell map in tests/fixtures/excel-map.json, and writes
tests/fixtures/excel-golden.json. Nothing in the workbook is executed.

Usage (from repo root, inside the venv):
    .venv/Scripts/python -I tools/extract_excel.py
"""
import hashlib
import json
import pathlib
import sys
from datetime import datetime, timezone

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAP_PATH = ROOT / "tests" / "fixtures" / "excel-map.json"
OUT_PATH = ROOT / "tests" / "fixtures" / "excel-golden.json"


def cell(wb_values, wb_formulas, sheet, ref):
    value = wb_values[sheet][ref].value
    formula = wb_formulas[sheet][ref].value
    entry = {"cell": f"{sheet}!{ref}", "value": value}
    if isinstance(formula, str) and formula.startswith("="):
        entry["formula"] = formula
        if value is None:
            raise SystemExit(f"No cached value for {sheet}!{ref}. Open and save the workbook in Excel first.")
    return entry


def table(wb_values, wb_formulas, spec):
    rows = []
    for row in range(spec["firstRow"], spec["lastRow"] + 1):
        rows.append({key: cell(wb_values, wb_formulas, spec["sheet"], f"{col}{row}")
                     for key, col in spec["columns"].items()})
    return rows


def main():
    mapping = json.loads(MAP_PATH.read_text(encoding="utf-8"))
    workbook_path = ROOT / mapping["workbook"]
    if not workbook_path.exists():
        sys.exit(f"Workbook not found: {workbook_path}")
    if workbook_path.suffix.lower() == ".xlsm":
        print("WARNING: macro-enabled workbook; macros are ignored and never executed.")

    wb_formulas = openpyxl.load_workbook(workbook_path, data_only=False)
    wb_values = openpyxl.load_workbook(workbook_path, data_only=True)
    c = lambda sheet, ref: cell(wb_values, wb_formulas, sheet, ref)

    spec = mapping["inputs"]
    inputs = {key: c(spec["sheet"], ref) for key, ref in spec["cells"].items()}
    for key, refs in spec["arrays"].items():
        inputs[key] = [c(spec["sheet"], ref) for ref in refs]
    inputs["weights"] = [c(mapping["weights"]["sheet"], ref) for ref in mapping["weights"]["cells"]]
    live = mapping["live"]
    for key, ref in live["inputs"].items():
        inputs[key] = c(live["sheet"], ref)

    golden = {
        "description": "Cached values and formulas read from the reference workbook. Values reflect the scenario selected when the workbook was last saved.",
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "workbook": mapping["workbook"],
        "workbookSha256": hashlib.sha256(workbook_path.read_bytes()).hexdigest(),
        "inputs": inputs,
        "derived": {k: c(mapping["derived"]["sheet"], ref) for k, ref in mapping["derived"]["cells"].items()},
        "live": {k: c(live["sheet"], ref) for k, ref in live["outputs"].items()},
        "trials": table(wb_values, wb_formulas, mapping["trials"]),
        "costAnalysis": table(wb_values, wb_formulas, mapping["costAnalysis"]),
        "decision": table(wb_values, wb_formulas, mapping["decision"]),
        "bestTrial": c(mapping["decision"]["sheet"], mapping["decision"]["best"]),
    }
    OUT_PATH.write_text(json.dumps(golden, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_PATH.relative_to(ROOT)} (scenario {inputs['scenario']['value']}, sha256 {golden['workbookSha256'][:12]}...)")


if __name__ == "__main__":
    main()
