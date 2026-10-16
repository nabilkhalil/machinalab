// MachinaLab turning illustration: maps one model result (model.calc) to what the 3D view and
// the turning schematic draw. Pure: no DOM, no Three.js, no storage. Testable under Node.
//
// Two kinds of number leave this file, and the interface must keep them apart:
//  - predictions: copied unchanged from the model result (spindle speed, cutting time, depth of cut).
//    They are never recalculated here, so the picture can never disagree with the tables.
//  - illustration settings: scale factors that make a 0.5 mm cut on a 50 mm bar visible on screen.
//    They are drawing choices, not physics (docs/DEVELOPMENT_PLAN.md, "Synchronisation").
(function (root) {
  'use strict';

  // ---- Drawing constants (illustration only) ---------------------------------------------
  // The spindle is drawn at 1/10 of the predicted speed, so doubling Vc visibly doubles the rotation.
  const ROTATION_SLOWDOWN = 10;
  // Faster than about 4 rev/s, a rotating bar strobes on a 60 Hz screen.
  const MAX_DRAWN_REV_PER_S = 4;
  // Feed per revolution is drawn 50 times larger, so the feed marks can be seen.
  const FEED_DRAWN_SCALE = 50;
  // The tool advances one drawn feed mark per drawn revolution. A pass therefore shows 1/50 of the
  // real revolutions, each 10 times slower: screen time = cutting time × 10/50 = cutting time × 0.2.
  // Changing f or Vc changes the screen time in exactly the same proportion as the cutting time.
  const PASS_TIME_SCALE = ROTATION_SLOWDOWN / FEED_DRAWN_SCALE;
  const MIN_PASS_S = 2;
  const MAX_PASS_S = 45;
  // A finishing cut (ap ≈ 2 % of the radius) would be invisible, so depth is drawn at least 12 %.
  const MIN_DRAWN_DEPTH = 0.12;
  const MAX_DRAWN_DEPTH = 0.85;
  // Bar length in radii, limited so long shafts and thin discs both fit the view.
  const MIN_LENGTH_RADII = 2;
  const MAX_LENGTH_RADII = 8;

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n, d) => Number.isFinite(n) ? Number(n).toLocaleString('en-MY', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const plain = n => Number.isFinite(n) ? Number(n).toLocaleString('en-MY', { maximumFractionDigits: 3 }) : '—';

  // Drawing and motion for one cutting condition. `state` holds the geometry inputs
  // (initial, final, length in mm); `result` is model.calc(state, Vc, f).
  // Drawing units: the initial bar radius is 1.
  function motion(state, result) {
    const radiusMm = state.initial / 2;

    const trueLength = state.length / radiusMm;
    const length = clamp(trueLength, MIN_LENGTH_RADII, MAX_LENGTH_RADII);
    const axialScale = length / state.length;            // drawing units per mm along the bar

    const trueDepth = result.ap / radiusMm;              // depth of cut as a fraction of the radius
    const drawnDepth = clamp(trueDepth, MIN_DRAWN_DEPTH, MAX_DRAWN_DEPTH);

    const scaledRevPerS = result.rpm / 60 / ROTATION_SLOWDOWN;
    const revPerSecond = Math.min(scaledRevPerS, MAX_DRAWN_REV_PER_S);

    const scaledPass = result.cutTime * PASS_TIME_SCALE;
    const passSeconds = clamp(scaledPass, MIN_PASS_S, MAX_PASS_S);

    return {
      // Predictions and inputs, copied unchanged for the readout and the schematic labels.
      prediction: {
        v: result.v, f: result.f, ap: result.ap, rpm: result.rpm, cutTime: result.cutTime,
        ra: result.ra, force: result.force, inputPower: result.inputPower, feasible: result.feasible,
        initial: state.initial, final: state.final, length: state.length,
      },
      // Illustration settings.
      length,
      radiusInitial: 1,
      radiusFinal: 1 - drawnDepth,
      feedPitch: result.f * FEED_DRAWN_SCALE * axialScale, // drawing units the tool moves per drawn revolution
      revPerSecond,
      passSeconds,
      depthScale: drawnDepth / trueDepth,
      flags: {
        rotationCapped: scaledRevPerS > MAX_DRAWN_REV_PER_S,
        passClamped: passSeconds !== scaledPass,
        lengthAdjusted: length !== trueLength,
        depthExaggerated: drawnDepth > trueDepth,
        depthReduced: drawnDepth < trueDepth,
      },
    };
  }

  // Plain-language list of every way the drawing departs from true scale and real time.
  // animated = false for the still schematic, which has no rotation, feed movement or timing.
  function notes(m, animated = true) {
    const p = m.prediction;
    const out = [];
    if (!animated) {
      if (m.flags.depthExaggerated) out.push(`The depth of cut is drawn ${num(m.depthScale, 0)} times deeper than true scale.`);
      if (m.flags.depthReduced) out.push('The depth of cut is drawn shallower than true scale so that the finished bar stays visible.');
      if (m.flags.lengthAdjusted) out.push('The bar length is drawn out of proportion to its diameter so that it fits the view.');
      out.push('The tool is shown half way along the cut, moving towards the chuck.');
      return out;
    }
    out.push(m.flags.rotationCapped
      ? `The spindle is drawn at ${MAX_DRAWN_REV_PER_S} rev/s, the fastest rate the screen can show clearly. That is slower than 1/10 of the predicted speed.`
      : 'The spindle is drawn at 1/10 of the predicted spindle speed.');
    out.push('Feed per revolution is drawn 50 times larger so that each feed mark can be seen.');
    out.push(m.flags.passClamped
      ? `One pass is shown in ${num(m.passSeconds, 0)} s. The screen time is limited to ${MIN_PASS_S}–${MAX_PASS_S} s, so it is not in proportion to the predicted cutting time of ${num(p.cutTime, 1)} s.`
      : `One pass is shown in ${num(m.passSeconds, 1)} s, one fifth of the predicted cutting time of ${num(p.cutTime, 1)} s.`);
    if (m.flags.depthExaggerated) out.push(`The depth of cut is drawn ${num(m.depthScale, 0)} times deeper than true scale.`);
    if (m.flags.depthReduced) out.push('The depth of cut is drawn shallower than true scale so that the finished bar stays visible.');
    if (m.flags.lengthAdjusted) out.push('The bar length is drawn out of proportion to its diameter so that it fits the view.');
    return out;
  }

  // Direction arrows in the 3D view. Colours pass 4.5:1 on white (they double as label text colours).
  // `short` is the label on the arrow; `text` is the legend sentence under the view. Values are
  // model predictions or inputs; only the directions are drawn, not the magnitudes.
  const ARROW_COLOURS = { vc: '#2667a0', feed: '#7b4fae', ap: '#0b7f8c', fc: '#a3352a' };
  function directions(m) {
    const p = m.prediction;
    return [
      { key: 'vc', colour: ARROW_COLOURS.vc, name: 'Cutting speed, Vc', short: `Vc ${plain(p.v)} m/min`,
        text: `The bar surface moves down past the tool tip at ${plain(p.v)} m/min (tangent to the bar).` },
      { key: 'feed', colour: ARROW_COLOURS.feed, name: 'Feed, f', short: `f ${plain(p.f)} mm/rev`,
        text: `The tool moves along the bar towards the chuck by ${plain(p.f)} mm each revolution.` },
      { key: 'ap', colour: ARROW_COLOURS.ap, name: 'Depth of cut, ap', short: `ap ${plain(p.ap)} mm`,
        text: `The layer removed, measured radially from the finished to the original surface: ${plain(p.ap)} mm.` },
      { key: 'fc', colour: ARROW_COLOURS.fc, name: 'Cutting force, Fc', short: `Fc ${num(p.force, 0)} N`,
        text: `The main cutting force pushes the tool down, in the direction of Vc: ${num(p.force, 1)} N (Fc = kc × ap × f).` },
    ];
  }

  // One-sentence text alternative for the 3D view and the schematic.
  function describe(m) {
    const p = m.prediction;
    return `Illustration: a steel bar is turned from ${plain(p.initial)} mm to ${plain(p.final)} mm diameter over ${plain(p.length)} mm. ` +
      `The tool feeds from the tailstock end towards the chuck at ${plain(p.f)} mm per revolution, removing a ${plain(p.ap)} mm depth of cut.`;
  }

  // Labelled side view of the cut, half way through the pass. Same exaggeration as the 3D view.
  // Pure SVG string; colours as attributes (the CSP blocks style attributes).
  function schematicSvg(m, id = 'ts') {
    const p = m.prediction;
    // Layout, top to bottom: tool and feed arrow, bar, depth-of-cut label, speeds, scale note.
    const W = 640, H = 330, cy = 170;
    const R = Math.min(78, 430 / m.length);               // initial radius in px
    const rf = R * m.radiusFinal;                         // finished radius in px
    const x0 = 90, x1 = x0 + m.length * R;                // chuck face, tailstock end
    const xt = x0 + (x1 - x0) * 0.45;                     // tool position: cut from the tailstock end
    const tipY = cy - rf;
    const ink = '#183447', muted = '#526a7a', steel = '#9fb1bd', cut = '#cfdbe3', tool = '#c2611c', dim = '#2667a0';
    const t = (x, y, text, o = '') => `<text x="${x}" y="${y}" font-size="14" fill="${ink}" ${o}>${esc(text)}</text>`;
    const arrow = `${id}-arrow`;
    return `<svg class="chart turning-schematic" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t ${id}-d" xmlns="http://www.w3.org/2000/svg">` +
      `<title id="${id}-t">Turning schematic (side view)</title><desc id="${id}-d">${esc(describe(m))}</desc>` +
      `<defs><marker id="${arrow}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${dim}"/></marker></defs>` +
      // Chuck and jaws.
      `<rect x="${x0 - 46}" y="${cy - R - 26}" width="40" height="${2 * R + 52}" rx="4" fill="#5d7180"/>` +
      `<rect x="${x0 - 8}" y="${cy - R - 10}" width="12" height="16" fill="#3f505c"/><rect x="${x0 - 8}" y="${cy + R - 6}" width="12" height="16" fill="#3f505c"/>` +
      // Uncut stock (chuck side) and finished diameter (tailstock side).
      `<rect x="${x0}" y="${cy - R}" width="${xt - x0}" height="${2 * R}" fill="${steel}" stroke="${ink}" stroke-width="1"/>` +
      `<rect x="${xt}" y="${cy - rf}" width="${x1 - xt}" height="${2 * rf}" fill="${cut}" stroke="${ink}" stroke-width="1"/>` +
      // Removed layer outline.
      `<rect x="${xt}" y="${cy - R}" width="${x1 - xt}" height="${R - rf}" fill="none" stroke="${muted}" stroke-dasharray="4 3"/>` +
      `<rect x="${xt}" y="${cy + rf}" width="${x1 - xt}" height="${R - rf}" fill="none" stroke="${muted}" stroke-dasharray="4 3"/>` +
      // Centre line.
      `<line x1="${x0 - 60}" y1="${cy}" x2="${x1 + 30}" y2="${cy}" stroke="${muted}" stroke-dasharray="14 4 3 4"/>` +
      // Tool: insert tip on the finished radius, shank going up.
      `<path d="M${xt} ${tipY} L${xt + 26} ${tipY - 30} L${xt + 6} ${tipY - 30} z" fill="${tool}" stroke="${ink}"/>` +
      `<rect x="${xt + 6}" y="${tipY - 64}" width="22" height="34" fill="#6b7a86" stroke="${ink}"/>` +
      // Feed arrow (towards the chuck).
      `<line x1="${xt + 80}" y1="${tipY - 48}" x2="${xt + 38}" y2="${tipY - 48}" stroke="${dim}" stroke-width="2" marker-end="url(#${arrow})"/>` +
      t(xt + 86, tipY - 43, `f = ${plain(p.f)} mm/rev (feed)`) +
      // Diameter dimensions, labelled above the centre line.
      `<line x1="${x0 + 24}" y1="${cy - R}" x2="${x0 + 24}" y2="${cy + R}" stroke="${dim}" stroke-width="1.5" marker-start="url(#${arrow})" marker-end="url(#${arrow})"/>` +
      t(x0 + 32, cy - 12, `Di = ${plain(p.initial)} mm`) +
      `<line x1="${x1 - 24}" y1="${cy - rf}" x2="${x1 - 24}" y2="${cy + rf}" stroke="${dim}" stroke-width="1.5" marker-start="url(#${arrow})" marker-end="url(#${arrow})"/>` +
      t(x1 - 32, cy - 12, `Df = ${plain(p.final)} mm`, 'text-anchor="end"') +
      // Depth of cut callout, under the removed layer.
      t(x1, cy + R + 24, `ap = ${plain(p.ap)} mm (depth of cut)`, 'text-anchor="end"') +
      // Rotation, cutting speed and spindle speed.
      `<path d="M${x1 + 14} ${cy - R * 0.7} A ${R * 0.35} ${R * 0.75} 0 0 1 ${x1 + 14} ${cy + R * 0.7}" fill="none" stroke="${dim}" stroke-width="2" marker-end="url(#${arrow})"/>` +
      t(x0 - 46, H - 32, `Vc = ${plain(p.v)} m/min (cutting speed) · N = ${num(p.rpm, 0)} rev/min (spindle speed)`) +
      t(x0 - 46, H - 10, m.flags.depthExaggerated ? `Not to scale: depth of cut drawn × ${num(m.depthScale, 0)}.` : 'Not to scale.', `font-size="12" fill="${muted}"`) +
      `</svg>`;
  }

  const turning = {
    motion, notes, describe, schematicSvg, directions, ARROW_COLOURS,
    constants: { ROTATION_SLOWDOWN, MAX_DRAWN_REV_PER_S, FEED_DRAWN_SCALE, PASS_TIME_SCALE, MIN_PASS_S, MAX_PASS_S, MIN_DRAWN_DEPTH, MAX_DRAWN_DEPTH, MIN_LENGTH_RADII, MAX_LENGTH_RADII },
  };
  root.MachinaLab = root.MachinaLab || {};
  root.MachinaLab.turning = turning;
  if (typeof module !== 'undefined' && module.exports) module.exports = turning;
})(typeof window !== 'undefined' ? window : globalThis);
