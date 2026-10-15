---
name: data-export
description: Design and implement MachinaLab student data export — CSV results, JSON save/restore, and the printable report — with a stable versioned schema, units in headers, metadata for lecturers, and protection against spreadsheet formula injection. Use for changes to Export CSV, Print report, save/load progress, or anything a lecturer will open or mark.
---

# Student data export

Export is the only way student work leaves the browser, and it's what gets marked. It must
be complete, unambiguous and safe to open in Excel.

## CSV (`site/js/export.js`, pure function `buildCsv(state, results) → string`)

Structure, in order:

1. Metadata block: `Format, MachinaLab results`, `Format version, 2`, `App version`,
   `Exported at (ISO 8601 with offset)`, `Student`, `Group`, `Scenario` (code and description),
   effective limits (Ra limit, Pmax, batch, tool life).
2. A blank row.
3. All input parameters: `Parameter, Symbol, Value, Unit`.
4. A blank row.
5. The trial table with **units in the header**: `Trial, Vc (m/min), f (mm/rev), ap (mm), N (rev/min),
   MRR (mm³/min), Ra (µm), Fc (N), Pc (kW), Pin (kW), tcut (s), tcycle (s), Cost (RM/part),
   Batch cost (RM), Feasible (Yes/No), Weighted score, Rank`.
6. Live simulator point.
7. Workbook text fields.

Rules:

- UTF-8 with BOM (Excel needs it to read µ and ³ correctly). CRLF line endings. RFC 4180 quoting.
- Numbers are written unformatted with full precision (no thousands separators, `.` decimal).
  Rounding is a display concern.
- **Formula injection**: any string cell starting with `= + - @`, tab or CR gets a leading `'`.
  This applies to student text, names and group.
- Filename: `MMT15603_<group>_<student>_<YYYYMMDD-HHmm>.csv`, sanitised to `[A-Za-z0-9_-]`.
- When the state is invalid, export the inputs and notes but not results, and say so in the file.

## JSON save/restore

"Save progress file" / "Open progress file" lets students move between lab PC and home
without accounts. Use the schema `{ format: 'machinalab-state', schemaVersion, savedAt, state }`. On import:
check the size (< 200 KB), parse in try/catch, and run the full sanitiser from `input-validation`.
Never merge unknown keys.

## Print report

The current "Print report" switches to the experiments page and prints only the trial table.
That's not a report. Build a dedicated print view (`@media print` plus a hidden `#report`
section, rendered on demand) containing: header (course, student, group, date, scenario),
inputs table, trial table, two or three key charts, decision matrix, the student's text
fields, and a footer disclaimer that the values are model predictions. Test this with "Save as PDF"
in Chrome and Edge. The A4 portrait layout should not cut cards across pages.

## Tests

- `buildCsv` with default state gives a snapshot of header and metadata lines, and parse-back gives
  the same numbers.
- Injection: notes `=1+1`, `@SUM(A1)`, `-2+3`, `\t=1` all come out prefixed.
- Quotes, commas and newlines inside notes survive a round trip.
- JSON import round trip, plus rejection of malformed, oversize and wrong-format files.
- Browser: click the export, capture the download, assert the filename pattern and BOM.
