# MachinaLab — MMT15603 Virtual Machinability Simulator

A browser-based educational CNC turning simulation based on `MMT15603_Virtual_Machinability_Simulator.xlsx`
(kept in `reference/`). The machining calculations reproduce the workbook exactly. See
`docs/excel-parity-report.md`.

## Features
- Interactive turning parameter controls with immediate theoretical results
- Nine-trial 3×3 factorial design
- Six charts, CSV export, printing, and browser-local student notes
- Cost estimation, feasibility checks, weighted decision matrix
- Industrial change requests A, B, and C
- Responsive design for desktop and mobile

## Run locally
Open `site/index.html` in a browser. There's no installation or build step. Alternatively, run
`npm run serve` (or `python -m http.server 8000 -d site`) and open http://localhost:8000.

## Deploy on GitHub Pages
1. Create a GitHub repository named `machinalab` and push this repository to its `main` branch.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Each push to `main` runs `.github/workflows/deploy.yml`. **Only the `site/` folder is published.**
   Your site will be at `https://YOUR-USERNAME.github.io/machinalab/`.

GitHub Pages on a free account requires a public repository, so everything in the repository
(including `docs/` and `reference/`) is visible on GitHub even though it isn't on the website. Never
commit answer keys or student submissions.

The app needs no server, student accounts or API keys. Notes persist only in the same browser and
device, so students should export results for submission. GitHub Pages does not collect or grade student submissions.

## For maintainers
Requires Node.js 20+. Python 3 is only needed to re-extract values from the workbook.

| Command | Purpose |
|---|---|
| `npm install` then `npx playwright install chromium` | One-time setup for browser tests |
| `npm test` | Unit tests: baseline regression lock + Excel parity |
| `npm run test:browser` | Playwright smoke tests (serves `site/` on port 8765 via `tools/serve.js`) |
| `npm run check` | Both of the above |
| `npm run excel:extract` | Re-read the workbook into `tests/fixtures/excel-golden.json` (needs `.venv` with openpyxl) |

Engineering and change rules are in `CLAUDE.md`, the audit and plan are in `docs/AUDIT.md`, and the
history is in `docs/CHANGELOG.md`.

## Models
- `N = 1000 Vc / (π Dmean)`
- `MRR = 1000 Vc f ap`
- `Ra = 1000 f² / (32 rε)` in µm
- `Fc = kc ap f`
- `Pc = Fc Vc / 60000`
- `Pinput = Pc / efficiency`
- `tcut = 60 L / (f N)` in seconds
- `Cpart = tcycle/3600 × machine_rate + tcut/60/tool_life × insert_cost/edges`
- `Ctool = tcut/60/tool_life × insert_cost/edges`; `tbatch = tcycle × batch / 3600` in hours
- Decision scores (0–100): Ra min–max; productivity `100 × MRR/MRRmax`; power `100 × Pmin/P`; cost `100 × Cmin/C`

All outputs are approximate analytical predictions. The model does not represent experimentally validated surface roughness, tool wear, or tool life as a function of cutting speed.
