// Smoke tests for the student-facing app. Expected values are from the
// Excel-validated baseline (tests/fixtures/baseline-v1.json) at default inputs.
'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const PAGES = [
  ['dashboard', 'Machinability Overview'],
  ['simulator', 'Live Turning Simulator'],
  ['experiments', 'Virtual Experimental Laboratory'],
  ['analysis', 'Machinability Data Analysis'],
  ['cost', 'Cost & Decision Analysis'],
  ['pbl', 'PBL Student Workbook'],
  ['models', 'Engineering Models & Assumptions'],
];

// Collect uncaught errors and console errors for the whole test.
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

// The legacy app recalculates on the `change` event.
async function setNumber(page, selector, value) {
  await page.fill(selector, String(value));
  await page.locator(selector).dispatchEvent('change');
}

const openPage = (page, name) => page.click(`#nav button[data-page="${name}"]`);
const metric = (page, label) => page.locator('.card', { hasText: label }).locator('.metric-value');

test.beforeEach(async ({ page }) => {
  await page.goto('index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('every page renders without errors or invalid numbers', async ({ page }) => {
  const errors = watchErrors(page);
  for (const [name, title] of PAGES) {
    await openPage(page, name);
    await expect(page.locator('#pageTitle')).toHaveText(title);
    const text = await page.locator('#view').innerText();
    expect(text, `page ${name}`).not.toMatch(/\bNaN\b|\bundefined\b|Infinity/);
  }
  expect(errors).toEqual([]);
});

test('default overview: 9 of 9 trials feasible', async ({ page }) => {
  await expect(metric(page, 'Feasible conditions')).toContainText('9');
});

test('live simulator recalculates from Vc and f', async ({ page }) => {
  await openPage(page, 'simulator');
  await expect(metric(page, 'Theoretical Ra')).toContainText('0.879');
  await expect(metric(page, 'Cost per part')).toContainText('RM 1.39');

  await setNumber(page, '#liveSpeed', 200);
  await setNumber(page, '#liveFeed', 0.2);
  await expect(metric(page, 'Theoretical Ra')).toContainText('1.563');
  await expect(metric(page, 'Spindle speed')).toContainText('1,286');
  await expect(metric(page, 'Input power')).toContainText('0.706');
  await expect(metric(page, 'Cost per part')).toContainText('RM 1.00');
  await expect(page.locator('[data-region="simResults"] .status')).toHaveText('FEASIBLE');
});

test('nine-trial table matches validated values', async ({ page }) => {
  await openPage(page, 'experiments');
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(9);
  const trial5 = rows.nth(4).locator('td');
  await expect(trial5.nth(3)).toHaveText('965');     // RPM
  await expect(trial5.nth(5)).toHaveText('0.879');   // Ra
  await expect(trial5.nth(9)).toHaveText('RM 1.39'); // cost per part
});

test('change request A leaves 3 feasible trials, best is trial 7', async ({ page }) => {
  await openPage(page, 'cost');
  await page.selectOption('select[data-key="scenario"]', 'A');
  await expect(metric(page, 'Best feasible trial')).toContainText('#7');
  await openPage(page, 'experiments');
  await expect(page.locator('.pill', { hasText: 'feasible' })).toHaveText('3 feasible');
});

test('invalid diameters: notice, marked field, and no predictions shown', async ({ page }) => {
  await openPage(page, 'simulator');
  await setNumber(page, '#final', 51);
  await expect(page.locator('#notice')).toContainText('Final diameter must be smaller than initial diameter');
  await expect(page.locator('#final')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#msg-final')).toContainText('bar gets thinner');
  await expect(page.locator('.status')).toHaveCount(0); // never show FEASIBLE for invalid input
  await expect(page.locator('[data-region="simResults"] .blocked')).toContainText('No predictions yet');
  for (const name of ['experiments', 'analysis', 'cost']) {
    await openPage(page, name);
    await expect(page.locator('.blocked').first()).toBeVisible();
    await expect(page.locator('#view')).not.toContainText('FEASIBLE');
  }
  await openPage(page, 'dashboard');
  await expect(metric(page, 'Feasible conditions')).toContainText('—');
});

test('"Show me" in the notice opens the right page and focuses the field', async ({ page }) => {
  await openPage(page, 'cost');
  await setNumber(page, '#batch', 0);
  await openPage(page, 'models');
  await page.locator('#notice [data-fix="batch"]').click();
  await expect(page.locator('#pageTitle')).toHaveText('Cost & Decision Analysis');
  await expect(page.locator('#batch')).toBeFocused();
});

test('emptied field asks for a number and keeps the box empty', async ({ page }) => {
  await openPage(page, 'simulator');
  await setNumber(page, '#liveFeed', '');
  await expect(page.locator('#notice')).toContainText('Enter a number for Feed f (mm/rev).');
  await expect(page.locator('#liveFeed')).toHaveValue('');
});

test('weights not totalling 100 block only the ranking', async ({ page }) => {
  await openPage(page, 'cost');
  await setNumber(page, '#weights-0', 20);
  await expect(page.locator('#notice')).toContainText('add up to 90 %');
  await expect(page.locator('#costAnalysis')).toBeVisible();
  await expect(page.locator('.blocked')).toContainText('No ranking yet');
  await expect(metric(page, 'Best feasible trial')).toContainText('—');
  await openPage(page, 'experiments');
  await expect(page.locator('tbody tr')).toHaveCount(9);
});

test('feed larger than nose radius shows a warning, not an error', async ({ page }) => {
  await openPage(page, 'simulator');
  await setNumber(page, '#liveFeed', 0.9);
  await expect(page.locator('#notice')).toContainText('not smaller than the nose radius');
  await expect(page.locator('#notice')).toHaveClass(/warn/);
  await expect(page.locator('[data-region="simResults"] .status')).toHaveText('NOT FEASIBLE'); // results still shown
});

test('tampered storage cannot inject markup', async ({ page }) => {
  let dialog = false;
  page.on('dialog', d => { dialog = true; d.dismiss(); });
  await page.evaluate(() => localStorage.setItem('machinalab-v1', JSON.stringify({
    liveSpeed: '"><img src=x onerror=alert(1)>', speeds: ['<b>1</b>', 2, 3], student: '<img src=x onerror=alert(2)>',
  })));
  await page.reload();
  for (const name of ['simulator', 'experiments', 'pbl']) await openPage(page, name);
  await expect(page.locator('#pbl-student')).toHaveValue('<img src=x onerror=alert(2)>'); // shown as text
  await openPage(page, 'simulator');
  await expect(page.locator('#liveSpeed')).toHaveValue('150');
  expect(dialog).toBe(false);
  expect(await page.locator('#view img').count()).toBe(0);
});

test('app keeps working and warns when the browser blocks saving', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); }; });
  const errors = watchErrors(page);
  await page.reload();
  await openPage(page, 'simulator');
  await setNumber(page, '#liveSpeed', 200);
  await expect(metric(page, 'Spindle speed')).toContainText('1,286');
  await expect(page.locator('#notice')).toContainText('could not be saved in this browser');
  expect(errors).toEqual([]);
});

