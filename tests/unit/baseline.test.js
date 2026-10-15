// Regression lock: the app must reproduce tests/fixtures/baseline-v1.json for every
// scenario. Only an approved model change (see .claude/skills/model-change) may
// replace this with a new versioned baseline; never edit baseline-v1.json in place.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { loadLegacy } = require('../../tools/legacy-loader');
const baseline = require('../fixtures/baseline-v1.json');

const APP = path.join(__dirname, '..', '..', 'site', 'app.js');
const TOLERANCE = 1e-12;

function assertClose(actual, expected, label) {
  if (typeof expected === 'number') {
    const err = Math.abs(actual - expected) / Math.max(1, Math.abs(expected));
    assert.ok(err <= TOLERANCE, `${label}: expected ${expected}, got ${actual} (rel err ${err.toExponential(2)})`);
  } else {
    assert.equal(actual, expected, label);
  }
}

for (const [code, expected] of Object.entries(baseline.scenarios)) {
  describe(`scenario ${code}`, () => {
    const model = loadLegacy(APP);
    model.state.scenario = code;

    test('nine trials', () => {
      const trials = model.trials();
      assert.equal(trials.length, expected.trials.length);
      expected.trials.forEach((row, n) => {
        for (const [key, value] of Object.entries(row)) assertClose(trials[n][key], value, `trial ${row.id} ${key}`);
      });
    });

    test('live simulator point', () => {
      const live = model.live();
      for (const [key, value] of Object.entries(expected.live)) assertClose(live[key], value, `live ${key}`);
    });

    test('decision ranking and scores', () => {
      const ranking = model.scores();
      // Array.from: sandbox arrays have a different Array prototype from this realm.
      assert.deepEqual(Array.from(ranking, r => r.id), expected.ranking.map(r => r.id), 'rank order');
      expected.ranking.forEach((row, n) => {
        row.values.forEach((v, k) => assertClose(ranking[n].values[k], v, `trial ${row.id} score ${k}`));
        if (row.score === null) assert.equal(ranking[n].score, null, `trial ${row.id} weighted`);
        else assertClose(ranking[n].score, row.score, `trial ${row.id} weighted`);
      });
    });
  });
}

test('default inputs unchanged', () => {
  const { defaults } = loadLegacy(APP);
  assert.deepEqual(JSON.parse(JSON.stringify(defaults)), baseline.inputs);
});
