---
name: input-validation
description: Define and enforce the parameter schema for every MachinaLab input (range, unit, step, default, plain-language help and error text), sanitise stored state, and present validation errors students can act on. Use when adding/changing any input field, default value, scenario, weight, or anything read from localStorage or an imported file.
---

# Input validation

## Single source of truth: `site/js/params.js`

Every numeric input is declared once:

```js
{ key: 'liveFeed', label: 'Feed f', unit: 'mm/rev', min: 0.01, max: 2, def: 0.15,
  reason: 'Turning feeds lie between about 0.01 and 2 mm/rev.' }
```

Fields: `key`, `label`, `unit`, `min`, `max`, `def`, `reason`, and optionally `integer: true`.
Experiment levels, weights, scenarios and text keys have their own sections in the same file.

The form, `validate()`, the CSV header and the Models page all read from this schema.
Never hard-code a range in a template.

Ranges are engineering limits, so cite their source (insert catalogue, machine spec) in a
comment. If you don't know a sensible limit, ask. Don't guess a narrow range that
blocks a legitimate experiment.

## Rules validate() must enforce

| Check | Message pattern |
|---|---|
| Not a number or empty | "Enter a number for *Feed per revolution* (mm/rev)." |
| Outside [min,max] | "*Feed* must be between 0.02 and 0.6 mm/rev. {rangeReason}" |
| Cross-field: Df < Di | "Final diameter must be smaller than initial diameter. Material is removed, so the bar gets thinner." |
| Cross-field: f < rε (Ra model validity) | warning, not error: "Feed is larger than the nose radius. The theoretical Ra formula is not reliable here." |
| 0 < η ≤ 1 | "Drive efficiency is a fraction between 0 and 1 (e.g. 0.85 = 85 %)." |
| Weights total 100 (tolerance 1e-6) | "Decision weights add up to 95 %. They must total 100 %." |
| Speeds/feeds levels distinct and ascending | warning only |

`validate(state)` returns `{ errors: [{key, message}], warnings: [...] }`. It never throws.
Array members use keys like `speeds.0` (DOM id `speeds-0`). The weight-total error uses the key `weights`.
Use `modelErrors()` and `weightErrors()` to decide what to hide. Invalid weights block only the ranking.

## Behaviour on invalid input

- Mark the field (`aria-invalid="true"`, linked by `aria-describedby` to its message),
  and list errors in the notice banner with links that focus the field.
- **Do not compute or show results from invalid state.** Show "—" and a short "Fix the
  highlighted inputs to see results" instead. Feasibility must never be shown for invalid input.
- Keep the student's typed value in the field. Don't silently snap it to the range.

## Loading stored state (`localStorage`, imported JSON)

1. `try { JSON.parse(...) } catch { use defaults }`.
2. For each schema key, accept the stored value only if it has the right type and is finite
   and within range. Otherwise use the default for that field only.
3. Arrays (`speeds`, `feeds`, `weights`) must have the exact length, with each element validated.
4. Enum fields (`scenario`) must be in the allowed list.
5. Text fields: string type, truncated to a max length (e.g. 5 000 chars).
6. Store a `schemaVersion`. Migrate older versions explicitly, and never assume the shape.

## Tests

For each parameter, test min, max, just outside each, NaN, empty string and a string value in
storage. Test each cross-field rule. Test a fully corrupted `localStorage` blob.
