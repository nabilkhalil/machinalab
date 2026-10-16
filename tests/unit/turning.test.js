// Turning illustration mapping (site/js/turning.js) and the vendored Three.js file.
// The 3D view must never disagree with the model: predictions are passed through unchanged,
// and the drawing scales are constant, so comparisons between cutting conditions stay honest.
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const turning = require('../../site/js/turning.js');
const model = require('../../site/js/model.js');
const params = require('../../site/js/params.js');
const { sanitise } = require('../../site/js/validate.js');

const defaults = () => sanitise({});
const motionAt = (overrides = {}) => {
  const s = { ...defaults(), ...overrides };
  return { s, r: model.live(s), m: turning.motion(s, model.live(s)) };
};
const C = turning.constants;

describe('predictions pass through unchanged', () => {
  test('every prediction equals the model result exactly (defaults)', () => {
    const { s, r, m } = motionAt();
    for (const k of ['v', 'f', 'ap', 'rpm', 'cutTime', 'ra', 'inputPower', 'feasible']) assert.equal(m.prediction[k], r[k], k);
    assert.equal(m.prediction.initial, s.initial);
    assert.equal(m.prediction.final, s.final);
    assert.equal(m.prediction.length, s.length);
  });
  test('defaults match the workbook baseline used by the smoke tests (Ra 0.879 µm)', () => {
    const { m } = motionAt();
    assert.equal(m.prediction.ra.toFixed(3), '0.879');
  });
});

describe('drawing scales at the defaults (Ø50 → Ø49 mm, L 100 mm, Vc 150, f 0.15)', () => {
  const { r, m } = motionAt();
  test('spindle drawn at 1/10 of N', () => assert.ok(Math.abs(m.revPerSecond - r.rpm / 600) < 1e-12));
  test('one pass takes 0.2 × the cutting time', () => assert.ok(Math.abs(m.passSeconds - 0.2 * r.cutTime) < 1e-12));
  test('bar length is 4 radii (true proportion, 100 mm / 25 mm)', () => {
    assert.equal(m.length, 4);
    assert.equal(m.flags.lengthAdjusted, false);
  });
  test('feed mark spacing is f × 50 in drawing units (0.15 × 50 / 25 = 0.3)', () => assert.ok(Math.abs(m.feedPitch - 0.3) < 1e-12));
  test('0.5 mm depth (2 % of radius) is drawn at 12 %, i.e. × 6', () => {
    assert.ok(Math.abs(m.radiusFinal - 0.88) < 1e-12);
    assert.ok(Math.abs(m.depthScale - 6) < 1e-9);
    assert.equal(m.flags.depthExaggerated, true);
  });
  test('the tool advances one drawn feed mark per drawn revolution', () => {
    const travelPerSecond = m.length / m.passSeconds;
    assert.ok(Math.abs(travelPerSecond - m.revPerSecond * m.feedPitch) < 1e-9);
  });
});

describe('synchronisation: the picture responds in proportion to the inputs', () => {
  const base = motionAt().m;
  test('doubling the feed halves the pass time and doubles the mark spacing', () => {
    const m = motionAt({ liveFeed: 0.3 }).m;
    assert.ok(Math.abs(m.passSeconds - base.passSeconds / 2) < 1e-9);
    assert.ok(Math.abs(m.feedPitch - base.feedPitch * 2) < 1e-12);
    assert.equal(m.revPerSecond, base.revPerSecond);
  });
  test('doubling the cutting speed doubles the rotation and halves the pass time', () => {
    const m = motionAt({ liveSpeed: 300 }).m;
    assert.ok(Math.abs(m.revPerSecond - base.revPerSecond * 2) < 1e-9);
    assert.ok(Math.abs(m.passSeconds - base.passSeconds / 2) < 1e-9);
  });
  test('a deeper cut (smaller final diameter) is drawn deeper', () => {
    const m = motionAt({ final: 40 }).m;  // ap 5 mm = 20 % of the radius: true scale
    assert.ok(Math.abs(m.radiusFinal - 0.8) < 1e-12);
    assert.equal(m.flags.depthExaggerated, false);
  });
});

describe('limits keep the picture readable, and say so', () => {
  test('rotation is capped to avoid strobing', () => {
    const { m } = motionAt({ initial: 10, final: 9, liveSpeed: 1000 });
    assert.equal(m.revPerSecond, C.MAX_DRAWN_REV_PER_S);
    assert.equal(m.flags.rotationCapped, true);
    assert.match(turning.notes(m)[0], /fastest rate/);
  });
  test('very long and very short passes are clamped', () => {
    const slow = motionAt({ initial: 500, final: 499, length: 2000, liveSpeed: 10, liveFeed: 0.01 }).m;
    assert.equal(slow.passSeconds, C.MAX_PASS_S);
    assert.equal(slow.flags.passClamped, true);
    const fast = motionAt({ initial: 10, final: 9, length: 1, liveSpeed: 1000, liveFeed: 2 }).m;
    assert.equal(fast.passSeconds, C.MIN_PASS_S);
    assert.ok(turning.notes(fast).some(n => /limited to/.test(n)));
  });
  test('extreme bar proportions are limited and flagged', () => {
    assert.equal(motionAt({ length: 2000 }).m.length, C.MAX_LENGTH_RADII);
    const disc = motionAt({ length: 10 }).m;
    assert.equal(disc.length, C.MIN_LENGTH_RADII);
    assert.ok(turning.notes(disc).some(n => /out of proportion/.test(n)));
  });
  test('a very deep cut is drawn shallower and flagged', () => {
    const { m } = motionAt({ initial: 50, final: 1 });
    assert.equal(m.radiusFinal, 1 - C.MAX_DRAWN_DEPTH);
    assert.equal(m.flags.depthReduced, true);
  });
});