test('CSV from invalid inputs contains notes but no predictions', async ({ page }) => {
  await openPage(page, 'simulator');
  await setNumber(page, '#eff', 1.5);
  await openPage(page, 'pbl');
  await page.fill('[data-text="group"]', 'G2');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
  const csv = fs.readFileSync(await download.path(), 'utf8');
  expect(csv).toContain('"Results not exported"');
  expect(csv).toContain('Drive efficiency must be between');
  expect(csv).not.toContain('"Trial","Vc_m_min"');
  expect(csv).toContain('"Group / members","G2"');
});

test('student notes persist after reload', async ({ page }) => {
  await openPage(page, 'pbl');
  await page.fill('[data-text="student"]', 'Test Student');
  await page.fill('[data-text="observations"]', 'Ra rises with feed.');
  await page.reload();
  await openPage(page, 'pbl');
  await expect(page.locator('[data-text="student"]')).toHaveValue('Test Student');
  await expect(page.locator('[data-text="observations"]')).toHaveValue('Ra rises with feed.');
});

test('CSV export: named file, BOM, metadata, units, values and notes', async ({ page }) => {
  await openPage(page, 'pbl');
  await page.fill('[data-text="student"]', 'Nur Aina');
  await page.fill('[data-text="group"]', 'G1');
  await page.fill('[data-text="recommendation"]', 'Trial 7, because it is feasible and scores highest.');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
  expect(download.suggestedFilename()).toMatch(/^MMT15603_G1_Nur-Aina_\d{8}-\d{4}\.csv$/);
  const csv = fs.readFileSync(await download.path(), 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM so Excel reads µ and ³ correctly
  const lines = csv.slice(1).split('\r\n');
  expect(lines[0]).toBe('"Format","MachinaLab results"');
  expect(lines[1]).toBe('"Format version","2"');
  expect(csv).toContain('"Group / members","G1"');
  expect(csv).toContain('"Trial","Vc (m/min)","f (mm/rev)","ap (mm)","N (rev/min)","MRR (mm³/min)","Ra (µm)"');
  expect(csv).toMatch(/\r\n"5","150","0.15","0.5","964\.57541/);
  expect(csv).toContain('"Recommended trial and reasons","Trial 7, because it is feasible and scores highest."');
});

test('decision matrix ranks trials as the workbook does', async ({ page }) => {
  await openPage(page, 'cost');
  const ranked = page.locator('section', { hasText: 'Ranked trial decision matrix' }).locator('tbody tr');
  const trialIds = await ranked.evaluateAll(rows => rows.map(r => Number(r.cells[1].textContent)));
  expect(trialIds).toEqual([7, 8, 4, 1, 5, 9, 2, 6, 3]); // DECISION MATRIX!H5:H13
  await expect(ranked.first().locator('td').nth(8)).toHaveText('69.99');
});

test('cost analysis table shows batch hours and tool-life sensitivity', async ({ page }) => {
  await openPage(page, 'cost');
  const trial7 = page.locator('#costAnalysis tbody tr').nth(6).locator('td');
  await expect(trial7.nth(2)).toHaveText('RM 0.227');  // tool cost/part
  await expect(trial7.nth(4)).toHaveText('42.6');      // batch cycle hours
  await expect(trial7.nth(5)).toHaveText('RM 1.73');   // T = 15 min
  await page.selectOption('select[data-key="scenario"]', 'B');
  await expect(page.locator('#costAnalysis tbody tr').nth(6).locator('td').nth(4)).toHaveText('74.5');
});

test('workbook shows the nine student analysis prompts', async ({ page }) => {
  await openPage(page, 'pbl');
  await expect(page.locator('textarea[data-text]')).toHaveCount(9);
  for (const label of ['Problem statement', 'Effect of feed on Ra', 'Recommended trial and reasons', 'Limitations / validation plan']) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  }
});

test('notes saved before Stage 2 carry over to the new prompts', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('machinalab-v1', JSON.stringify({
    student: 'Ali', observations: 'old obs', recommendation: 'Trial 7', reflection: 'Need real Ra tests',
  })));
  await page.reload();
  await openPage(page, 'pbl');
  await expect(page.getByLabel('Recommended trial and reasons')).toHaveValue('Trial 7');
  await expect(page.getByLabel('Limitations / validation plan')).toHaveValue('Need real Ra tests');
  await expect(page.getByLabel('Other observations (optional)')).toHaveValue('old obs');
  await expect(page.getByLabel('Problem statement')).toHaveValue('');
});

