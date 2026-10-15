// Chart builders (site/js/charts.js): axis scales and the accessibility/accuracy rules
// of the visualisation skill.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const charts = require('../../site/js/charts.js');
const model = require('../../site/js/model.js');
const { sanitise } = require('../../site/js/validate.js');

describe('niceScale: axis from 0 to a round maximum chosen from the data', () => {
  const cases = [
    // [raw max, expected axis max, expected ticks]
    [1.5625, 2, [0, 0.5, 1, 1.5, 2]],          // Ra at defaults
    [1.6, 2, [0, 0.5, 1, 1.5, 2]],             // Ra with the 1.6 µm limit included
    [0.70588, 0.8, [0, 0.2, 0.4, 0.6, 0.8]],   // input power: no longer flattened against 1.0
    [20, 20, [0, 5, 10, 15, 20]],              // MRR in cm³/min
    [93.3, 100, [0, 25, 50, 75, 100]],         // cutting time
    [2.5087, 3, [0, 1, 2, 3]],                 // cost
    [0.0123, 0.015, [0, 0.005, 0.01, 0.015]],  // values below 1
    [5, 6, [0, 2, 4, 6]],                      // a single value
  ];
  for (const [raw, max, ticks] of cases) {
    test(`max ${raw} → axis ${max}`, () => {
      const s = charts.niceScale(raw);
      assert.equal(s.max, max);
      assert.deepEqual(s.ticks, ticks);
      assert.ok(s.max >= raw);
    });
  }
  test('all zeros, negative or non-numeric data still gives a usable axis', () => {
    for (const raw of [0, -3, NaN, Infinity, undefined]) {
      const s = charts.niceScale(raw);
      assert.equal(s.ticks[0], 0);
      assert.ok(s.max > 0 && s.ticks.length >= 2);
    }
  });
  test('ticks are round numbers (1, 2, 2.5 or 5 × 10ⁿ steps) with matching decimals', () => {
    for (let raw = 0.001; raw < 1e5; raw *= 1.37) {
      const s = charts.niceScale(raw);
      const mantissa = s.step / 10 ** Math.floor(Math.log10(s.step));
      assert.ok([1, 2, 2.5, 5].some(m => Math.abs(m - mantissa) < 1e-9), `step ${s.step}`);
      assert.ok(s.ticks.length >= 3 && s.ticks.length <= 6, `${s.ticks.length} ticks for ${raw}`);
      for (const t of s.ticks) assert.equal(Number(t.toFixed(s.decimals)), t);
    }
  });
});

const state = sanitise({});
const trials = model.trials(state);
const bars = trials.map(r => ({ id: r.id, value: r.ra, feasible: r.feasible, v: r.v, f: r.f }));
const svgOf = html => html.slice(html.indexOf('<svg'), html.indexOf('</svg>') + 6);

describe('bar chart', () => {
  const html = charts.barChart({ id: 'x-ra', title: 'Ideal surface roughness', unit: 'µm', yTitle: 'Ideal surface roughness (µm)',
    xTitle: 'Trial', color: '#0b7f8c', decimals: 3, limit: { value: 0.8, label: 'Ra limit 0.80 µm' },
    bars: trials.map(r => ({ id: r.id, value: r.ra, feasible: r.ra <= 0.8, v: r.v, f: r.f })) });

  test('accessible: role img labelled by its title and a data-derived description', () => {
    assert.match(html, /<svg class="chart"[^>]*role="img" aria-labelledby="x-ra-t x-ra-d"/);
    assert.match(html, /<title id="x-ra-t">Ideal surface roughness<\/title>/);
    assert.match(html, /<desc id="x-ra-d">Bar chart of the nine trials\. Lowest 0\.391 µm \(trial 1, 4, 7\), highest 1\.563 µm \(trial 3, 6, 9\)\. Dashed line: Ra limit 0\.80 µm\. Not feasible: trial 2, 3, 5, 6, 8, 9\.<\/desc>/);
  });
  test('axis title with unit, limit line drawn and labelled, 9 bars', () => {
    assert.match(html, />Ideal surface roughness \(µm\)</);
    assert.match(html, /stroke-dasharray="8 4"\/><text[^>]*>Ra limit 0\.80 µm</);
    assert.equal((svgOf(html).match(/<rect /g) || []).length, 9);
  });
  test('infeasible bars are marked by outline and fill, not colour alone', () => {
    assert.equal((html.match(/stroke-dasharray="4 3"/g) || []).length, 6);
    assert.match(html, /Pale bars with a dashed outline are not feasible\./);
  });
  test('has a data table alternative with every value', () => {
    assert.match(html, /<details class="data-table"><summary>Show data table<\/summary>/);
    for (const r of trials) assert.ok(html.includes(`<td>${r.ra.toFixed(3)}</td>`), `trial ${r.id}`);
  });
  test('a far-away limit is described instead of flattening the data', () => {
    const p = charts.barChart({ id: 'p', title: 'Machine input power', unit: 'kW', yTitle: 'P (kW)', xTitle: 'Trial', color: '#a8691f', decimals: 3,
      limit: { value: 7.5, label: 'Power limit 7.50 kW' }, bars: trials.map(r => ({ id: r.id, value: r.inputPower, feasible: true, v: r.v, f: r.f })) });
    assert.match(p, />0\.8<\/text>/);                 // axis top 0.8, not 7.5 or 1.0
    assert.doesNotMatch(p, /stroke-dasharray="8 4"/); // no limit line
    assert.match(p, /Power limit 7\.50 kW is far above every value shown \(highest 0\.706 kW, 9 % of the limit\), so it is not drawn\./);
  });
  test('text is escaped', () => {
    const evil = charts.barChart({ id: 'e', title: '<img src=x onerror=alert(1)>', unit: '"u"', yTitle: '<b>', xTitle: '&', color: '#000', decimals: 1, limit: null, bars });
    assert.doesNotMatch(evil, /<img|<b>/);
    assert.match(evil, /&lt;img src=x onerror=alert\(1\)&gt;/);
  });
});

