# MachinaLab: MMT15603 Virtual Machinability Simulator

**▶ Open the simulator: <https://nabilkhalil.github.io/machinalab/>**

MachinaLab is a virtual CNC turning laboratory for the course **MMT15603 Assessment of Machinability**.
You finish-turn an AISI 1045 steel shaft, run virtual experiments, check surface roughness, power and cost
against the limits, and justify the cutting conditions you recommend.

It runs entirely in your web browser. There's nothing to install, no account to create and no login.

> **All results are model predictions, not measurements.** The calculations reproduce the course workbook
> exactly. They use simplified textbook relationships (ideal roughness, constant specific cutting force, fixed
> tool life). The 3D view is an illustration drawn to help you understand the cut. It is not a physical simulation.

---

## For students

### What you can do

| Page | What it is for |
|---|---|
| **Overview** | The industrial problem, its constraints and the learning workflow |
| **Live Simulator** | A **3D turning view** plus sliders for cutting speed and feed, with instant predictions of spindle speed, roughness, force, power, time and cost |
| **Nine Experiments** | A 3 × 3 factorial experiment (three speeds × three feeds), with a feasibility check for every trial |
| **Data Analysis** | A feasibility map, response plots and trial-by-trial charts, each with a data table |
| **Cost & Decisions** | Cost per part, tool-life sensitivity, industrial change requests A/B/C and a weighted decision matrix |
| **PBL Workbook** | Space to write your analysis, plus save/open a progress file |
| **Models & Assumptions** | Every equation and limitation, and what the 3D view does and does not show |

### Quick start

1. Open <https://nabilkhalil.github.io/machinalab/> in **Chrome, Edge or Firefox** on a laptop or desktop. A phone works too.
2. Read the challenge on **Overview**, then open **Live Simulator**.
3. Move the **cutting speed (Vc)** and **feed (f)** sliders and watch the 3D view and the predictions change.
4. Run the **Nine Experiments**, study the **Data Analysis** charts, and rank the trials in **Cost & Decisions**.
5. Write your answers in the **PBL Workbook**.
6. Submit your work: **Export CSV** (top right) and/or **Print report** (choose *Save as PDF*).

### The 3D turning view

The view at the top of **Live Simulator** shows the bar turning, the tool feeding towards the chuck and the
material being removed. The picture follows your inputs:

- **Faster cutting speed** makes the bar turn faster on screen. **Larger feed** spreads the feed marks further apart. A **larger feed or speed** makes each pass quicker.
- **Arrows** show the directions of cutting speed **Vc**, feed **f**, depth of cut **ap** and the main cutting force **Fc**, labelled with their predicted values. The legend under the view explains each one in words.
- **Drag** the picture to look around, or use the buttons: ◀ ▶ turn the view, ▲ ▼ raise or lower it, ＋ － zoom. **Pause** stops the animation.
- To make the cut visible, the picture is **not to scale**: the spindle turns at 1/10 of the predicted speed, the feed per revolution is drawn 50 times larger, and a thin depth of cut is drawn deeper. The panel beside the view lists these factors.
- Only the values in the **MODEL PREDICTION** panel are calculated. Chips, colours and the surface look are illustrative.
- Tick **Reduce motion** for a still picture. To hide the arrows, untick **Show direction arrows**.
- If the computer can't show 3D graphics, a labelled 2D drawing of the same cut is shown instead.

### Your work and privacy

- Your work **saves automatically in this browser on this computer**. Nothing is sent anywhere: there are no analytics and no accounts, and nobody else can see your work.
- **Changing computers?** In **PBL Workbook**, choose **Save progress file**, keep the file (USB stick, cloud drive), then **Open progress file** on the other computer.
- **Clearing your browser data, or using a private/incognito window, deletes saved work.** Export a CSV or save a progress file before you close the page.
- Your name and group appear only in the files you export yourself.

### Troubleshooting

