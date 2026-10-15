// MachinaLab student data export: CSV results and JSON progress files. Pure functions, no DOM.
// Exports are what lecturers mark, and are opened in Excel, so every text cell is protected
// against formula injection and every number is written at full precision with its unit in the header.
(function (root) {
  'use strict';
  const params = (root.MachinaLab && root.MachinaLab.params) || require('./params.js');
  const { sanitise } = (root.MachinaLab && root.MachinaLab.sanitise) ? root.MachinaLab : require('./validate.js');

  const CSV_FORMAT_VERSION = 2;
  const PROGRESS_FORMAT = 'machinalab-state';
  const PROGRESS_SCHEMA_VERSION = 2;
  const PROGRESS_MAX_BYTES = 200 * 1024;

  const SCENARIOS = {
    BASE: 'Original specification',
    A: 'Ra limit 0.8 µm',
    B: 'Batch of 3,500 components',
    C: 'Tool life reduced by 40 %',
  };

  // A spreadsheet treats a cell starting with = + - @ (or tab / carriage return) as a formula.
  // Prefixing an apostrophe makes Excel and LibreOffice show it as plain text.
  function neutralise(text) {
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  }

  // One CSV cell: numbers unformatted, booleans as Yes/No, everything else as protected text.
  function cell(value) {
    let text;
    if (typeof value === 'number') text = Number.isFinite(value) ? String(value) : '';
    else if (typeof value === 'boolean') text = value ? 'Yes' : 'No';
    else text = neutralise(String(value ?? ''));
    return `"${text.replace(/"/g, '""')}"`;
  }

  const toCsv = rows => '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';

  // Local time with UTC offset, e.g. 2026-10-15T14:32:05+08:00.
  function isoWithOffset(date) {
    const pad = n => String(Math.abs(Math.trunc(n))).padStart(2, '0');
    const offset = -date.getTimezoneOffset();
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
      + `${offset >= 0 ? '+' : '-'}${pad(offset / 60)}:${pad(offset % 60)}`;
  }

  // MMT15603_<group>_<student>_<YYYYMMDD-HHmm>.<ext>, safe for every file system.
  function exportFilename(state, date, ext) {
    const clean = (text, fallback) => (String(text || '').trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || fallback);
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
    return `MMT15603_${clean(state.group, 'group')}_${clean(state.student, 'student')}_${stamp}.${ext}`;
  }

  const TRIAL_HEADER = ['Trial', 'Vc (m/min)', 'f (mm/rev)', 'ap (mm)', 'N (rev/min)', 'MRR (mm³/min)', 'Ra (µm)',
    'Fc (N)', 'Pc (kW)', 'Pin (kW)', 'tcut (s)', 'tcycle (s)', 'Cost (RM/part)', 'Tool cost (RM/part)',
    'Batch cost (RM)', 'Batch cycle time (h)', 'Cost at T=15 min (RM/part)', 'Cost at T=30 min (RM/part)',
    'Cost at T=60 min (RM/part)', 'Feasible (Yes/No)', 'Weighted score', 'Rank'];

  const trialRow = (id, r, score, rank) => [id, r.v, r.f, r.ap, r.rpm, r.mrr, r.ra, r.force, r.cutPower, r.inputPower,
    r.cutTime, r.cycle, r.cost, r.toolCost, r.batchCost, r.batchHours, r.costLife15, r.costLife30, r.costLife60,
    r.feasible, score, rank];

  /**
   * Build the results CSV.
   * @param {object} input
   *   state     sanitised app state
   *   effective { raLimit, maxPower, batch, life } after the change request is applied
   *   results   null when inputs are invalid; otherwise { trials, live, ranking } where ranking
   *             is null when the decision weights are invalid
   *   problems  input error messages (shown when results are null)
   *   prompts   [[key, label], ...] student analysis sections
   *   appVersion, exportedAt (Date)
   */
  function buildCsv({ state, effective, results, problems = [], prompts, appVersion, exportedAt }) {
    const rows = [
      ['Format', 'MachinaLab results'],
      ['Format version', CSV_FORMAT_VERSION],
      ['App version', appVersion],
      ['Course', 'MMT15603 Assessment of Machinability'],
      ['Exported at', isoWithOffset(exportedAt)],
      ['Student', state.student],
      ['Group / members', state.group],
      ['Scenario', `${state.scenario} · ${SCENARIOS[state.scenario] || ''}`],
      ['Effective Ra limit (µm)', effective.raLimit],
      ['Max machine input power (kW)', effective.maxPower],
      ['Effective batch (parts)', effective.batch],
      ['Effective tool life (min/edge)', effective.life],
      ['Note', 'All values are analytical model predictions, not measurements.'],
      [],
      ['Parameter', 'Symbol', 'Value', 'Unit'],
      ...params.numeric.map(p => [p.label, p.symbol, state[p.key], p.unit]),
      ...state.speeds.map((v, i) => [`Speed level ${i + 1}`, `Vc${i + 1}`, v, 'm/min']),
      ...state.feeds.map((v, i) => [`Feed level ${i + 1}`, `f${i + 1}`, v, 'mm/rev']),
      ...params.weights.labels.map((label, i) => [`${label} weight`, `w${i + 1}`, state.weights[i], '%']),
      [],
    ];

    if (results) {
      const scoreOf = new Map((results.ranking || []).map(r => [r.id, r]));
      const feasibleOrder = (results.ranking || []).filter(r => r.feasible).map(r => r.id);
      rows.push(TRIAL_HEADER);
      for (const t of results.trials) {
        const ranked = scoreOf.get(t.id);
        const rank = feasibleOrder.indexOf(t.id) + 1;
        rows.push(trialRow(t.id, t, ranked && ranked.score !== null ? ranked.score : '', rank > 0 ? rank : ''));
      }
      rows.push(trialRow('Live simulator', results.live, '', ''));
      if (!results.ranking) rows.push(['Note', 'Weighted scores and ranks not exported: decision weights must total 100 %.']);
    } else {
      rows.push(['Results not exported', 'Some inputs are invalid. Fix them in the app and export again.']);
      for (const message of problems) rows.push(['Input problem', message]);
    }

    rows.push([], ['Section', 'Student response']);
    for (const [key, label] of prompts) rows.push([label, state[key]]);
    return toCsv(rows);
  }

  // ---- Progress files: move work between computers without accounts ---------------------

  function buildProgressFile(state, savedAt, appVersion) {
    return JSON.stringify({ format: PROGRESS_FORMAT, schemaVersion: PROGRESS_SCHEMA_VERSION, appVersion,
      savedAt: isoWithOffset(savedAt), state }, null, 2);
  }

  // Returns { ok: true, state } or { ok: false, message } with a student-readable reason.
  // The file is untrusted: size-limited, parsed safely, and passed through the full sanitiser.
  function parseProgressFile(text) {
    const fail = message => ({ ok: false, message });
    if (typeof text !== 'string') return fail('The file could not be read.');
    if (text.length > PROGRESS_MAX_BYTES) return fail('This file is too large to be a MachinaLab progress file.');
    let data;
    try { data = JSON.parse(text); } catch { return fail('This is not a MachinaLab progress file (it is not valid JSON).'); }
    if (!data || typeof data !== 'object' || data.format !== PROGRESS_FORMAT) {
      return fail('This is not a MachinaLab progress file. Choose a file saved with "Save progress file".');
    }
    if (typeof data.schemaVersion !== 'number' || data.schemaVersion > PROGRESS_SCHEMA_VERSION) {
      return fail('This progress file was saved by a newer version of MachinaLab. Reload the page and try again.');
    }
    return { ok: true, state: sanitise(data.state), savedAt: typeof data.savedAt === 'string' ? data.savedAt : '' };
  }

  const api = { neutralise, buildCsv, exportFilename, buildProgressFile, parseProgressFile, isoWithOffset,
    SCENARIOS, PROGRESS_MAX_BYTES, CSV_FORMAT_VERSION };
  root.MachinaLab = root.MachinaLab || {};
  root.MachinaLab.exporter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
