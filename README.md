# MachinaLab — MMT15603 Virtual Machinability Simulator

A browser-based educational CNC turning simulation based on `MMT15603_Virtual_Machinability_Simulator.xlsx`.

## Features
- Interactive turning parameter controls with immediate theoretical results
- Nine-trial 3×3 factorial design
- Six charts, CSV export, printing, and browser-local student notes
- Cost estimation, feasibility checks, weighted decision matrix
- Industrial change requests A, B, and C
- Responsive design for desktop and mobile

## Run locally
Open `index.html` in a browser. No installation or build step is needed. Alternatively, run `python -m http.server 8000` and open http://localhost:8000.

## Deploy on GitHub Pages
1. Create a public GitHub repository named `machinalab`.
2. Upload **the contents** of this folder to the repository root, including `.github/workflows/deploy.yml`.
3. In **Settings → Pages**, set **Source** to **GitHub Actions**.
4. Wait for the deployment workflow to complete. Your site will be at `https://YOUR-USERNAME.github.io/machinalab/`.

This application requires no dependencies, server, student accounts, or API keys. Notes persist only in the same browser/device. Export results for submission. GitHub Pages does not collect or grade student submissions.

## Models
- `N = 1000 Vc / (π Dmean)`
- `MRR = 1000 Vc f ap`
- `Ra = 1000 f² / (32 rε)` in µm
- `Fc = kc ap f`
- `Pc = Fc Vc / 60000`
- `Pinput = Pc / efficiency`
- `tcut = 60 L / (f N)` in seconds
- `Cpart = tcycle/3600 × machine_rate + tcut/60/tool_life × insert_cost/edges`

All outputs are approximate analytical predictions. Model does not represent experimentally validated surface roughness, tool wear, or tool life as a function of cutting speed.