test('Print report prints a full report, not the current page', async ({ page }) => {
  await page.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await openPage(page, 'pbl');
  await page.fill('[data-text="student"]', 'Nur Aina');
  await page.fill('[data-text="feedRa"]', 'Ra rises with the square of feed.');
  await page.click('#printBtn');
  expect(await page.evaluate(() => window.__printed)).toBe(1);
  await page.emulateMedia({ media: 'print' });
  for (const hidden of ['.sidebar', '.topbar', '#view']) await expect(page.locator(hidden)).toBeHidden();
  const report = page.locator('#report');
  await expect(report).toBeVisible();
  await expect(report).toContainText('Nur Aina');
  await expect(report).toContainText('Best feasible trial by weighted score: trial 7');
  await expect(report.locator('h2')).toHaveText(['1. Inputs and assumptions', '2. Nine-trial results', '3. Key responses',
    '4. Production cost and tool-life sensitivity', '5. Decision matrix', '6. Student analysis']);
  await expect(report.locator('svg.chart')).toHaveCount(3);
  await expect(report).toContainText('Ra rises with the square of feed.');
  await expect(report).toContainText('(not answered)');
  await expect(report).toContainText('model predictions');
  // The report reuses page builders; ids must stay unique even with the Cost page open.
  await page.emulateMedia({ media: 'screen' });
  await openPage(page, 'cost');
  await page.click('#printBtn');
  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(duplicateIds).toEqual([]);
  await expect(report).toBeHidden();
});

