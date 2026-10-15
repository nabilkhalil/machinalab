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
  await expect(page.locator('.status')).toHaveText('FEASIBLE');
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
  await expect(page.locator('.blocked')).toContainText('No predictions yet');
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
  await expect(page.locator('.status')).toHaveText('NOT FEASIBLE'); // results still shown
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

test('CSV export contains trials and notes', async ({ page }) => {
  await openPage(page, 'pbl');
  await page.fill('[data-text="group"]', 'G1');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
  expect(download.suggestedFilename()).toBe('MMT15603_MachinaLab_Results.csv');
  const csv = fs.readFileSync(await download.path(), 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM so Excel reads µ correctly
  const lines = csv.slice(1).split('\r\n');
  expect(lines[0]).toContain('"Trial","Vc_m_min","Feed_mm_rev"');
  expect(lines[0]).toContain('"Tool_cost_RM_part","Batch_cycle_hours","Cost_T15_RM_part"');
  // header + 9 trials + blank + student/group/scenario + 9 workbook prompts
  expect(lines).toHaveLength(1 + 9 + 1 + 3 + 9);
  expect(lines[5]).toMatch(/^"5","150","0.15","0.5","964\.57541/);
  expect(csv).toContain('"Group / members","G1"');
  expect(csv).toContain('"Effect of feed on Ra",""');
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

test('print layout hides navigation', async ({ page }) => {
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('#view')).toBeVisible();
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

// ---- Known defects from docs/AUDIT.md. `test.fail` asserts the bug still exists.
// (U1 was fixed in Stage 3 and is now an ordinary regression test.)
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

test('S2: CSV neutralises spreadsheet formulas in student text', async ({ page }) => {
  test.fail(true, 'AUDIT S2: notes are exported raw (Stage 4).');
  await openPage(page, 'pbl');
  await page.fill('[data-text="observations"]', '=HYPERLINK("http://example.com","x")');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
  const csv = fs.readFileSync(await download.path(), 'utf8');
  // No cell may begin with a formula trigger, whatever its label.
  expect(csv).not.toMatch(/(^|,)"[=+\-@]/m);
});
