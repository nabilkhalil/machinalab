// Input validation and stored-state sanitising (site/js/params.js, site/js/validate.js).
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const params = require('../../site/js/params.js');
const { validate, sanitise, modelErrors, weightErrors } = require('../../site/js/validate.js');
const { loadLegacy } = require('../../tools/legacy-loader');

const APP = path.join(__dirname, '..', '..', 'site', 'app.js');
const valid = () => sanitise({});
const keysOf = list => list.map(e => e.key);

test('schema defaults equal the app defaults (single source of truth)', () => {
  const { defaults } = loadLegacy(APP);
  assert.deepEqual(valid(), JSON.parse(JSON.stringify(defaults)));
});

test('default state is valid with no warnings', () => {
  assert.deepEqual(validate(valid()), { errors: [], warnings: [] });
});

describe('every numeric parameter: range boundaries and bad types', () => {
  for (const spec of params.numeric) {
    test(spec.key, () => {
      const at = v => keysOf(validate({ ...valid(), [spec.key]: v }).errors);
      // The final/initial cross-rule can fire at the extremes; isolate it with a compatible partner.
      const partner = spec.key === 'final' ? { initial: 501 } : spec.key === 'initial' ? { final: 0.5 } : {};
      const atClean = v => keysOf(validate({ ...valid(), ...partner, [spec.key]: v }).errors).filter(k => k === spec.key);
      assert.deepEqual(atClean(spec.min), [], 'min accepted');
      assert.deepEqual(atClean(spec.max), [], 'max accepted');
      const step = spec.integer ? 1 : Math.max(spec.min, 1e-3) * 1e-3;
      assert.ok(at(spec.min - step).includes(spec.key), 'below min rejected');
      assert.ok(at(spec.max + step * (spec.integer ? 1 : 1e3)).includes(spec.key), 'above max rejected');
      for (const bad of [NaN, null, '', '150', undefined, Infinity]) assert.ok(at(bad).includes(spec.key), `rejects ${String(bad)}`);
      if (spec.integer) assert.ok(at(spec.min + 0.5).includes(spec.key), 'rejects fraction');
    });
  }
});

test('messages are student-readable, name the input and give the unit', () => {
  const { errors } = validate({ ...valid(), liveFeed: 5 });
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /^Feed f must be between 0\.01 mm\/rev and 2 mm\/rev\. /);
  const empty = validate({ ...valid(), kc: null }).errors[0].message;
  assert.equal(empty, 'Enter a number for Specific cutting force kc (N/mm²).');
  for (const e of validate({ ...valid(), eff: 2, edges: 2.5, liveSpeed: -1 }).errors) {
    assert.doesNotMatch(e.message, /NaN|undefined|Infinity/);
  }
});

test('cross-field: final diameter must be smaller than initial', () => {
  const r = validate({ ...valid(), final: 50 });
  assert.deepEqual(keysOf(r.errors), ['final']);
  assert.match(r.errors[0].message, /bar gets thinner/);
});

test('weights: each 0-100 and total exactly 100 (within 1e-6)', () => {
  assert.deepEqual(keysOf(validate({ ...valid(), weights: [30, 25, 15, 25] }).errors), ['weights']);
  assert.match(validate({ ...valid(), weights: [30, 25, 15, 25] }).errors[0].message, /add up to 95 %/);
  assert.deepEqual(validate({ ...valid(), weights: [33.3333333, 33.3333333, 33.3333334, 0] }).errors, []);
  assert.ok(keysOf(validate({ ...valid(), weights: [130, -30, 0, 0] }).errors).includes('weights.0'));
  assert.ok(keysOf(validate({ ...valid(), weights: [30, null, 15, 30] }).errors).includes('weights.1'));
});

test('model errors and weight errors are separated', () => {
  const r = validate({ ...valid(), weights: [10, 10, 10, 10], liveFeed: null });
  assert.deepEqual(keysOf(modelErrors(r)), ['liveFeed']);
  assert.deepEqual(keysOf(weightErrors(r)), ['weights']);
});