| Problem | What to do |
|---|---|
| Results are hidden and a message lists inputs to fix | An input is outside its allowed range. Click **Show me** next to the message, correct the value, and the results return. |
| "The 3D view cannot run on this computer" | The computer has 3D graphics (WebGL) switched off. Use the labelled drawing shown instead; all calculations still work. |
| The 3D view is slow | Tick **Reduce motion**, or press **Pause**. The animation also stops by itself when you scroll it out of view. |
| An old version still shows after an update | Reload the page (Ctrl + F5, or Cmd + Shift + R on a Mac). |
| My work disappeared | It was saved in a different browser, computer or private window. Open your progress file if you saved one. |

---

## For lecturers

- **Students need only the link.** For a lab without internet, download this repository (Code → Download ZIP) and open `site/index.html`; everything, including the 3D view, works from the file.
- **Marking:** the CSV export includes the inputs, the change request, all nine trials, the ranking, the student's written answers, the app version and a timestamp. It opens safely in Excel; cells that look like formulas are neutralised. **Print report** produces a one-document A4 summary.
- **Change requests:** A (Ra ≤ 0.8 µm), B (batch of 3,500) and C (tool life −40 %) are selected on **Cost & Decisions**.
- **Engineering basis:** the equations, units and scenario rules match `reference/MMT15603_Virtual_Machinability_Simulator.xlsx`
  (see [docs/excel-parity-report.md](docs/excel-parity-report.md)). They are listed under [Models](#models) below and on the app's
  *Models & Assumptions* page.
- **This repository is public.** Never put answer keys or student submissions in it.
- Planned next: guided industrial challenges with prediction questions and instant feedback. These need the course learning outcome (CLO) wording.
  See [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md).

---

## Models

| Quantity | Formula | Unit |
|---|---|---|
| Depth of cut | ap = (Di − Df) / 2 | mm |
| Spindle speed | N = 1000 Vc / (π Dmean), Dmean = (Di + Df) / 2 | rev/min |
| Material removal rate | MRR = 1000 Vc f ap (shown as cm³/min) | mm³/min |
| Ideal surface roughness | Ra = 1000 f² / (32 rε) | µm |
| Cutting force | Fc = kc ap f | N |
| Cutting power / input power | Pc = Fc Vc / 60000; Pinput = Pc / η | kW |
| Cutting time | tcut = 60 L / (f N) | s |
| Cost per part | tcycle/3600 × machine rate + tcut/60/T × insert cost/edges | RM |
| Feasible | Ra ≤ Ra limit **and** Pinput ≤ Pmax | — |

Decision scores (0–100): Ra by min–max scaling; productivity 100 × MRR/MRRmax; power 100 × Pmin/P; cost 100 × Cmin/C.
Scores are normalised over all nine trials; only feasible trials receive a weighted total.

The model does not include temperature, vibration, tool wear, chip formation or a speed-dependent tool life.
Validate any real machining decision with tooling data and physical trials.

---

## For maintainers

The app is plain HTML, CSS and JavaScript in `site/`, with no build step. It opens by double-click (`file://`) and on
GitHub Pages. Its one runtime library, Three.js r159, is stored in `site/js/vendor/`
([decision record](docs/decisions/0001-three-js-3d-turning-view.md)).

**Run locally:** open `site/index.html`, or run `npm run serve` and visit <http://localhost:8000>.

**Tests:** Node.js 20+ is required. Python 3 is needed only to re-extract values from the workbook.

| Command | Purpose |
|---|---|
| `npm install` then `npx playwright install chromium` | One-time setup |
| `npm test` | Unit tests: baseline lock, Excel parity, model, validation, export, charts and the 3D mapping |
| `npm run test:browser` | Playwright tests: pages, 3D view, accessibility (axe), keyboard and CSP |
| `npm run check` | Both of the above |
| `npm run excel:extract` | Re-read the workbook into `tests/fixtures/excel-golden.json` (needs `.venv` with openpyxl) |

**Release process:** work on a `stage-N-*` branch and open a pull request; CI runs both test suites. Merging into `main`
publishes `site/` to GitHub Pages automatically, and only after all tests pass. Only `site/` is published.

Project rules are in [CLAUDE.md](CLAUDE.md), the plan is in [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) and the history is in
[docs/CHANGELOG.md](docs/CHANGELOG.md).
