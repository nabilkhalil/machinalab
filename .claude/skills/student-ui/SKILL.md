---
name: student-ui
description: Interface, wording and accessibility standards for MachinaLab's undergraduate users who have no programming background. Use for any change to visible text, page layout, forms, buttons, notices, navigation, colour, responsive behaviour or accessibility.
---

# Student-facing interface

Design for a second-year mechanical/manufacturing student on a laptop or phone, in a lab or
at home, who knows turning theory, has never programmed, and is being assessed.

## Wording

- Name first, symbol second, unit always: "Cutting speed, Vc (m/min)".
- Use present-tense verbs on buttons: "Download results (CSV)", "Reset to default levels".
- Keep jargon to the course vocabulary. If a term isn't in the course notes (e.g. "min–max
  normalisation"), add a one-sentence explanation or an ⓘ disclosure.
- Show every computed number with a unit and a sensible precision: Ra to 2–3 dp in µm,
  power to 2 dp in kW, rpm to 0 dp, and cost as RM with 2 dp.
- Say clearly, close to the outputs, that results are **model predictions**, not measurements.
- British/Malaysian spelling.

## Interaction

- **Preserve focus and scroll on re-render.** Before replacing `#view.innerHTML`, record
  `document.activeElement.id` and the selection range, and restore them after. Better still, update only
  output nodes when inputs change. Tabbing through fields must never lose focus.
- Update outputs on `input` (debounced ~150 ms) for the live simulator so students see
  cause and effect. Validate on `change` and blur.
- Consider sliders paired with number boxes for Vc and f, so exploration is easier.
- Show what changed: briefly highlight output cards whose value changed.
- When a scenario overrides a student-entered value (e.g. scenario A fixes Ra ≤ 0.8),
  show that on the overridden field and disable it, with "Set by change request A".
- Destructive actions (reset levels, clear notes) need a confirmation.

## Accessibility (WCAG 2.2 AA)

- Each input has a `<label for>` linked to it. The current experiment, weight, select and text
  inputs lack this.
- Text contrast ≥ 4.5:1. The current muted grey `#71899a` on white is ≈ 3.4:1, so darken it.
- Decorative glyphs (◫ ⚙ ▦ …) get `aria-hidden="true"`.
- Status is never conveyed by colour alone: keep the FEASIBLE / NOT FEASIBLE text.
- The current nav page is announced: `aria-current="page"` and a live region for the page title.
- Target size ≥ 24×24 px, and focus is always visible.
- Charts: `role="img"` with a meaningful `aria-label` summary, plus a data table alternative
  (see the `visualisation` skill).

## Layout

- Works from 360 px wide with no horizontal page scroll. Wide tables scroll inside their wrapper.
- The print stylesheet produces a coherent report (see the `data-export` skill).
- Keep the existing visual language (navy sidebar, teal accents, cards). Restyle only with a
  reason.

## Before finishing

Run through the changed screen with the keyboard only, and at 375 px width. Check the text
reads correctly to someone who has never seen the code. Report what you checked.
