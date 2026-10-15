// CSV results export and JSON progress files (site/js/export.js).
'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const ex = require('../../site/js/export.js');
const { sanitise } = require('../../site/js/validate.js');
const { loadLegacy } = require('../../tools/legacy-loader');

const APP = path.join(__dirname, '..', '..', 'site', 'app.js');
const WHEN = new Date(2026, 9, 15, 14, 32, 5);
const PROMPTS = [['problem', 'Problem statement'], ['recommendation', 'Recommended trial and reasons']];

// Minimal RFC 4180 parser so tests read the CSV the way a spreadsheet would.
function parseCsv(text) {
  assert.equal(text.charCodeAt(0), 0xfeff, 'starts with a UTF-8 BOM');
  const rows = [];
  let row = [], cellText = '', quoted = false;
  const body = text.slice(1);
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') { cellText += '"'; i++; }
      else if (c === '"') quoted = false;
      else cellText += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cellText); cellText = ''; }
    else if (c === '\r' && body[i + 1] === '\n') { row.push(cellText); rows.push(row); row = []; cellText = ''; i++; }
    else cellText += c;
  }
  return rows;
}

// Build a CSV exactly as the app does, from the real model.
function appCsv(stateChanges = {}, { weightsValid = true, modelValid = true } = {}) {
  const app = loadLegacy(APP);
  Object.assign(app.state, stateChanges);
  const results = modelValid ? { trials: app.trials(), live: app.live(), ranking: weightsValid ? app.scores() : null } : null;
  return ex.buildCsv({
    state: app.state, effective: { raLimit: 1.6, maxPower: 7.5, batch: 2000, life: 30 }, results,
    problems: modelValid ? [] : ['Drive efficiency must be between 0.1 and 1.'], prompts: PROMPTS,
    appVersion: '1.1.0', exportedAt: WHEN,
  });
}
const rowsByFirst = rows => new Map(rows.filter(r => r.length).map(r => [r[0], r]));

describe('formula-injection protection', () => {
  for (const evil of ['=1+1', '@SUM(A1)', '-2+3', '+1', '\t=1', '\r=1', '=HYPERLINK("http://x","y")']) {
    test(`neutralises ${JSON.stringify(evil)}`, () => {
      assert.equal(ex.neutralise(evil), `'${evil}`);
      const rows = parseCsv(appCsv({ problem: evil, student: evil, group: evil }));
      const map = rowsByFirst(rows);
      assert.equal(map.get('Problem statement')[1], `'${evil}`);
      assert.equal(map.get('Student')[1], `'${evil}`);
      assert.equal(map.get('Group / members')[1], `'${evil}`);
    });
  }
  test('ordinary text and numbers are untouched', () => {
    assert.equal(ex.neutralise('Trial 7 is best'), 'Trial 7 is best');
    assert.equal(ex.neutralise('a=b'), 'a=b');
  });
  test('no text cell in a hostile export starts with a formula trigger', () => {
    const rows = parseCsv(appCsv({ problem: '=cmd|"/c calc"!A1', recommendation: '@x', student: '-y' }));
    const textCells = rows.flat().filter(c => c !== '' && Number.isNaN(Number(c)));
    for (const c of textCells) assert.doesNotMatch(c, /^[=+\-@\t\r]/, c);
  });
});

test('quotes, commas and line breaks in notes survive a round trip', () => {
  const note = 'Ra rises with f, "quadratically".\r\nSecond line, with comma\nThird';
  const map = rowsByFirst(parseCsv(appCsv({ recommendation: note })));
  assert.equal(map.get('Recommended trial and reasons')[1], note);
});

test('metadata and section headers (snapshot)', () => {
  const rows = parseCsv(appCsv({ student: 'Aina', group: 'G3', scenario: 'A' }));
  assert.deepEqual(rows.slice(0, 13), [
    ['Format', 'MachinaLab results'],
    ['Format version', '2'],
    ['App version', '1.1.0'],
    ['Course', 'MMT15603 Assessment of Machinability'],
    ['Exported at', ex.isoWithOffset(WHEN)],
    ['Student', 'Aina'],
    ['Group / members', 'G3'],
    ['Scenario', 'A · Ra limit 0.8 µm'],
    ['Effective Ra limit (µm)', '1.6'],
    ['Max machine input power (kW)', '7.5'],
    ['Effective batch (parts)', '2000'],
    ['Effective tool life (min/edge)', '30'],
    ['Note', 'All values are analytical model predictions, not measurements.'],
  ]);
  assert.match(rows[4][1], /^2026-10-15T14:32:05[+-]\d\d:\d\d$/);
  const map = rowsByFirst(rows);
  assert.deepEqual(map.get('Parameter'), ['Parameter', 'Symbol', 'Value', 'Unit']);
  assert.deepEqual(map.get('Tool nose radius'), ['Tool nose radius', 'rε', '0.8', 'mm']);
  assert.deepEqual(map.get('Speed level 2'), ['Speed level 2', 'Vc2', '150', 'm/min']);
  assert.deepEqual(map.get('Cost weight'), ['Cost weight', 'w4', '30', '%']);
});

