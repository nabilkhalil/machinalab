---
name: pbl-activity
description: Author and implement guided problem-based-learning activities for MMT15603 in MachinaLab — task sequences, industrial change requests, scaffolded prompts, checkpoints, and reflection — aligned to course learning outcomes. Use when adding/editing PBL tasks, change-request scenarios, hints, worked examples, or the student workbook page.
---

# PBL activity design

## Principles

- Each activity starts from an **industrial problem statement** with explicit constraints
  (quality, power, batch, cost), not from the software.
- Activities are **guided, then open**: early tasks give a specific action and a check;
  later tasks require judgement and justification.
- Each task maps to a course learning outcome. Record the mapping in
  `site/js/pbl.js` as data, e.g. `{ id, clo: 'CLO2', title, instruction, evidence, check }`.
  Ask the lecturer for the actual CLO wording. Don't invent CLO text.
- A task asks for **evidence** the student can produce in the app (a table, a chart, a
  number with units) plus **reasoning** in their own words.
- Students must engage with model limitations at least once per activity.

## Task pattern

```
Task n — <verb-led title>
Context: one or two sentences linking to the industrial problem.
Do: concrete steps in the app ("Set scenario A. Open Nine Experiments.").
Record: what to write in the workbook field and which numbers to quote.
Check yourself: a self-check the app can verify (e.g. "You should find 3 feasible trials").
Think further: one open question (why, what if, which assumption matters).
```

Self-checks the app can compute (feasible count, best trial, cost at a trial) may be shown
as ✓/✗ feedback. **Never auto-grade written reasoning.**

## Change requests

A change request must be able to change the decision. Otherwise it teaches nothing. The audit found:

- **B (batch 3 500)** only scales batch cost. Ranking and feasibility don't change, because per-part
  cost has no batch-dependent term (no setup or tool-change time, no capacity limit).
- **C (tool life −40 %)** increases cost but cannot change the ranking, because tool life is
  independent of cutting speed (no Taylor relation).

Before adding or altering a change request, run the model under it and show the feasible set and
ranking change versus BASE. If it's a no-op, either (a) reframe it as a "sensitivity: does
your recommendation survive?" task, which is legitimate learning, or (b) propose a model
extension through the `model-change` skill (e.g. capacity hours per week for B, Taylor
`V·Tⁿ = C` for C). Changing the model needs lecturer approval.

## Workbook fields

Student text goes into named fields saved with the state and included in export (see
`data-export`). Show a character count. Never block the student from typing. Autosave and
show "Saved on this device at 14:32".

## Lecturer controls (optional, later stage)

A `?activity=<id>` URL parameter can preset a scenario and task set without accounts. Validate
the id against a fixed list, and never interpret URL content as HTML.

## Verify

Walk through the activity end to end at the defaults and record the expected answers in
`docs/pbl-answer-key.md`. This file is for lecturers only and is kept out of `site/`.
