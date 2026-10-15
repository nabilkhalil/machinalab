// MachinaLab machining model: pure functions of the input state, no DOM, no storage.
// Every formula reproduces the reference workbook MMT15603_Virtual_Machinability_Simulator.xlsx
// (cell references below; see docs/excel-formula-map.md). Do not change any expression here
// without the model-change procedure (.claude/skills/model-change): even reordering an
// arithmetic expression can change the last floating-point digit and break the baseline.
(function (root) {
  'use strict';

  // Change requests (INPUTS!E13:E15): A tightens the Ra limit, B enlarges the batch, C shortens tool life by 40 %.
  const effectiveRaLimit = s => s.scenario === 'A' ? .8 : s.raLimit;
  const effectiveBatch = s => s.scenario === 'B' ? 3500 : s.batch;
  const effectiveLife = s => s.scenario === 'C' ? s.life * .6 : s.life;
  const effective = s => ({ raLimit: effectiveRaLimit(s), maxPower: s.maxPower, batch: effectiveBatch(s), life: effectiveLife(s) });

  // Radial depth of cut and mean diameter (INPUTS!E16, E17), in mm.
  const depth = s => (s.initial - s.final) / 2;
  const meanDiameter = s => (s.initial + s.final) / 2;

  // One cutting condition: Vc in m/min, f in mm/rev (9 TRIALS row, SIMULATOR!B8:B18, COST ANALYSIS row).
  function calc(s, v, f) {
    const ap = depth(s);                                   // mm
    const rpm = 1000 * v / (Math.PI * meanDiameter(s));    // rev/min                       9 TRIALS!E
    const mrr = 1000 * v * f * ap;                         // mm³/min                       9 TRIALS!F
    const ra = 1000 * f * f / (32 * s.nose);               // µm, ideal feed-mark roughness 9 TRIALS!G
    const force = s.kc * ap * f;                           // N                             9 TRIALS!H
    const cutPower = force * v / 60000;                    // kW                            9 TRIALS!I
    const inputPower = cutPower / s.eff;                   // kW                            9 TRIALS!J
    const cutTime = 60 * s.length / (f * rpm);             // s                             9 TRIALS!K
    const cycle = cutTime + s.noncut;                      // s                             9 TRIALS!L
    const toolCost = cutTime / 60 / effectiveLife(s) * (s.insert / s.edges); // RM/part    COST ANALYSIS!E
    const cost = cycle / 3600 * s.rate + toolCost;         // RM/part                       9 TRIALS!M
    // Cost per part at fixed tool lives, independent of change request C (COST ANALYSIS!F:H).
    const costAtLife = T => cycle / 3600 * s.rate + cutTime / 60 / T * (s.insert / s.edges);
    const batch = effectiveBatch(s);
    return {
      v, f, ap, rpm, mrr, ra, force, cutPower, inputPower, cutTime, cycle, cost, toolCost,
      batchCost: cost * batch,                             // RM                            COST ANALYSIS!C
      batchHours: cycle * batch / 3600,                    // h                             COST ANALYSIS!D
      costLife15: costAtLife(15), costLife30: costAtLife(30), costLife60: costAtLife(60),
      // 9 TRIALS!N. The 1e-9 tolerance is intentional (docs/MODEL_CHANGELOG.md, E14).
      feasible: ra <= effectiveRaLimit(s) + 1e-9 && inputPower <= s.maxPower + 1e-9,
    };
  }

  // The 3 x 3 factorial design: trial id = speed level × 3 + feed level + 1.
  const trials = s => s.speeds.flatMap((v, i) => s.feeds.map((f, j) => ({ ...calc(s, v, f), id: i * 3 + j + 1 })));
  const live = s => calc(s, s.liveSpeed, s.liveFeed);

  // Decision scores (0-100, higher is better), DECISION MATRIX sheet. Normalised across all nine
  // trials including infeasible ones (J12); weighted total for feasible trials only.
  // Returned sorted by weighted score, infeasible trials last.
  function scores(s) {
    const t = trials(s), min = k => Math.min(...t.map(r => r[k])), max = k => Math.max(...t.map(r => r[k]));
    // Ra: min-max scale, lower is better (B5:B13).
    const raScore = x => max('ra') === min('ra') ? 100 : 100 * (max('ra') - x) / (max('ra') - min('ra'));
    // Productivity: percentage of the highest MRR (C5:C13).
    const mrrScore = x => 100 * x / max('mrr');
    // Power and cost: lowest value as a percentage of this trial's value (D5:D13, E5:E13).
    const lowestAsPercent = (k, x) => 100 * min(k) / x;
    return t.map(r => {
      const values = [raScore(r.ra), mrrScore(r.mrr), lowestAsPercent('inputPower', r.inputPower), lowestAsPercent('cost', r.cost)];
      return { ...r, values, score: r.feasible ? values.reduce((a, v, i) => a + v * s.weights[i] / 100, 0) : null };
    }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }

  const model = { calc, trials, live, scores, effective, effectiveRaLimit, effectiveBatch, effectiveLife, depth, meanDiameter };
  root.MachinaLab = root.MachinaLab || {};
  root.MachinaLab.model = model;
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
})(typeof window !== 'undefined' ? window : globalThis);