test('report from invalid inputs explains why results are missing', async ({ page }) => {
  await page.evaluate(() => { window.print = () => {}; });
  await openPage(page, 'simulator');
  await setNumber(page, '#final', 60);
  await page.click('#printBtn');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#report')).toContainText('Results not included');
  await expect(page.locator('#report')).toContainText('Final diameter must be smaller');
  await expect(page.locator('#report')).not.toContainText('FEASIBLE');
});

test('progress file: save, then open on a "different computer"', async ({ page, context }) => {
  await openPage(page, 'simulator');
  await setNumber(page, '#liveSpeed', 220);
  await openPage(page, 'pbl');
  await page.fill('[data-text="student"]', 'Nur Aina');
  await page.fill('[data-text="reflection"]', 'Validate Ra with a profilometer.');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#saveProgress')]);
  expect(download.suggestedFilename()).toMatch(/^MMT15603_group_Nur-Aina_\d{8}-\d{4}\.json$/);
  const file = await download.path();
  await expect(page.locator('.progress-msg')).toContainText('Progress file saved');

  // Fresh browser profile = another computer.
  const other = await context.browser().newContext();
  const page2 = await other.newPage();
  await page2.goto('index.html');
  await page2.click('#nav button[data-page="pbl"]');
  await expect(page2.locator('[data-text="student"]')).toHaveValue('');
  page2.once('dialog', d => d.accept());
  await page2.setInputFiles('#openProgress', file);
  await expect(page2.locator('.progress-msg')).toContainText('Progress file opened');
  await expect(page2.locator('[data-text="student"]')).toHaveValue('Nur Aina');
  await expect(page2.locator('[data-text="reflection"]')).toHaveValue('Validate Ra with a profilometer.');
  await page2.click('#nav button[data-page="simulator"]');
  await expect(page2.locator('#liveSpeed')).toHaveValue('220');
  await page2.reload(); // and it is now saved in that browser too
  await page2.click('#nav button[data-page="pbl"]');
  await expect(page2.locator('[data-text="student"]')).toHaveValue('Nur Aina');
  await other.close();
});

test('opening a file that is not a progress file is refused with a clear message', async ({ page }) => {
  await openPage(page, 'pbl');
  await page.fill('[data-text="student"]', 'Keep me');
  await page.setInputFiles('#openProgress', { name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.locator('.progress-msg')).toContainText('not a MachinaLab progress file');
  await expect(page.locator('[data-text="student"]')).toHaveValue('Keep me');
});

test('declining the confirmation keeps current work', async ({ page }) => {
  await openPage(page, 'pbl');
  await page.fill('[data-text="student"]', 'Current');
  const other = JSON.stringify({ format: 'machinalab-state', schemaVersion: 2, state: { student: 'Other' } });
  page.once('dialog', d => d.dismiss());
  await page.setInputFiles('#openProgress', { name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(other) });
  await page.waitForTimeout(200);
  await expect(page.locator('[data-text="student"]')).toHaveValue('Current');
});

test('phone width (375 px) has no horizontal page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const [name] of PAGES) {
    await openPage(page, name);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `page ${name}`).toBeLessThanOrEqual(0);
  }
});

