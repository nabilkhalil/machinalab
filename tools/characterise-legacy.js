// Characterise the legacy single-file app.js without modifying it.
// Evaluates the model at default inputs for every scenario and writes a
// regression baseline. This is NOT Excel validation: it records what the
// current code computes.
//
// Usage: node tools/characterise-legacy.js [app.js] [out.json]
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadLegacy } = require('./legacy-loader');

const appPath = process.argv[2] || 'app.js';
const outPath = process.argv[3] || 'tests/fixtures/baseline-v1.json';
const { trials, scores, live, state, defaults } = loadLegacy(appPath);

const keys = ['id', 'v', 'f', 'ap', 'rpm', 'mrr', 'ra', 'force', 'cutPower', 'inputPower',
  'cutTime', 'cycle', 'cost', 'batchCost', 'feasible'];
const pick = r => Object.fromEntries(keys.filter(k => k in r).map(k => [k, r[k]]));

const scenarios = {};
for (const code of ['BASE', 'A', 'B', 'C']) {
  state.scenario = code;
  scenarios[code] = {
    trials: trials().map(pick),
    live: pick(live()),
    ranking: scores().map(r => ({ id: r.id, values: [...r.values], score: r.score })),
  };
}

const baseline = {
  description: 'Regression baseline of legacy app.js at default inputs. Characterisation only; not validated against the Excel workbook.',
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(appPath),
  sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(appPath)).digest('hex'),
  inputs: JSON.parse(JSON.stringify(defaults)),
  scenarios,
};
fs.writeFileSync(outPath, JSON.stringify(baseline, null, 2) + '\n');
console.log(`Wrote ${outPath} (${Object.keys(scenarios).length} scenarios, sha256 ${baseline.sourceSha256.slice(0, 12)}…)`);
