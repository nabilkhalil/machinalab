---
name: visualisation
description: Build and review MachinaLab's charts and interactive visuals (bar charts per trial, response curves, Ra-vs-feed and power-vs-speed plots, feasibility maps, turning process diagrams) as dependency-free inline SVG that is accurate, labelled, accessible and printable. Use for any chart or diagram work.
---

# Visualisation

## Constraints

- Inline SVG generated in `site/js/charts.js`. No chart libraries, no canvas, no CDN, so the app
  keeps working offline, under CSP and in print.
- Chart builders are pure functions `(data, options) → svgString` so they can be unit tested.
- Escape all text that goes into SVG (`esc()`).

## Accuracy rules

- The y-axis starts at 0 for bar charts. Choose the axis maximum with a "nice number" algorithm (1, 2, 2.5,
  5 × 10ⁿ) **from the data**. Never use a fixed floor such as `Math.max(..., 1)`. The current code
  does this, which flattens small values such as power (max ≈ 0.7 kW) against a 1.0 axis.
- Both axes carry a title with units: "Theoretical Ra (µm)", "Trial number (Vc, f)".
- Draw constraint lines where a limit applies: the Ra limit on the roughness chart and Pmax on the power
  chart. Label the line ("Ra limit 1.6 µm") and visually separate the bars above it.
- Mark infeasible trials with pattern or outline, not colour alone.
- Tick labels use the same precision as the tables.

## Implemented (Stage 8)

`site/js/charts.js` provides `niceScale`, `barChart`, `stackedBarChart`, `lineChart` and `feasibilityMap`. Views 1–3 below
and improved versions of the six bar charts are done. Series colours (validated): `#2667a0`, `#c2611c`, `#7b4fae`.
Chart ids must be unique per context: `an-` on the page, `rep-` in the printed report.

## Educationally useful views (priority order)

1. **Response plots**: output vs feed with one line per cutting speed (3×3 design). This shows
   that Ra depends on f only, while MRR and power scale with Vc·f. It's far more instructive than bars by trial number.
2. **Feasibility map**: Vc–f plane, shaded feasible region from the Ra and power limits, with
   the nine trials and the live point plotted. Updates when the scenario changes.
3. **Cost breakdown**: stacked bar of machine-time cost vs tool cost per trial. This makes
   scenario C (tool life −40 %) visible.
4. **Turning schematic**: a simple labelled SVG of the bar, tool, Di, Df, ap, f and Vc that
   updates with the inputs, to connect symbols to geometry.
5. The existing six per-trial bar charts are kept as the default view until the replacements are approved.

## Accessibility

- `<svg role="img" aria-labelledby="t d">` with `<title>` (chart name) and `<desc>`
  (one-sentence trend summary computed from data, e.g. "Ra rises from 0.39 to 1.56 µm as
  feed increases; cutting speed has no effect.").
- Every chart has a "Show data table" toggle.
- Colour palette passes 3:1 against the background for graphical objects. Distinguish series
  by marker shape or dash pattern too.
- Hover tooltips (`<title>`) are a convenience only. Values must also be reachable without
  a mouse.

## Responsive and print

`viewBox` with `width:100%`, minimum font size 11 px at 360 px width, and a black-on-white print
style with no reliance on hover.

## Verify

Unit-test the axis maximum and tick generation (edge cases: all zeros, single value, values
< 1). Take a Playwright screenshot of each chart at the defaults and in scenario A, and look at it.
