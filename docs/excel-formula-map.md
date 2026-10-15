# Excel ↔ JavaScript formula map

Workbook: `reference/MMT15603_Virtual_Machinability_Simulator.xlsx`
(SHA-256 `c5edbe8f2d7e061e68cc272b5b8456749524ddc86e33db4575a9a3c4237753f7`).
Cell map: `tests/fixtures/excel-map.json`. JS references point to the legacy `app.js`.

Notes on the workbook itself: 9 sheets, all visible. No macros, no defined names and no hidden helper cells.
There are no `ROUND()` calls, and the formulas are the same in every row (checked for rows 5–13).

## Scenario cells (INPUTS)

| Quantity | Excel | JS (app.js:5) | Match |
|---|---|---|---|
| Effective Ra limit | `E13 =IF(E11="A",0.8,B11)` | `effRa = scenario==='A' ? .8 : raLimit` | ✓ |
| Effective batch | `E14 =IF(E11="B",3500,B17)` | `batch = scenario==='B' ? 3500 : batch` | ✓ |
| Effective tool life | `E15 =IF(E11="C",B16*0.6,B16)` | `life = scenario==='C' ? life*.6 : life` | ✓ |
| Depth of cut | `E16 =(B4-B5)/2` | `depth = (initial-final)/2` | ✓ |
| Mean diameter | `E17 =(B4+B5)/2` | `diameter = (initial+final)/2` | ✓ |

## 9 TRIALS (row 5 shown) and SIMULATOR

| Quantity | Excel | JS (app.js:6) | Match |
|---|---|---|---|
| RPM | `=1000*B5/(PI()*INPUTS!E17)` | `1000*v/(Math.PI*diameter())` | ✓ |
| MRR | `=1000*B5*C5*D5` | `1000*v*f*ap` | ✓ |
| Ideal Ra | `=1000*C5^2/(32*INPUTS!B7)` | `1000*f*f/(32*nose)` | ✓ (`f^2` vs `f*f`: last-bit only) |
| Fc | `=INPUTS!B8*D5*C5` | `kc*ap*f` | ✓ |
| Cutting power | `=H5*B5/60000` | `force*v/60000` | ✓ |
| Input power | `=I5/INPUTS!B9` | `cutPower/eff` | ✓ |
| Cut time | `=60*INPUTS!B6/(C5*E5)` | `60*length/(f*rpm)` | ✓ |
| Cycle time | `=K5+INPUTS!B13` | `cutTime+noncut` | ✓ |
| Cost/part | `=L5/3600*INPUTS!B12+K5/60/INPUTS!E15*(INPUTS!B14/INPUTS!B15)` | `cycle/3600*rate+cutTime/60/life()*(insert/edges)` | ✓ |
| Status | `=IF(AND(G5<=INPUTS!E13,J5<=INPUTS!B10),…)` | `ra<=effRa()+1e-9 && inputPower<=maxPower+1e-9` | ⚠ JS adds a 1e-9 tolerance (E14) |

The SIMULATOR sheet (B8:B18) uses the same formulas with B4/B5 as Vc/f. ✓

## COST ANALYSIS

| Quantity | Excel | JS | Match |
|---|---|---|---|
| Cost/part | `='9 TRIALS'!M5` | `cost` | ✓ |
| Batch cost | `=B5*INPUTS!E14` | `batchCost = cost*batch()` (app.js:6) | ✓ |
| Batch cycle hours | `='9 TRIALS'!L5*INPUTS!E14/3600` | — | ✗ not implemented (E13) |
| Tool cost/part | `='9 TRIALS'!K5/60/INPUTS!E15*(INPUTS!B14/INPUTS!B15)` | — | ✗ not implemented (E13) |
| Cost at 15/30/60 min life | same as cost/part with T fixed at 15, 30, 60 | — | ✗ not implemented (E13) |

## DECISION MATRIX

| Quantity | Excel | JS (app.js:19) | Match |
|---|---|---|---|
| Ra score | `=IF(MAX=MIN,100,100*(MAX-G5)/(MAX-MIN))` over G5:G13 | min–max, lower is better | ✓ |
| Productivity score | `=100*F5/MAX(F5:F13)` (ratio to best) | `100*(x-min)/(max-min)` (min–max) | **✗ E12** |
| Power score | `=100*MIN(J5:J13)/J5` (ratio to best) | `100*(max-x)/(max-min)` (min–max) | **✗ E12** |
| Cost score | `=100*MIN(M5:M13)/M5` (ratio to best) | `100*(max-x)/(max-min)` (min–max) | **✗ E12** |
| Weighted total | `=IF(G5="FEASIBLE",B5*K5+C5*K6+D5*K7+E5*K8,0)` | `feasible ? Σ values·w/100 : null` | ✓ form (infeasible gives 0 in Excel, null in JS) |
| Rank | `=IF(G5="FEASIBLE",RANK(F5,F5:F13,0),"")` | sort by score, index among feasible | ✓ form |
| Best trial | `=INDEX(A5:A13,MATCH(MAX(F5:F13),F5:F13,0))` | first feasible after sort | ✓ form |
| Weights | K5:K8 = 0.30, 0.25, 0.15, 0.30 | 30, 25, 15, 30 (%) | ✓ |

Both sides normalise across **all nine trials, including infeasible ones**. The workbook states
this explicitly in DECISION MATRIX!J12 ("normalised across nine trials"), which answers audit
question E6: it is intended.