describe('direction arrows (labels and legend)', () => {
  const { r, m } = motionAt();
  const d = Object.fromEntries(turning.directions(m).map(x => [x.key, x]));
  test('cutting force passes through from the model (Fc = kc·ap·f = 135 N at defaults)', () => {
    assert.equal(m.prediction.force, r.force);
    assert.ok(Math.abs(r.force - 135) < 1e-9);
  });
  test('one arrow each for Vc, f, ap and Fc, labelled with units', () => {
    assert.deepEqual(Object.keys(d), ['vc', 'feed', 'ap', 'fc']);
    assert.equal(d.vc.short, 'Vc 150 m/min');
    assert.equal(d.feed.short, 'f 0.15 mm/rev');
    assert.equal(d.ap.short, 'ap 0.5 mm');
    assert.equal(d.fc.short, 'Fc 135 N');
  });
  test('legend sentences state the physical direction', () => {
    assert.match(d.vc.text, /moves down past the tool tip/);
    assert.match(d.feed.text, /towards the chuck/);
    assert.match(d.ap.text, /measured radially/);
    assert.match(d.fc.text, /pushes the tool down, in the direction of Vc: 135\.0 N/);
  });
  test('arrow colours reach 4.5:1 on white (they are also label text colours)', () => {
    const lum = hex => {
      const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    for (const [k, hex] of Object.entries(turning.ARROW_COLOURS)) assert.ok(1.05 / (lum(hex) + 0.05) >= 4.5, `${k} ${hex}`);
  });
});

describe('notes and text alternatives', () => {
  const { m } = motionAt();
  test('animated notes state every scale factor in plain words', () => {
    const text = turning.notes(m).join(' ');
    assert.match(text, /1\/10 of the predicted spindle speed/);
    assert.match(text, /50 times larger/);
    assert.match(text, /one fifth of the predicted cutting time of 41\.5 s/);
    assert.match(text, /6 times deeper/);
  });
  test('still-picture notes leave out rotation and timing', () => {
    const text = turning.notes(m, false).join(' ');
    assert.doesNotMatch(text, /spindle|pass is shown/);
    assert.match(text, /6 times deeper/);
  });
  test('describe() names the geometry and the feed direction', () => {
    assert.match(turning.describe(m), /from 50 mm to 49 mm diameter over 100 mm/);
    assert.match(turning.describe(m), /towards the chuck at 0\.15 mm per revolution/);
  });
  test('schematic is an accessible SVG with labelled values', () => {
    const svg = turning.schematicSvg(m, 'x');
    assert.match(svg, /^<svg[^>]+role="img"[^>]+aria-labelledby="x-t x-d"/);
    assert.match(svg, /<title id="x-t">/);
    for (const label of ['Di = 50 mm', 'Df = 49 mm', 'ap = 0.5 mm', 'f = 0.15 mm/rev', 'Vc = 150 m/min', 'N = 965 rev/min', 'drawn × 6']) {
      assert.ok(svg.includes(label), label);
    }
    assert.doesNotMatch(svg, /style=/, 'the CSP blocks style attributes');
  });
});

test('no NaN or Infinity anywhere across random valid inputs', () => {
  const pick = p => p.min + Math.random() * (p.max - p.min);
  for (let i = 0; i < 500; i++) {
    const s = defaults();
    for (const key of ['initial', 'length', 'liveSpeed', 'liveFeed', 'nose']) s[key] = pick(params.byKey[key]);
    s.final = params.byKey.final.min + Math.random() * (s.initial - params.byKey.final.min);
    if (!(s.final < s.initial)) continue;
    const m = turning.motion(s, model.live(s));
    for (const [k, v] of Object.entries(m)) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} = ${v}`);
    const text = turning.notes(m).join(' ') + turning.describe(m) + turning.schematicSvg(m);
    assert.doesNotMatch(text, /NaN|Infinity/);
  }
});

test('vendored Three.js is the reviewed r159 build (docs/decisions/0001)', () => {
  const file = fs.readFileSync(path.join(__dirname, '../../site/js/vendor/three.min.js'));
  const hash = crypto.createHash('sha256').update(file).digest('hex');
  assert.equal(hash, '7b1c5d75b28d9de15042e2b374f83566d8c7146697af8fdeb4558b0fb528a585');
  assert.ok(fs.existsSync(path.join(__dirname, '../../site/js/vendor/three.LICENSE.txt')));
});
