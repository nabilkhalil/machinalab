// Properties of the decision scores and cost-analysis outputs that must hold for any
// valid input, not just the defaults (docs/MODEL_CHANGELOG.md, 2026-10-15).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { loadLegacy } = require('../../tools/legacy-loader');

const APP = path.join(__dirname, '..', '..', 'site', 'app.js');
const close = (a, b, label) => assert.ok(Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b)), `${label}: ${a} vs ${b}`);

// A spread of valid level sets, including a tight one and an unusually wide one.
const LEVEL_SETS = [
  { speeds: [100, 150, 200], feeds: [0.1, 0.15, 0.2] },
  { speeds: [80, 81, 82], feeds: [0.05, 0.06, 0.07] },
  { speeds: [60, 250, 400], feeds: [0.08, 0.3, 0.5] },
];

for (const levels of LEVEL_SETS) {
  const label = `speeds ${levels.speeds} / feeds ${levels.feeds}`;

  test(`ratio scores: best trial scores 100, all scores in (0, 100] — ${label}`, () => {
    const model = loadLegacy(APP);
    Object.assign(model.state, { speeds: levels.speeds, feeds: levels.feeds });
    const s = Array.from(model.scores());
    for (let k = 0; k < 4; k++) {
      const column = s.map(r => r.values[k]);
      assert.ok(column.every(v => v >= 0 && v <= 100 + 1e-9), `criterion ${k} out of range: ${column}`);
      close(Math.max(...column), 100, `criterion ${k} best`);
    }
    // Ratio criteria are strictly positive; only Ra (min-max) can reach 0.
    for (let k = 1; k < 4; k++) assert.ok(s.every(r => r.values[k] > 0), `criterion ${k} has a zero`);
  });

  test(`ratio scores are proportional to the best value — ${label}`, () => {
    const model = loadLegacy(APP);
    Object.assign(model.state, { speeds: levels.speeds, feeds: levels.feeds });
    const s = Array.from(model.scores());
    const maxMrr = Math.max(...s.map(r => r.mrr));
    const minCost = Math.min(...s.map(r => r.cost));
    for (const r of s) {
      close(r.values[1], 100 * r.mrr / maxMrr, `trial ${r.id} productivity`);
      close(r.values[3], 100 * minCost / r.cost, `trial ${r.id} cost`);
    }
  });
}

test('Ra score is 100 for all trials when every feed level is equal (no spread)', () => {
  const model = loadLegacy(APP);
  model.state.feeds = [0.15, 0.15, 0.15];
  assert.ok(Array.from(model.scores()).every(r => r.values[0] === 100));
});

test('weighted score is null for infeasible trials and ranking puts them last', () => {
  const model = loadLegacy(APP);
  model.state.scenario = 'A';
  const s = Array.from(model.scores());
  const firstInfeasible = s.findIndex(r => !r.feasible);
  assert.ok(s.slice(firstInfeasible).every(r => !r.feasible && r.score === null));
  assert.deepEqual(s.slice(0, firstInfeasible).map(r => r.id), [7, 4, 1]);
});

test('cost per part = machine-time cost + tool cost', () => {
  const model = loadLegacy(APP);
  for (const scenario of ['BASE', 'C']) {
    model.state.scenario = scenario;
    for (const r of model.trials()) close(r.cost, r.cycle / 3600 * model.state.rate + r.toolCost, `${scenario} trial ${r.id}`);
  }
});

test('30-min sensitivity column equals cost per part when tool life is 30 min (BASE)', () => {
  const model = loadLegacy(APP);
  for (const r of model.trials()) close(r.costLife30, r.cost, `trial ${r.id}`);
});

test('tool-life sensitivity columns ignore change request C; tool cost does not', () => {
  const model = loadLegacy(APP);
  const base = model.trials();
  model.state.scenario = 'C';
  const c = model.trials();
  base.forEach((r, n) => {
    close(c[n].costLife15, r.costLife15, `trial ${r.id} T=15`);
    close(c[n].toolCost, r.toolCost / 0.6, `trial ${r.id} tool cost under C`);
  });
  assert.ok(c.every((r, n) => r.costLife15 > r.costLife30 && r.costLife30 > r.costLife60), 'longer tool life must be cheaper');
});

test('batch cycle hours scale with change request B (2 000 → 3 500 parts)', () => {
  const model = loadLegacy(APP);
  const base = model.trials();
  model.state.scenario = 'B';
  model.trials().forEach((r, n) => close(r.batchHours, base[n].batchHours * 3500 / 2000, `trial ${r.id}`));
  close(base[6].batchHours, 42.58480605878246, 'trial 7 BASE (workbook COST ANALYSIS!D11)');
});