test('opens directly from file:// (double-click)', async ({ page }) => {
  const errors = watchErrors(page);
  const file = path.resolve(__dirname, '..', '..', 'site', 'index.html').split(path.sep).join('/');
  await page.goto('file:///' + file.replace(/^\//, ''));
  await openPage(page, 'experiments');
  await expect(page.locator('tbody tr')).toHaveCount(9);
  expect(errors).toEqual([]);
});

// ---- Stage 6: live updating, change-request overrides, dynamic overview ----------------

test('results update while typing, without disturbing the field being typed in', async ({ page }) => {
  await openPage(page, 'simulator');
  const box = page.locator('#liveSpeed');
  await box.evaluate(el => { el.dataset.probe = 'original'; }); // tag this exact element
  await box.click();
  await box.press('Control+A');
  // Pause longer than the 150 ms debounce between keys, so live updates run mid-typing.
  await box.pressSequentially('210', { delay: 250 });
  await expect(box).toBeFocused();
  await expect(box).toHaveValue('210');                        // caret never jumped
  await expect(metric(page, 'Spindle speed')).toContainText('1,350'); // updated before leaving the field
  await expect(page.locator('#liveSpeed[data-probe="original"]')).toHaveCount(1); // same element, never re-created
});

test('typing an invalid value shows the problem live, and fixing it restores results', async ({ page }) => {
  await openPage(page, 'simulator');
  const box = page.locator('#final');
  await box.click();
  await box.press('Control+A');
  await box.pressSequentially('52', { delay: 50 });
  await expect(page.locator('#msg-final')).toContainText('bar gets thinner');
  await expect(box).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[data-region="simResults"] .blocked')).toBeVisible();
  await box.press('Control+A');
  await box.pressSequentially('49', { delay: 50 });
  await expect(page.locator('#msg-final')).toHaveCount(0);
  await expect(box).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[data-region="simResults"] .status')).toHaveText('FEASIBLE');
  await expect(box).toBeFocused();
});

test('experiment table and weight total update while typing', async ({ page }) => {
  await openPage(page, 'experiments');
  await page.locator('#speeds-2').click();
  await page.locator('#speeds-2').press('Control+A');
  await page.locator('#speeds-2').pressSequentially('300', { delay: 30 });
  await expect(page.locator('tbody tr').nth(8).locator('td').nth(1)).toHaveText('300');
  await openPage(page, 'cost');
  await page.locator('#weights-1').click();
  await page.locator('#weights-1').press('Control+A');
  await page.locator('#weights-1').pressSequentially('30', { delay: 30 });
  await expect(page.locator('#weightsTotal')).toHaveText('Current total: 105%');
  await expect(page.locator('#notice')).toContainText('add up to 105 %');
  await expect(page.locator('[data-region="ranking"] .blocked')).toBeVisible();
});

test('E7: change requests show which inputs they override', async ({ page }) => {
  await openPage(page, 'cost');
  await page.selectOption('#scenario', 'A');
  await openPage(page, 'simulator');
  await expect(page.locator('#raLimit')).toBeDisabled();
  await expect(page.locator('#raLimit')).toHaveValue('0.8');
  await expect(page.locator('#note-raLimit')).toContainText('Set by change request A');
  await expect(page.locator('#note-raLimit')).toContainText('Your value, 1.6 µm');

  await openPage(page, 'cost');
  await page.selectOption('#scenario', 'B');
  await expect(page.locator('#batch')).toBeDisabled();
  await expect(page.locator('#batch')).toHaveValue('3500');
  await expect(page.locator('#note-batch')).toContainText('Set by change request B');

  await page.selectOption('#scenario', 'C');
  await expect(page.locator('#life')).toBeEnabled();
  await expect(page.locator('#note-life')).toContainText('18.0 min/edge');
  await page.locator('#life').click();
  await page.locator('#life').press('Control+A');
  await page.locator('#life').pressSequentially('40', { delay: 30 });
  await expect(page.locator('#note-life')).toContainText('24.0 min/edge'); // live, 60 % of 40

  await page.selectOption('#scenario', 'BASE');
  await expect(page.locator('#batch')).toBeEnabled();
  await expect(page.locator('#batch')).toHaveValue('2000');
  await expect(page.locator('#note-batch')).toHaveCount(0);
});

test('E8: the overview challenge follows the inputs', async ({ page }) => {
  await expect(page.locator('#challenge')).toHaveText('A manufacturer must finish-turn 2,000 steel shafts from Ø50 to Ø49 mm across a 100 mm cutting length. Surface roughness must satisfy Ra ≤ 1.6 µm and machine input power must remain within 7.5 kW.');
  await openPage(page, 'simulator');
  await setNumber(page, '#initial', 60);
  await setNumber(page, '#final', 58.5);
  await openPage(page, 'cost');
  await page.selectOption('#scenario', 'A');
  await openPage(page, 'dashboard');
  await expect(page.locator('#challenge')).toContainText('from Ø60 to Ø58.5 mm');
  await expect(page.locator('#challenge')).toContainText('Ra ≤ 0.8 µm');
});

test('resetting experiment levels asks first', async ({ page }) => {
  await openPage(page, 'experiments');
  await setNumber(page, '#speeds-0', 120);
  page.once('dialog', d => d.dismiss());
  await page.click('#resetLevels');
  await expect(page.locator('#speeds-0')).toHaveValue('120');
  page.once('dialog', d => d.accept());
  await page.click('#resetLevels');
  await expect(page.locator('#speeds-0')).toHaveValue('100');
});

// ---- Stage 8: charts ----------------------------------------------------------------------

test('analysis page: map, response plots and trial charts, each with a data table', async ({ page }) => {
  await openPage(page, 'analysis');
  await expect(page.locator('#view svg.chart')).toHaveCount(1 + 4 + 7);
  await expect(page.locator('#view details.data-table')).toHaveCount(12);
  const ra = page.locator('.chart-card', { has: page.locator('#an-ra-t') });
  await ra.getByText('Show data table').click();
  await expect(ra.locator('table')).toBeVisible();
  await expect(ra.locator('tbody tr').nth(2).locator('td')).toHaveText(['3', '100', '0.20', '1.563', 'Yes']);
  await expect(page.locator('#an-map-d')).toHaveText(/9 of 9 trials and the live point lie in the feasible region\. Only the roughness limit/);
  await expect(page.locator('#resp-inputPower-t').locator('xpath=ancestor::div[contains(@class,"chart-card")]')).toContainText('Power limit 7.50 kW is far above every value shown');
});

test('charts follow the change request (scenario A)', async ({ page }) => {
  await openPage(page, 'cost');
  await page.selectOption('#scenario', 'A');
  await openPage(page, 'analysis');
  await expect(page.locator('#an-map-d')).toHaveText(/3 of 9 trials lie in the feasible region; the live point does not\./);
  await expect(page.locator('#an-ra-d')).toHaveText(/Dashed line: Ra limit 0\.80 µm\. Not feasible: trial 2, 3, 5, 6, 8, 9\./);
  await expect(page.locator('#an-cutTime-t').locator('xpath=ancestor::div[contains(@class,"chart-card")]')).toContainText('Pale bars with a dashed outline are not feasible.');
});

test('printing from the analysis page keeps element ids unique', async ({ page }) => {
  await page.evaluate(() => { window.print = () => {}; });
  await openPage(page, 'analysis');
  await page.click('#printBtn');
  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(duplicateIds).toEqual([]);
  await expect(page.locator('#report svg.chart')).toHaveCount(3);
});

// ---- Known defects from docs/AUDIT.md. `test.fail` asserts the bug still exists.
// (U1 was fixed in Stage 3 and S2 in Stage 4; both are now ordinary regression tests.)
// When a later stage fixes it, Playwright reports "expected to fail but passed",
// prompting removal of the marker so the test becomes a normal regression test.

test('U1 (fixed in Stage 3): keyboard focus survives tabbing between inputs', async ({ page }) => {
  await openPage(page, 'simulator');
  await page.locator('#liveSpeed').focus();
  await page.fill('#liveSpeed', '180');
  await page.keyboard.press('Tab');
  await expect(page.locator('#liveFeed')).toBeFocused({ timeout: 1000 });
  await expect(metric(page, 'Spindle speed')).toContainText('1,157'); // results updated too
  await page.keyboard.press('End');
  await page.keyboard.type('2');           // keep typing in the field we tabbed into
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#liveSpeed')).toBeFocused();
  await expect(page.locator('#liveFeed')).toHaveValue('0.152');
  // Same on the experiments and cost pages.
  await openPage(page, 'experiments');
  await page.locator('#speeds-0').focus();
  await page.fill('#speeds-0', '110');
  await page.keyboard.press('Tab');
  await expect(page.locator('#speeds-1')).toBeFocused();
  await openPage(page, 'cost');
  await page.locator('#weights-0').focus();
  await page.fill('#weights-0', '35');
  await page.keyboard.press('Tab');
  await expect(page.locator('#weights-1')).toBeFocused();
});

test('S2 (fixed in Stage 4): CSV neutralises spreadsheet formulas in student text', async ({ page }) => {
  await openPage(page, 'pbl');
  await page.fill('[data-text="observations"]', '=HYPERLINK("http://example.com","x")');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
  const csv = fs.readFileSync(await download.path(), 'utf8');
  // No cell may begin with a formula trigger, whatever its label.
  expect(csv).not.toMatch(/(^|,)"[=+\-@]/m);
});