describe('response plot', () => {
  const series = key => state.speeds.map((v, i) => ({ name: `Vc ${v} m/min`, points: state.feeds.map((f, j) => ({ x: f, y: trials[i * 3 + j][key] })) }));
  test('Ra: the three speed lines coincide and the description says speed has no effect', () => {
    const html = charts.lineChart({ id: 'r', title: 'Ideal surface roughness', unit: 'µm', yTitle: 'Ra (µm)', xTitle: 'Feed f (mm/rev)', decimals: 3, limit: null, series: series('ra') });
    assert.match(html, /All 3 cutting-speed lines lie on top of each other: in this model cutting speed has no effect\. It rises from 0\.391 to 1\.563 µm as feed increases\./);
    assert.equal((html.match(/<polyline /g) || []).length, 3);
  });
  test('MRR: lines differ; series distinguished by dash pattern and marker shape, with a legend', () => {
    const html = charts.lineChart({ id: 'm', title: 'Material removal rate', unit: 'mm³/min', yTitle: 'MRR', xTitle: 'Feed f (mm/rev)', decimals: 0, limit: null, series: series('mrr') });
    assert.match(html, /one line per cutting speed\. At the lowest speed it goes from 5,000 to 10,000 mm³\/min; at the highest speed from 10,000 to 20,000 mm³\/min\./);
    assert.match(html, /stroke-dasharray="7 4"/);
    assert.match(html, /stroke-dasharray="2 3"/);
    assert.ok(html.includes('<rect x=') && html.includes('<path d="M') && html.includes('<circle cx='), 'three marker shapes');
    for (const v of state.speeds) assert.ok(html.includes(`>Vc ${v} m/min</text>`), `legend ${v}`);
  });
});

describe('feasibility map', () => {
  const build = s => charts.feasibilityMap({ id: 'map', title: 'Feasibility map', xMax: 230, yMax: 0.26,
    isFeasible: (v, f) => { const r = model.calc(s, v, f), m = model.limitsMet(s, r); return { feasible: r.feasible, raOk: m.ra, powerOk: m.power }; },
    trials: model.trials(s), live: model.live(s), raLimit: model.effectiveRaLimit(s), maxPower: s.maxPower });
  test('BASE: all trials feasible, only roughness binds', () => {
    const html = build(state);
    assert.match(html, /9 of 9 trials and the live point lie in the feasible region\. Only the roughness limit \(Ra ≤ 1\.60 µm\)/);
    assert.match(html, /the 7\.50 kW power limit is not reached/);
  });
  test('scenario A: 3 trials feasible, live point outside', () => {
    const html = build({ ...state, scenario: 'A' });
    assert.match(html, /3 of 9 trials lie in the feasible region; the live point does not\./);
  });
  test('a low power limit makes power bind too', () => {
    const html = build({ ...state, maxPower: 0.3 });
    assert.match(html, /Both limits restrict the region/);
  });
});
