// Excel parity: the web model must reproduce the reference workbook's cached values.
// Golden values come from tools/extract_excel.py (see .claude/skills/excel-parity).
// Any future discrepancy must be reported (docs/excel-parity-report.md) and may be
// marked `todo` only until the agreed fix lands.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { loadLegacy } = require('../../tools/legacy-loader');
const golden = require('../fixtures/excel-golden.json');

const ROOT = path.join(__dirname, '..', '..');
const DIRECT = 1e-9;  // formulas without PI(): both sides are IEEE-754 doubles
const WITH_PI = 1e-6; // formulas that depend on PI() via spindle speed
const PI_DEPENDENT = new Set(['rpm', 'cutTime', 'cycle', 'cost', 'batchCost']);

function freshModel() {
  const legacy = loadLegacy(path.join(ROOT, 'site', 'app.js'));
  const i = golden.inputs;
  for (const key of ['initial', 'final', 'length', 'nose', 'kc', 'eff', 'maxPower', 'raLimit',
    'rate', 'noncut', 'insert', 'edges', 'life', 'batch', 'liveSpeed', 'liveFeed']) {
    legacy.state[key] = i[key].value;
  }
  legacy.state.speeds = i.speeds.map(c => c.value);
  legacy.state.feeds = i.feeds.map(c => c.value);
  legacy.state.weights = i.weights.map(c => c.value * 100);
  legacy.state.scenario = i.scenario.value;
  return legacy;
}

const relErr = (js, xl) => Math.abs(js - xl) / Math.max(1, Math.abs(xl));

// Compare one quantity for every trial; on failure print a readable table.
function assertColumn(label, rows, tolerance) {
  const bad = rows.filter(r => !(relErr(r.js, r.excel) <= tolerance));
  if (bad.length) {
    const lines = bad.map(r => `  trial ${r.id}: excel=${r.excel} js=${r.js} relErr=${relErr(r.js, r.excel).toExponential(2)}  ${r.formula ?? ''}`);
    assert.fail(`${label}: ${bad.length} mismatch(es) above ${tolerance}\n${lines.join('\n')}`);
  }
}

describe('workbook inputs match web-app defaults', () => {
  const { defaults } = loadLegacy(path.join(ROOT, 'site', 'app.js'));
  const i = golden.inputs;
  for (const key of ['initial', 'final', 'length', 'nose', 'kc', 'eff', 'maxPower', 'raLimit',
    'rate', 'noncut', 'insert', 'edges', 'life', 'batch', 'liveSpeed', 'liveFeed']) {
    test(key, () => assert.equal(defaults[key], i[key].value));
  }
  test('speed levels', () => assert.deepEqual([...defaults.speeds], i.speeds.map(c => c.value)));
  test('feed levels', () => assert.deepEqual([...defaults.feeds], i.feeds.map(c => c.value)));
  test('weights (percent vs fraction)', () => assert.deepEqual([...defaults.weights], i.weights.map(c => Math.round(c.value * 100))));
  test('scenario', () => assert.equal(defaults.scenario, i.scenario.value));
});

describe('9 TRIALS sheet', () => {
  const trials = freshModel().trials();
  for (const key of ['v', 'f', 'ap', 'rpm', 'mrr', 'ra', 'force', 'cutPower', 'inputPower', 'cutTime', 'cycle', 'cost']) {
    test(key, () => assertColumn(key, golden.trials.map((g, n) => ({
      id: g.id.value, excel: g[key].value, js: trials[n][key], formula: g[key].formula,
    })), PI_DEPENDENT.has(key) ? WITH_PI : DIRECT));
  }
  test('feasibility status', () => {
    assert.deepEqual(trials.map(t => t.feasible), golden.trials.map(g => g.status.value === 'FEASIBLE'));
  });
});

describe('SIMULATOR sheet (live point)', () => {
  const live = freshModel().live();
  for (const key of ['ap', 'rpm', 'mrr', 'ra', 'force', 'cutPower', 'inputPower', 'cutTime', 'cycle', 'cost']) {
    test(key, () => assertColumn(key, [{ id: 'live', excel: golden.live[key].value, js: live[key], formula: golden.live[key].formula }],
      PI_DEPENDENT.has(key) ? WITH_PI : DIRECT));
  }
  test('feasibility status', () => assert.equal(live.feasible, golden.live.status.value === 'FEASIBLE'));
});

describe('INPUTS scenario-derived cells', () => {
  const model = freshModel();
  const d = golden.derived;
  test('depth of cut', () => assert.ok(relErr(model.trials()[0].ap, d.ap.value) <= DIRECT));
  test('effective batch drives batch cost', () => {
    const t = model.trials()[0];
    assert.ok(relErr(t.batchCost / t.cost, d.effBatch.value) <= DIRECT);
  });
});

describe('COST ANALYSIS sheet', () => {
  const trials = freshModel().trials();
  test('batch cost', () => assertColumn('batchCost', golden.costAnalysis.map((g, n) => ({
    id: g.id.value, excel: g.batchCost.value, js: trials[n].batchCost, formula: g.batchCost.formula,
  })), WITH_PI));
  for (const key of ['batchHours', 'toolCost', 'costLife15', 'costLife30', 'costLife60']) {
    test(key, () => assertColumn(key, golden.costAnalysis.map((g, n) => ({
      id: g.id.value, excel: g[key].value, js: trials[n][key], formula: g[key].formula,
    })), WITH_PI));
  }
});

describe('DECISION MATRIX sheet', () => {
  const byId = new Map(freshModel().scores().map(r => [r.id, r]));
  const rows = (key, pickJs) => golden.decision.map(g => ({
    id: g.id.value, excel: g[key].value, js: pickJs(byId.get(g.id.value)), formula: g[key].formula,
  }));

  test('Ra score', () => assertColumn('raScore', rows('raScore', r => r.values[0]), DIRECT));
  test('productivity score', () => assertColumn('mrrScore', rows('mrrScore', r => r.values[1]), DIRECT));
  test('power score', () => assertColumn('powerScore', rows('powerScore', r => r.values[2]), DIRECT));
  test('cost score', () => assertColumn('costScore', rows('costScore', r => r.values[3]), WITH_PI));
  test('weighted total', () => assertColumn('weighted', rows('weighted', r => r.score ?? 0), WITH_PI));
  test('rank order of feasible trials', () => {
    const excelOrder = golden.decision.filter(g => g.rank.value !== '').sort((a, b) => a.rank.value - b.rank.value).map(g => g.id.value);
    const jsOrder = [...byId.values()].filter(r => r.feasible).map(r => r.id);
    assert.deepEqual(jsOrder, excelOrder);
  });
  test('best feasible trial', () => {
    const best = [...byId.values()].find(r => r.feasible);
    assert.equal(best.id, golden.bestTrial.value);
  });
});
