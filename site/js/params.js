// MachinaLab parameter schema: the single source of truth for every student input
// (label, unit, allowed range, default). Used by validate.js, and testable under Node.
//
// Ranges are deliberately generous teaching limits for CNC finish turning. They only block
// values that are physically meaningless or far outside typical lathe and insert practice,
// so that students can still run "what if" experiments. Typical-practice references:
// ISO 1832 / insert catalogues for nose radius (0.1–2.4 mm common, 3.2 mm available);
// tooling handbooks for steel turning speeds and feeds; ISO 1302 roughness grades N1–N12
// (Ra 0.025–50 µm). Limits to be confirmed by the course lecturer.
(function (root) {
  'use strict';

  const numeric = [
    // Workpiece and tool
    { key: 'initial', label: 'Initial diameter', unit: 'mm', min: 2, max: 500, def: 50,
      reason: 'Typical bar stock for a teaching lathe is a few mm to 500 mm.' },
    { key: 'final', label: 'Final diameter', unit: 'mm', min: 1, max: 500, def: 49,
      reason: 'The finished diameter must be a real, positive size.' },
    { key: 'length', label: 'Machining length', unit: 'mm', min: 1, max: 2000, def: 100,
      reason: 'Cutting length must be positive and fit a typical lathe bed.' },
    { key: 'nose', label: 'Tool nose radius', unit: 'mm', min: 0.1, max: 3.2, def: 0.8,
      reason: 'Standard turning inserts have nose radii from 0.1 to 3.2 mm.' },
    // Material and machine
    { key: 'kc', label: 'Specific cutting force kc', unit: 'N/mm²', min: 300, max: 6000, def: 1800,
      reason: 'Engineering metals range from about 300 (aluminium) to about 6000 N/mm² (hardened steels, superalloys).' },
    { key: 'eff', label: 'Drive efficiency', unit: '', min: 0.1, max: 1, def: 0.85,
      reason: 'Drive efficiency is a fraction between 0 and 1 (e.g. 0.85 = 85 %).' },
    { key: 'maxPower', label: 'Max machine input power', unit: 'kW', min: 0.1, max: 200, def: 7.5,
      reason: 'Lathe spindle drives range from under 1 kW to about 200 kW.' },
    { key: 'raLimit', label: 'Ra limit', unit: 'µm', min: 0.025, max: 50, def: 1.6,
      reason: 'ISO 1302 roughness grades span Ra 0.025 to 50 µm.' },
    // Production and cost
    { key: 'rate', label: 'Machine rate', unit: 'RM/hour', min: 0, max: 2000, def: 60,
      reason: 'The machine rate cannot be negative.' },
    { key: 'noncut', label: 'Non-cutting time', unit: 's', min: 0, max: 3600, def: 30,
      reason: 'Loading and positioning time cannot be negative.' },
    { key: 'insert', label: 'Insert cost', unit: 'RM', min: 0, max: 2000, def: 35,
      reason: 'Insert cost cannot be negative.' },
    { key: 'edges', label: 'Usable cutting edges', unit: '', min: 1, max: 12, def: 4, integer: true,
      reason: 'Indexable inserts have between 1 and 12 usable edges.' },
    { key: 'life', label: 'Tool life', unit: 'min/edge', min: 1, max: 480, def: 30,
      reason: 'Tool life per edge must be positive; finishing inserts rarely exceed a few hours.' },
    { key: 'batch', label: 'Batch size', unit: 'parts', min: 1, max: 1000000, def: 2000, integer: true,
      reason: 'The batch must contain at least one part.' },
    // Live simulator
    { key: 'liveSpeed', label: 'Cutting speed Vc', unit: 'm/min', min: 10, max: 1000, def: 150,
      reason: 'Steel turning speeds lie between about 10 (HSS) and 1000 m/min (coated carbide, cermet).' },
    { key: 'liveFeed', label: 'Feed f', unit: 'mm/rev', min: 0.01, max: 2, def: 0.15,
      reason: 'Turning feeds lie between about 0.01 and 2 mm/rev.' },
  ];

  // Experiment levels (3 x 3 design) share the live simulator limits.
  const levels = {
    speeds: { label: 'Speed level', unit: 'm/min', min: 10, max: 1000, def: [100, 150, 200], reason: numeric[14].reason },
    feeds: { label: 'Feed level', unit: 'mm/rev', min: 0.01, max: 2, def: [0.1, 0.15, 0.2], reason: numeric[15].reason },
  };

  const weights = { labels: ['Roughness', 'Productivity', 'Input power', 'Cost'], min: 0, max: 100, def: [30, 25, 15, 30] };

  const scenarios = ['BASE', 'A', 'B', 'C'];

  // Free-text fields: student identity plus the nine workbook prompts.
  const textKeys = ['student', 'group', 'problem', 'assumptions', 'feedRa', 'speedMrr', 'powerNotes',
    'costLife', 'observations', 'recommendation', 'reflection'];
  const textMaxLength = 5000;

  const params = { numeric, levels, weights, scenarios, textKeys, textMaxLength,
    byKey: Object.fromEntries(numeric.map(p => [p.key, p])) };

  root.MachinaLab = root.MachinaLab || {};
  root.MachinaLab.params = params;
  if (typeof module !== 'undefined' && module.exports) module.exports = params;
})(typeof window !== 'undefined' ? window : globalThis);