test('trial table: units in header, full-precision numbers, Yes/No, scores and ranks', () => {
  const rows = parseCsv(appCsv());
  const h = rows.findIndex(r => r[0] === 'Trial');
  assert.deepEqual(rows[h].slice(0, 7), ['Trial', 'Vc (m/min)', 'f (mm/rev)', 'ap (mm)', 'N (rev/min)', 'MRR (mm³/min)', 'Ra (µm)']);
  const col = name => rows[h].indexOf(name);
  const trial5 = rows[h + 5];
  assert.equal(trial5[0], '5');
  assert.equal(Number(trial5[col('N (rev/min)')]), 964.5754126781535);   // workbook 9 TRIALS!E9
  assert.equal(Number(trial5[col('Cost (RM/part)')]), 1.3927359123950995); // workbook 9 TRIALS!M9
  assert.equal(trial5[col('Feasible (Yes/No)')], 'Yes');
  const trial7 = rows[h + 7];
  assert.equal(trial7[col('Rank')], '1');
  assert.ok(Math.abs(Number(trial7[col('Weighted score')]) - 69.98561516594776) < 1e-9); // DECISION MATRIX!F11
  assert.equal(rows[h + 10][0], 'Live simulator');
  // No locale formatting: no thousands separators anywhere in numeric cells.
  for (const r of rows.slice(h + 1, h + 11)) for (const c of r.slice(1, 19)) assert.doesNotMatch(c, /,|\s/);
});

test('infeasible trials have no score or rank (scenario A)', () => {
  const rows = parseCsv(appCsv({ scenario: 'A' }));
  const h = rows.findIndex(r => r[0] === 'Trial');
  const trial9 = rows[h + 9];
  assert.equal(trial9[rows[h].indexOf('Feasible (Yes/No)')], 'No');
  assert.equal(trial9[rows[h].indexOf('Weighted score')], '');
  assert.equal(trial9[rows[h].indexOf('Rank')], '');
});

test('invalid weights: results exported without scores, with an explanation', () => {
  const rows = parseCsv(appCsv({}, { weightsValid: false }));
  const h = rows.findIndex(r => r[0] === 'Trial');
  assert.equal(rows[h + 7][rows[h].indexOf('Rank')], '');
  assert.ok(rows.some(r => r[0] === 'Note' && /weights must total 100/.test(r[1])));
});

test('invalid inputs: inputs and notes exported, results withheld with reasons', () => {
  const rows = parseCsv(appCsv({ recommendation: 'draft' }, { modelValid: false }));
  assert.ok(!rows.some(r => r[0] === 'Trial'));
  assert.deepEqual(rows.find(r => r[0] === 'Results not exported'), ['Results not exported', 'Some inputs are invalid. Fix them in the app and export again.']);
  assert.deepEqual(rows.find(r => r[0] === 'Input problem'), ['Input problem', 'Drive efficiency must be between 0.1 and 1.']);
  assert.equal(rowsByFirst(rows).get('Recommended trial and reasons')[1], 'draft');
  assert.ok(rows.some(r => r[0] === 'Parameter'));
});

test('CRLF line endings throughout', () => {
  const text = appCsv();
  assert.ok(!/[^\r]\n/.test(text.replace(/"[^"]*"/g, '""')), 'bare LF outside quoted cells');
  assert.ok(text.endsWith('\r\n'));
});

describe('export filename', () => {
  test('pattern and sanitising', () => {
    assert.equal(ex.exportFilename({ group: 'G3', student: 'Nur Aina' }, WHEN, 'csv'), 'MMT15603_G3_Nur-Aina_20261015-1432.csv');
    assert.equal(ex.exportFilename({ group: '../../etc', student: 'a<b>:c|d' }, WHEN, 'json'), 'MMT15603_etc_abcd_20261015-1432.json');
    assert.equal(ex.exportFilename({ group: '', student: '   ' }, WHEN, 'csv'), 'MMT15603_group_student_20261015-1432.csv');
    assert.match(ex.exportFilename({ group: 'x'.repeat(100), student: 's' }, WHEN, 'csv'), /^MMT15603_x{40}_s_/);
  });
});

describe('progress files', () => {
  const state = sanitise({ student: 'Aina', liveSpeed: 220, scenario: 'B', recommendation: 'Trial 7' });

  test('round trip restores the same state', () => {
    const text = ex.buildProgressFile(state, WHEN, '1.1.0');
    const data = JSON.parse(text);
    assert.equal(data.format, 'machinalab-state');
    assert.equal(data.schemaVersion, 2);
    const back = ex.parseProgressFile(text);
    assert.equal(back.ok, true);
    assert.deepEqual(back.state, state);
    assert.equal(back.savedAt, ex.isoWithOffset(WHEN));
  });

  test('imported state is sanitised: bad fields reset, unknown keys dropped, markup kept as text only', () => {
    const text = JSON.stringify({ format: 'machinalab-state', schemaVersion: 2, state: {
      liveSpeed: '<img src=x onerror=alert(1)>', kc: 99999, extra: 'x', student: '<b>Ali</b>', weights: [1, 2],
    } });
    const back = ex.parseProgressFile(text);
    assert.equal(back.ok, true);
    assert.equal(back.state.liveSpeed, 150);
    assert.equal(back.state.kc, 1800);
    assert.ok(!('extra' in back.state));
    assert.equal(back.state.student, '<b>Ali</b>'); // escaped when rendered
    assert.deepEqual(back.state.weights, [30, 25, 15, 30]);
  });

  test('rejects malformed, wrong-format, newer and oversize files with readable messages', () => {
    const cases = [
      ['{not json', /not valid JSON/],
      ['[]', /not a MachinaLab progress file/],
      [JSON.stringify({ format: 'something-else', schemaVersion: 2, state: {} }), /not a MachinaLab progress file/],
      [JSON.stringify({ format: 'machinalab-state', state: {} }), /newer version/],
      [JSON.stringify({ format: 'machinalab-state', schemaVersion: 99, state: {} }), /newer version/],
      ['x'.repeat(ex.PROGRESS_MAX_BYTES + 1), /too large/],
      [null, /could not be read/],
    ];
    for (const [text, pattern] of cases) {
      const r = ex.parseProgressFile(text);
      assert.equal(r.ok, false);
      assert.match(r.message, pattern);
    }
  });
});
