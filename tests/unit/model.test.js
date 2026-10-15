// The pure machining model (site/js/model.js), tested directly under Node.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../site/js/model.js');
const { sanitise } = require('../../site/js/validate.js');
const baseline = require('../fixtures/baseline-v2.json');

const defaults = () => sanitise({});

describe('bit-exact match with baseline-v2 (Stage 5 extraction is a pure refactor)', () => {
  for (const [code, expected] of Object.entries(baseline.scenarios)) {
    test(`scenario ${code}`, () => {
      const s = { ...defaults(), scenario: code };
      const check = (actual, exp, label) => {
        for (const [k, v] of Object.entries(exp)) assert.ok(Object.is(actual[k], v), `${label}.${k}: ${actual[k]} !== ${v}`);
      };
      model.trials(s).forEach((t, n) => check(t, expected.trials[n], `trial ${t.id}`));
      check(model.live(s), expected.live, 'live');
      model.scores(s).forEach((r, n) => {
        assert.equal(r.id, expected.ranking[n].id, `rank ${n + 1}`);
        assert.ok(Object.is(r.score, expected.ranking[n].score), `trial ${r.id} score`);
        r.values.forEach((v, k) => assert.ok(Object.is(v, expected.ranking[n].values[k]), `trial ${r.id} value ${k}`));
      });
    });
  }
});

test('model functions are pure: they do not modify the state passed in', () => {
  const s = defaults();
  const before = JSON.stringify(s);
  model.trials(s); model.scores(s); model.live(s); model.effective(s);
  assert.equal(JSON.stringify(s), before);
});

test('effective values per change request', () => {
  const at = scenario => model.effective({ ...defaults(), scenario });
  assert.deepEqual(at('BASE'), { raLimit: 1.6, maxPower: 7.5, batch: 2000, life: 30 });
  assert.equal(at('A').raLimit, 0.8);
  assert.equal(at('B').batch, 3500);
  assert.equal(at('C').life, 18);
});

// Physical behaviour that must hold for any valid input (model-change skill, section 3).
describe('physical properties over a grid of inputs', () => {
  const grid = [];
  for (const v of [40, 120, 300]) for (const f of [0.05, 0.12, 0.3]) for (const nose of [0.4, 0.8, 1.6]) grid.push({ v, f, nose });
  const near = (a, b, label) => assert.ok(Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b)), `${label}: ${a} vs ${b}`);

  test('Ra depends on feed and nose radius only; doubling f quadruples Ra', () => {
    for (const { v, f, nose } of grid) {
      const s = { ...defaults(), nose };
      near(model.calc(s, v, f).ra, model.calc(s, 2 * v, f).ra, 'Ra independent of Vc');
      near(model.calc(s, v, 2 * f).ra, 4 * model.calc(s, v, f).ra, 'Ra ∝ f²');
    }
  });

  test('doubling Vc doubles N, MRR and cutting power, and halves cutting time', () => {
    for (const { v, f } of grid) {
      const s = defaults(), a = model.calc(s, v, f), b = model.calc(s, 2 * v, f);
      near(b.rpm, 2 * a.rpm, 'N'); near(b.mrr, 2 * a.mrr, 'MRR'); near(b.cutPower, 2 * a.cutPower, 'Pc');
      near(b.cutTime, a.cutTime / 2, 'tcut'); near(b.force, a.force, 'Fc independent of Vc');
    }
  });

  test('force and power rise with depth of cut and kc; input power falls as efficiency rises', () => {
    const s = defaults();
    const deeper = model.calc({ ...s, final: 48 }, 150, 0.15), base = model.calc(s, 150, 0.15);
    assert.ok(deeper.force > base.force && deeper.mrr > base.mrr && deeper.inputPower > base.inputPower);
    assert.ok(model.calc({ ...s, kc: 2500 }, 150, 0.15).inputPower > base.inputPower);
    assert.ok(model.calc({ ...s, eff: 0.95 }, 150, 0.15).inputPower < base.inputPower);
  });

  test('order of magnitude at defaults (trial 5): N ≈ 965 rpm, Ra ≈ 0.88 µm, Pin ≈ 0.40 kW, cost ≈ RM 1.39', () => {
    const t5 = model.trials(defaults())[4];
    assert.equal(Math.round(t5.rpm), 965);
    assert.equal(t5.ra.toFixed(2), '0.88');
    assert.equal(t5.inputPower.toFixed(2), '0.40');
    assert.equal(t5.cost.toFixed(2), '1.39');
  });

  test('trial ids follow the 3 × 3 design', () => {
    const t = model.trials(defaults());
    assert.deepEqual(t.map(r => [r.id, r.v, r.f]), [[1, 100, 0.1], [2, 100, 0.15], [3, 100, 0.2], [4, 150, 0.1], [5, 150, 0.15],
      [6, 150, 0.2], [7, 200, 0.1], [8, 200, 0.15], [9, 200, 0.2]]);
  });
});
