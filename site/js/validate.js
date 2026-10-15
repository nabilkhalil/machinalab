// MachinaLab input validation and stored-state sanitising. Pure functions, no DOM.
//   validate(state)  -> { errors: [{key, message}], warnings: [{key, message}] }  (never throws)
//   sanitise(raw)    -> a complete, safe state object; invalid stored fields fall back to defaults
(function (root) {
  'use strict';
  const params = (root.MachinaLab && root.MachinaLab.params) || require('./params.js');

  const num = n => Number(n).toLocaleString('en-MY', { maximumFractionDigits: 6 });
  const withUnit = (value, unit) => unit ? `${num(value)} ${unit}` : num(value);
  const isNumber = v => typeof v === 'number' && Number.isFinite(v);

  // Message for one numeric value against its range, or '' if it is acceptable.
  function rangeMessage(value, spec, label) {
    const unit = spec.unit ? ` (${spec.unit})` : '';
    if (!isNumber(value)) return `Enter a number for ${label}${unit}.`;
    if (value < spec.min || value > spec.max) {
      return `${label} must be between ${withUnit(spec.min, spec.unit)} and ${withUnit(spec.max, spec.unit)}. ${spec.reason}`;
    }
    if (spec.integer && !Number.isInteger(value)) return `${label} must be a whole number.`;
    return '';
  }

  function validate(state) {
    const errors = [];
    const warnings = [];
    const s = state || {};
    const add = (list, key, message) => { if (message) list.push({ key, message }); };

    for (const spec of params.numeric) add(errors, spec.key, rangeMessage(s[spec.key], spec, spec.label));

    for (const [key, spec] of Object.entries(params.levels)) {
      const values = Array.isArray(s[key]) ? s[key] : [];
      for (let i = 0; i < 3; i++) add(errors, `${key}.${i}`, rangeMessage(values[i], spec, `${spec.label} ${i + 1}`));
      const valid = values.length === 3 && values.every(isNumber);
      if (valid && !(values[0] < values[1] && values[1] < values[2])) {
        add(warnings, `${key}.0`, `${spec.label}s are usually all different and listed from lowest to highest.`);
      }
    }

    // Cross-field: the bar must get thinner.
    if (isNumber(s.initial) && isNumber(s.final) && s.final >= s.initial) {
      add(errors, 'final', 'Final diameter must be smaller than initial diameter. Turning removes material, so the bar gets thinner.');
    }

    if (!params.scenarios.includes(s.scenario)) add(errors, 'scenario', 'Choose a change request: BASE, A, B or C.');

    const w = Array.isArray(s.weights) ? s.weights : [];
    params.weights.labels.forEach((label, i) => {
      add(errors, `weights.${i}`, rangeMessage(w[i], { ...params.weights, unit: '%', reason: 'Each weight is a percentage.' }, `${label} weight`));
    });
    if (w.length === 4 && w.every(isNumber)) {
      const total = w.reduce((a, b) => a + b, 0);
      if (Math.abs(total - 100) > 1e-6) add(errors, 'weights', `Decision weights add up to ${num(total)} %. They must total 100 %.`);
    }

    // Model validity: the ideal-roughness formula assumes feed is smaller than the nose radius.
    if (isNumber(s.nose)) {
      const feeds = [['liveFeed', s.liveFeed], ...(Array.isArray(s.feeds) ? s.feeds.map((f, i) => [`feeds.${i}`, f]) : [])];
      for (const [key, f] of feeds) {
        if (isNumber(f) && f >= s.nose) {
          add(warnings, key, `Feed ${num(f)} mm/rev is not smaller than the nose radius (${num(s.nose)} mm). The theoretical Ra formula is not reliable here.`);
        }
      }
    }
    return { errors, warnings };
  }

  // True when the machining model can be evaluated (decision weights are checked separately).
  const modelErrors = result => result.errors.filter(e => !e.key.startsWith('weights'));
  const weightErrors = result => result.errors.filter(e => e.key.startsWith('weights'));

  // Build a safe state from untrusted stored data. Each field is accepted only if it has the right
  // type and passes its own range check; otherwise that field alone falls back to its default.
  function sanitise(raw) {
    const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const state = {};
    for (const spec of params.numeric) {
      state[spec.key] = rangeMessage(input[spec.key], spec, spec.label) === '' ? input[spec.key] : spec.def;
    }
    for (const [key, spec] of Object.entries(params.levels)) {
      const v = input[key];
      const ok = Array.isArray(v) && v.length === 3 && v.every(x => rangeMessage(x, spec, '') === '');
      state[key] = ok ? [...v] : [...spec.def];
    }
    const w = input.weights;
    const weightsOk = Array.isArray(w) && w.length === 4 && w.every(x => isNumber(x) && x >= 0 && x <= 100);
    state.weights = weightsOk ? [...w] : [...params.weights.def];
    state.scenario = params.scenarios.includes(input.scenario) ? input.scenario : 'BASE';
    for (const key of params.textKeys) {
      state[key] = typeof input[key] === 'string' ? input[key].slice(0, params.textMaxLength) : '';
    }
    // Cross-field rule on load: an impossible diameter pair resets both to defaults.
    if (state.final >= state.initial) {
      state.initial = params.byKey.initial.def;
      state.final = params.byKey.final.def;
    }
    return state;
  }

  const api = { validate, sanitise, modelErrors, weightErrors };
  root.MachinaLab = root.MachinaLab || {};
  Object.assign(root.MachinaLab, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