test('experiment levels: each validated; unordered or repeated levels give a warning only', () => {
  assert.deepEqual(keysOf(validate({ ...valid(), speeds: [100, 5000, 200] }).errors), ['speeds.1']);
  const r = validate({ ...valid(), feeds: [0.2, 0.1, 0.1] });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(keysOf(r.warnings), ['feeds.0']);
});

test('warning when feed is not smaller than the nose radius (Ra model validity)', () => {
  const r = validate({ ...valid(), nose: 0.4, liveFeed: 0.5, feeds: [0.1, 0.4, 0.6] });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(keysOf(r.warnings), ['liveFeed', 'feeds.1', 'feeds.2']);
});

test('validate never throws, whatever it is given', () => {
  for (const junk of [undefined, null, {}, [], 'x', 42, { speeds: 'a', weights: {} }]) {
    assert.doesNotThrow(() => validate(junk));
    assert.ok(validate(junk).errors.length > 0);
  }
});

describe('sanitise (stored data is untrusted)', () => {
  test('a fully corrupted blob gives the defaults', () => {
    for (const junk of [null, undefined, 'text', 7, [1, 2], { initial: 'x', speeds: 5, scenario: 'Z' }]) {
      assert.deepEqual(sanitise(junk), valid());
    }
  });

  test('invalid fields fall back individually; valid fields are kept', () => {
    const s = sanitise({ liveSpeed: 220, liveFeed: -1, kc: '1800', edges: 2.5, scenario: 'C', student: 'Aina' });
    assert.equal(s.liveSpeed, 220);
    assert.equal(s.liveFeed, 0.15);
    assert.equal(s.kc, 1800); // string "1800" is rejected; default happens to be equal
    assert.equal(s.edges, 4);
    assert.equal(s.scenario, 'C');
    assert.equal(s.student, 'Aina');
  });

  test('markup in numeric fields is never kept', () => {
    const s = sanitise({ liveSpeed: '"><img src=x onerror=alert(1)>', initial: '<script>' });
    assert.equal(s.liveSpeed, 150);
    assert.equal(s.initial, 50);
  });

  test('arrays need the exact length and valid members', () => {
    assert.deepEqual(sanitise({ speeds: [120, 160] }).speeds, [100, 150, 200]);
    assert.deepEqual(sanitise({ feeds: [0.1, '0.2', 0.3] }).feeds, [0.1, 0.15, 0.2]);
    assert.deepEqual(sanitise({ speeds: [120, 160, 240] }).speeds, [120, 160, 240]);
    assert.deepEqual(sanitise({ weights: [40, 20, 20, 20] }).weights, [40, 20, 20, 20]);
    assert.deepEqual(sanitise({ weights: [40, 20, 20] }).weights, [30, 25, 15, 30]);
  });

  test('text fields: strings only, truncated to the maximum length', () => {
    const s = sanitise({ problem: 'x'.repeat(6000), reflection: { evil: true }, group: 12 });
    assert.equal(s.problem.length, params.textMaxLength);
    assert.equal(s.reflection, '');
    assert.equal(s.group, '');
  });

  test('an impossible stored diameter pair resets both diameters', () => {
    const s = sanitise({ initial: 40, final: 45 });
    assert.equal(s.initial, 50);
    assert.equal(s.final, 49);
  });

  test('unknown keys are dropped', () => {
    assert.ok(!('__proto__x' in sanitise({ __proto__x: 1, extra: 'y' })));
    assert.ok(!('extra' in sanitise({ extra: 'y' })));
  });
});

test('app start-up: unreadable or tampered storage falls back safely', () => {
  for (const stored of ['{not json', '"text"', 'null', JSON.stringify({ liveSpeed: '<b>x</b>', feeds: [0.1] })]) {
    const { state, trials } = loadLegacy(APP, stored);
    assert.equal(state.liveSpeed, 150);
    assert.deepEqual(Array.from(state.feeds), [0.1, 0.15, 0.2]);
    assert.equal(trials().length, 9);
  }
});
