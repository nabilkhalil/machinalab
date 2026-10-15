// MachinaLab charts: pure builders that turn data into accessible inline SVG strings.
// No DOM, no libraries, no network: works offline, under the Content-Security-Policy and in print.
// Every chart has <title> + <desc> (read by screen readers) and a "Show data table" alternative.
(function (root) {
  'use strict';

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n, d) => Number.isFinite(n) ? Number(n).toLocaleString('en-MY', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const r1 = n => Math.round(n * 10) / 10; // tidy SVG coordinates

  // Colours: text and axes use the app's text tokens (contrast >= 4.5:1 on white). Series colours
  // were checked with the dataviz palette validator (CVD and normal-vision separation, 3:1 contrast).
  const INK = '#183447', MUTED = '#526a7a', GRID = '#e3eaef', LIMIT = '#a3352a';
  const SERIES = [
    { color: '#2667a0', marker: 'circle', dash: '' },
    { color: '#c2611c', marker: 'square', dash: '7 4' },
    { color: '#7b4fae', marker: 'triangle', dash: '2 3' },
  ];

  // ---- Axis scale -----------------------------------------------------------------------
  // "Nice" step of 1, 2, 2.5 or 5 x 10^n so tick labels are round numbers.
  function niceStep(raw) {
    if (!(raw > 0) || !Number.isFinite(raw)) return 1;
    const base = 10 ** Math.floor(Math.log10(raw)), f = raw / base;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * base;
  }
  // Axis from 0 to a nice maximum >= rawMax, with about `target` intervals.
  function niceScale(rawMax, target = 4) {
    const top = rawMax > 0 && Number.isFinite(rawMax) ? rawMax : 1;
    const step = niceStep(top / target);
    const n = Math.max(1, Math.ceil(top / step - 1e-9));
    let decimals = 0;
    while (decimals < 8 && Math.abs(Math.round(step * 10 ** decimals) - step * 10 ** decimals) > 1e-6) decimals++;
    const ticks = Array.from({ length: n + 1 }, (_, i) => Number((i * step).toFixed(decimals)));
    return { max: ticks[ticks.length - 1], step, ticks, decimals };
  }

  // ---- Shared pieces --------------------------------------------------------------------
  const W = 620, H = 310, M = { left: 74, right: 18, top: 38, bottom: 60 };
  const IW = W - M.left - M.right, IH = H - M.top - M.bottom;

  function frame(id, title, desc, body) {
    return `<div class="chart-scroll" tabindex="0" role="region" aria-label="${esc(title)} chart">`
      + `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t ${id}-d">`
      + `<title id="${id}-t">${esc(title)}</title><desc id="${id}-d">${esc(desc)}</desc>${body}</svg></div>`;
  }
  function yAxis(scale, yTitle, y) {
    const lines = scale.ticks.map(t => `<line x1="${M.left}" y1="${r1(y(t))}" x2="${W - M.right}" y2="${r1(y(t))}" stroke="${GRID}"/>`
      + `<text x="${M.left - 8}" y="${r1(y(t) + 4)}" text-anchor="end" font-size="15" fill="${MUTED}">${num(t, scale.decimals)}</text>`).join('');
    const title = `<text transform="translate(16 ${r1(M.top + IH / 2)}) rotate(-90)" text-anchor="middle" font-size="15" font-weight="600" fill="${INK}">${esc(yTitle)}</text>`;
    return lines + title + `<line x1="${M.left}" y1="${M.top + IH}" x2="${W - M.right}" y2="${M.top + IH}" stroke="${MUTED}"/>`;
  }
  const xTitleText = t => `<text x="${M.left + IW / 2}" y="${H - 8}" text-anchor="middle" font-size="15" font-weight="600" fill="${INK}">${esc(t)}</text>`;

  // A limit line drawn across the plot, or null when it lies far above the data (then described in a note).
  function limitLine(limit, scale, y) {
    if (!limit || !(limit.value <= scale.max)) return '';
    const ly = r1(y(limit.value));
    return `<line x1="${M.left}" y1="${ly}" x2="${W - M.right}" y2="${ly}" stroke="${LIMIT}" stroke-width="2" stroke-dasharray="8 4"/>`
      + `<text x="${W - M.right}" y="${ly - 6}" text-anchor="end" font-size="15" font-weight="700" fill="${LIMIT}">${esc(limit.label)}</text>`;
  }
  // Include a limit in the axis only when it is near the data, so small values are not flattened.
  const axisTop = (dataMax, limit) => limit && Number.isFinite(limit.value) && limit.value <= 2 * dataMax ? Math.max(dataMax, limit.value) : dataMax;
  function limitNote(limit, scale, dataMax, unit, d) {
    if (!limit || limit.value <= scale.max) return '';
    return `${limit.label} is far above every value shown (highest ${num(dataMax, d)} ${unit}, ${num(100 * dataMax / limit.value, 0)} % of the limit), so it is not drawn.`;
  }

  function dataTable(caption, headers, rows) {
    return `<details class="data-table"><summary>Show data table</summary><div class="table-wrap" tabindex="0" role="region" aria-label="${esc(caption)}">`
      + `<table><caption>${esc(caption)}</caption><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>`
      + `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  }
  const card = (title, svg, notes, table, cls = '') => `<div class="card chart-card${cls}"><h3>${esc(title)}</h3>${svg}${notes.filter(Boolean).map(n => `<p class="chart-note">${esc(n)}</p>`).join('')}${table}</div>`;

  // ---- Bar chart: one value per trial --------------------------------------------------
  // o = { id, title, unit, yTitle, xTitle, color, decimals, limit:{value,label}|null, bars:[{id, value, feasible, v, f}] }
  function barChart(o) {
    const vals = o.bars.map(b => b.value), dataMax = Math.max(...vals);
    const scale = niceScale(axisTop(dataMax, o.limit));
    const y = v => M.top + IH * (1 - v / scale.max);
    const slot = IW / o.bars.length, bw = slot * 0.62;
    const bars = o.bars.map((b, i) => {
      const x = M.left + i * slot + (slot - bw) / 2, h = Math.max(0, IH * b.value / scale.max);
      // Infeasible trials: pale fill + dashed outline, so status never depends on colour alone.
      const style = b.feasible ? `fill="${o.color}"` : `fill="${o.color}" fill-opacity="0.28" stroke="${o.color}" stroke-width="1.5" stroke-dasharray="4 3"`;
      return `<rect x="${r1(x)}" y="${r1(y(b.value))}" width="${r1(bw)}" height="${r1(h)}" rx="3" ${style}><title>Trial ${b.id}: ${num(b.value, o.decimals)} ${esc(o.unit)}${b.feasible ? '' : ' (not feasible)'}</title></rect>`
        + `<text x="${r1(x + bw / 2)}" y="${M.top + IH + 21}" text-anchor="middle" font-size="15" fill="${INK}">${b.id}</text>`;
    }).join('');
    const lo = Math.min(...vals), hi = dataMax, ids = v => o.bars.filter(b => b.value === v).map(b => b.id).join(', ');
    const infeasible = o.bars.filter(b => !b.feasible).map(b => b.id);
    const desc = `Bar chart of the nine trials. Lowest ${num(lo, o.decimals)} ${o.unit} (trial ${ids(lo)}), highest ${num(hi, o.decimals)} ${o.unit} (trial ${ids(hi)}).`
      + (o.limit && o.limit.value <= scale.max ? ` Dashed line: ${o.limit.label}.` : '')
      + (infeasible.length ? ` Not feasible: trial ${infeasible.join(', ')}.` : '');
    const svg = frame(o.id, o.title, desc, yAxis(scale, o.yTitle, y) + bars + limitLine(o.limit, scale, y) + xTitleText(o.xTitle));
    const notes = [limitNote(o.limit, scale, dataMax, o.unit, o.decimals), infeasible.length ? 'Pale bars with a dashed outline are not feasible.' : ''];
    const table = dataTable(`${o.title} by trial`, ['Trial', 'Vc (m/min)', 'f (mm/rev)', `${o.title} (${o.unit})`, 'Feasible'],
      o.bars.map(b => [b.id, num(b.v, 0), num(b.f, 2), num(b.value, o.decimals), b.feasible ? 'Yes' : 'No']));
    return card(o.title, svg, notes, table);
  }

  // ---- Stacked bar: machine-time cost + tool cost per trial ----------------------------
  // o = { id, title, unit, yTitle, xTitle, decimals, parts:[{name,color}], bars:[{id, values:[a,b], v, f}] }
  function stackedBarChart(o) {
    const totals = o.bars.map(b => b.values.reduce((a, c) => a + c, 0)), dataMax = Math.max(...totals);
    const scale = niceScale(dataMax);
    const y = v => M.top + IH * (1 - v / scale.max);
    const slot = IW / o.bars.length, bw = slot * 0.62;
    const bars = o.bars.map((b, i) => {
      const x = M.left + i * slot + (slot - bw) / 2;
      let base = 0;
      const segs = b.values.map((v, k) => {
        const top = base + v, h = IH * v / scale.max;
        // 2 px white gap between stacked segments keeps them distinct without relying on colour.
        const seg = `<rect x="${r1(x)}" y="${r1(y(top))}" width="${r1(bw)}" height="${r1(Math.max(0, h - (k ? 2 : 0)))}" fill="${o.parts[k].color}" ${k ? 'fill-opacity="0.85"' : ''}><title>Trial ${b.id} ${esc(o.parts[k].name)}: RM ${num(v, o.decimals)}</title></rect>`;
        base = top;
        return seg;
      }).join('');
      return segs + `<text x="${r1(x + bw / 2)}" y="${M.top + IH + 21}" text-anchor="middle" font-size="15" fill="${INK}">${b.id}</text>`;
    }).join('');
    const legend = o.parts.map((p, k) => `<rect x="${M.left + k * 200}" y="8" width="14" height="14" rx="2" fill="${p.color}"/><text x="${M.left + k * 200 + 20}" y="19" font-size="15" fill="${INK}">${esc(p.name)}</text>`).join('');
    const shares = o.bars.map(b => b.values[1] / (b.values[0] + b.values[1]));
    const desc = `Stacked bar chart of cost per part for the nine trials, split into ${o.parts[0].name.toLowerCase()} and ${o.parts[1].name.toLowerCase()}. `
      + `Tool cost is ${num(100 * Math.min(...shares), 0)} to ${num(100 * Math.max(...shares), 0)} % of the total.`;
    const svg = frame(o.id, o.title, desc, yAxis(scale, o.yTitle, y) + bars + legend + xTitleText(o.xTitle));
    const table = dataTable(`${o.title} by trial`, ['Trial', `${o.parts[0].name} (RM)`, `${o.parts[1].name} (RM)`, 'Total (RM)'],
      o.bars.map((b, i) => [b.id, num(b.values[0], 3), num(b.values[1], 3), num(totals[i], 3)]));
    return card(o.title, svg, [], table);
  }

  // ---- Response plot: output against feed, one line per cutting speed -------------------
  // o = { id, title, unit, yTitle, xTitle, decimals, limit, series:[{name, points:[{x,y}]}] }
  function markerPath(kind, x, y, s = 5) {
    if (kind === 'square') return `<rect x="${r1(x - s)}" y="${r1(y - s)}" width="${2 * s}" height="${2 * s}"`;
    if (kind === 'triangle') return `<path d="M${r1(x)} ${r1(y - s - 1)} L${r1(x + s + 1)} ${r1(y + s)} L${r1(x - s - 1)} ${r1(y + s)} Z"`;
    return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${s}"`;
  }
  function lineChart(o) {
    const allY = o.series.flatMap(s => s.points.map(p => p.y)), allX = o.series.flatMap(s => s.points.map(p => p.x));
    const dataMax = Math.max(...allY);
    const ys = niceScale(axisTop(dataMax, o.limit)), xs = niceScale(Math.max(...allX));
    const y = v => M.top + IH * (1 - v / ys.max), x = v => M.left + IW * v / xs.max;
    const xTicks = xs.ticks.map(t => `<line x1="${r1(x(t))}" y1="${M.top + IH}" x2="${r1(x(t))}" y2="${M.top + IH + 5}" stroke="${MUTED}"/>`
      + `<text x="${r1(x(t))}" y="${M.top + IH + 22}" text-anchor="middle" font-size="15" fill="${INK}">${num(t, xs.decimals)}</text>`).join('');
    const lines = o.series.map((s, k) => {
      const st = SERIES[k % SERIES.length];
      const pts = s.points.map(p => `${r1(x(p.x))},${r1(y(p.y))}`).join(' ');
      const marks = s.points.map(p => `${markerPath(st.marker, x(p.x), y(p.y))} fill="${st.color}" stroke="#fff" stroke-width="1.5"><title>${esc(s.name)}, f = ${num(p.x, 2)} mm/rev: ${num(p.y, o.decimals)} ${esc(o.unit)}</title></${st.marker === 'square' ? 'rect' : st.marker === 'triangle' ? 'path' : 'circle'}>`).join('');
      return `<polyline points="${pts}" fill="none" stroke="${st.color}" stroke-width="2" ${st.dash ? `stroke-dasharray="${st.dash}"` : ''}/>` + marks;
    }).join('');
    const legend = o.series.map((s, k) => {
      const st = SERIES[k % SERIES.length], lx = M.left + k * 165;
      return `<line x1="${lx}" y1="15" x2="${lx + 26}" y2="15" stroke="${st.color}" stroke-width="2" ${st.dash ? `stroke-dasharray="${st.dash}"` : ''}/>`
        + `${markerPath(st.marker, lx + 13, 15, 4)} fill="${st.color}"/>`
        + `<text x="${lx + 32}" y="19" font-size="15" fill="${INK}">${esc(s.name)}</text>`;
    }).join('');
    // Describe the trend in words: does cutting speed matter, and how does the output change with feed?
    const same = o.series.every(s => s.points.every((p, i) => Math.abs(p.y - o.series[0].points[i].y) <= 1e-9 * Math.max(1, Math.abs(p.y))));
    const first = o.series[0].points, last = o.series[o.series.length - 1].points;
    const desc = same
      ? `${o.title} against feed. All ${o.series.length} cutting-speed lines lie on top of each other: in this model cutting speed has no effect. It rises from ${num(first[0].y, o.decimals)} to ${num(first[first.length - 1].y, o.decimals)} ${o.unit} as feed increases.`
      : `${o.title} against feed, one line per cutting speed. At the lowest speed it goes from ${num(first[0].y, o.decimals)} to ${num(first[first.length - 1].y, o.decimals)} ${o.unit}; at the highest speed from ${num(last[0].y, o.decimals)} to ${num(last[last.length - 1].y, o.decimals)} ${o.unit}.`;
    const svg = frame(o.id, o.title, desc, yAxis(ys, o.yTitle, y) + xTicks + lines + limitLine(o.limit, ys, y) + legend + xTitleText(o.xTitle));
    const notes = [same ? 'The three lines coincide: cutting speed does not change this output in the model.' : '', limitNote(o.limit, ys, dataMax, o.unit, o.decimals)];
    const feeds = o.series[0].points.map(p => p.x);
    const table = dataTable(`${o.title} (${o.unit}) by feed and cutting speed`, ['f (mm/rev)', ...o.series.map(s => s.name)],
      feeds.map((f, i) => [num(f, 2), ...o.series.map(s => num(s.points[i].y, o.decimals))]));
    return card(o.title, svg, notes, table);
  }

  // ---- Feasibility map: Vc-f plane --------------------------------------------------------
  // o = { id, title, xMax, yMax, isFeasible(v,f) -> {feasible, raOk, powerOk}, trials:[{id,v,f,feasible}], live:{v,f,feasible},
  //       raLimit, maxPower }
  function feasibilityMap(o) {
    const xs = niceScale(o.xMax), ys = niceScale(o.yMax);
    const x = v => M.left + IW * v / xs.max, y = f => M.top + IH * (1 - f / ys.max);
    const NX = 60, NY = 40;
    let cells = '', raLimited = 0, powerLimited = 0, feasibleCells = 0;
    for (let i = 0; i < NX; i++) {
      for (let j = 0; j < NY; j++) {
        const v = xs.max * (i + 0.5) / NX, f = ys.max * (j + 0.5) / NY, c = o.isFeasible(v, f);
        if (c.feasible) feasibleCells++;
        if (!c.raOk) raLimited++;
        if (!c.powerOk) powerLimited++;
        if (c.feasible) cells += `<rect x="${r1(M.left + IW * i / NX)}" y="${r1(M.top + IH * (NY - j - 1) / NY)}" width="${r1(IW / NX + 0.6)}" height="${r1(IH / NY + 0.6)}" fill="#cdeadb"/>`;
      }
    }
    const grid = ys.ticks.map(t => `<line x1="${M.left}" y1="${r1(y(t))}" x2="${W - M.right}" y2="${r1(y(t))}" stroke="${GRID}" stroke-opacity="0.8"/>`
      + `<text x="${M.left - 8}" y="${r1(y(t) + 4)}" text-anchor="end" font-size="15" fill="${MUTED}">${num(t, ys.decimals)}</text>`).join('')
      + xs.ticks.map(t => `<line x1="${r1(x(t))}" y1="${M.top}" x2="${r1(x(t))}" y2="${M.top + IH}" stroke="${GRID}" stroke-opacity="0.8"/>`
      + `<text x="${r1(x(t))}" y="${M.top + IH + 22}" text-anchor="middle" font-size="15" fill="${INK}">${num(t, xs.decimals)}</text>`).join('');
    const axes = `<rect x="${M.left}" y="${M.top}" width="${IW}" height="${IH}" fill="none" stroke="${MUTED}"/>`
      + `<text transform="translate(16 ${r1(M.top + IH / 2)}) rotate(-90)" text-anchor="middle" font-size="15" font-weight="600" fill="${INK}">Feed f (mm/rev)</text>`
      + xTitleText('Cutting speed Vc (m/min)');
    const points = o.trials.map(t => {
      const px = x(t.v), py = y(t.f);
      const mark = t.feasible
        ? `<circle cx="${r1(px)}" cy="${r1(py)}" r="6" fill="${INK}" stroke="#fff" stroke-width="1.5"/>`
        : `<circle cx="${r1(px)}" cy="${r1(py)}" r="6" fill="#fff" stroke="${LIMIT}" stroke-width="2"/><path d="M${r1(px - 3.5)} ${r1(py - 3.5)} L${r1(px + 3.5)} ${r1(py + 3.5)} M${r1(px + 3.5)} ${r1(py - 3.5)} L${r1(px - 3.5)} ${r1(py + 3.5)}" stroke="${LIMIT}" stroke-width="2"/>`;
      return `<g><title>Trial ${t.id}: Vc ${num(t.v, 0)} m/min, f ${num(t.f, 2)} mm/rev, ${t.feasible ? 'feasible' : 'not feasible'}</title>${mark}<text x="${r1(px + 9)}" y="${r1(py - 7)}" font-size="15" font-weight="700" fill="${INK}">${t.id}</text></g>`;
    }).join('');
    const L = o.live, lx = x(L.v), ly = y(L.f);
    const live = `<g><title>Live simulator: Vc ${num(L.v, 0)} m/min, f ${num(L.f, 2)} mm/rev, ${L.feasible ? 'feasible' : 'not feasible'}</title>`
      + `<path d="M${r1(lx)} ${r1(ly - 9)} L${r1(lx + 9)} ${r1(ly)} L${r1(lx)} ${r1(ly + 9)} L${r1(lx - 9)} ${r1(ly)} Z" fill="#c2611c" stroke="#fff" stroke-width="1.5"/>`
      + `<text x="${r1(lx + 11)}" y="${r1(ly + 16)}" font-size="15" font-weight="700" fill="#8f4510">Live</text></g>`;
    const legend = `<rect x="${M.left}" y="9" width="14" height="14" fill="#cdeadb" stroke="${MUTED}" stroke-width="0.5"/><text x="${M.left + 20}" y="20" font-size="15" fill="${INK}">Feasible region</text>`
      + `<circle cx="${M.left + 172}" cy="16" r="5" fill="${INK}"/><text x="${M.left + 182}" y="20" font-size="15" fill="${INK}">Feasible trial</text>`
      + `<circle cx="${M.left + 312}" cy="16" r="5" fill="#fff" stroke="${LIMIT}" stroke-width="2"/><text x="${M.left + 322}" y="20" font-size="15" fill="${INK}">Not feasible</text>`
      + `<path d="M${M.left + 432} 9 L${M.left + 439} 16 L${M.left + 432} 23 L${M.left + 425} 16 Z" fill="#c2611c"/><text x="${M.left + 445}" y="20" font-size="15" fill="${INK}">Live simulator</text>`;
    const nFeasible = o.trials.filter(t => t.feasible).length;
    const binding = raLimited && !powerLimited ? `Only the roughness limit (Ra ≤ ${num(o.raLimit, 2)} µm) restricts the region shown: it caps the feed at every cutting speed; the ${num(o.maxPower, 2)} kW power limit is not reached.`
      : raLimited && powerLimited ? `Both limits restrict the region: roughness caps the feed, and the ${num(o.maxPower, 2)} kW power limit removes high speed and high feed combinations.`
      : !raLimited && powerLimited ? `Only the ${num(o.maxPower, 2)} kW power limit restricts the region shown.` : 'No limit is reached within the region shown.';
    const desc = `Feasibility map of cutting speed against feed. ${nFeasible} of ${o.trials.length} trials ${L.feasible ? 'and the live point ' : ''}lie in the feasible region${L.feasible ? '' : '; the live point does not'}. ${binding}`;
    const svg = frame(o.id, o.title, desc, cells + grid + axes + points + live + legend);
    const table = dataTable('Trials on the feasibility map', ['Point', 'Vc (m/min)', 'f (mm/rev)', 'Feasible'],
      [...o.trials.map(t => [`Trial ${t.id}`, num(t.v, 0), num(t.f, 2), t.feasible ? 'Yes' : 'No']), ['Live simulator', num(L.v, 0), num(L.f, 2), L.feasible ? 'Yes' : 'No']]);
    return card(o.title, svg, [binding, `Each shaded cell was evaluated with the same model as the trials (${NX} × ${NY} grid), so the boundary is approximate.`], table, ' wide');
  }

  const api = { niceStep, niceScale, barChart, stackedBarChart, lineChart, feasibilityMap, SERIES };
  root.MachinaLab = root.MachinaLab || {};
  root.MachinaLab.charts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
