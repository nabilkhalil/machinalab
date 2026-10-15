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

test('invalid diameters show a notice', async ({ page }) => {
  await openPage(page, 'simulator');
  await setNumber(page, '#final', 51);
  await expect(page.locator('#notice')).toBeVisible();
  await expect(page.locator('#notice')).toContainText('Initial diameter must exceed final diameter');
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
  expect(lines).toHaveLength(1 + 9 + 1 + 6);
  expect(lines[5]).toMatch(/^"5","150","0.15","0.5","964\.57541/);
  expect(csv).toContain('"Group","G1"');
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
// When a later stage fixes it, Playwright reports "expected to fail but passed",
// prompting removal of the marker so the test becomes a normal regression test.

test('U1: keyboard focus survives tabbing between inputs', async ({ page }) => {
  test.fail(true, 'AUDIT U1: full re-render on change destroys the focused field (Stage 3).');
  await openPage(page, 'simulator');
  await page.fill('#liveSpeed', '180');
  await page.keyboard.press('Tab');
  await expect(page.locator('#liveFeed')).toBeFocused({ timeout: 1000 });
});

test('S2: CSV neutralises spreadsheet formulas in student text', async ({ page }) => {
  test.fail(true, 'AUDIT S2: notes are exported raw (Stage 4).');
  await openPage(page, 'pbl');
  await page.fill('[data-text="observations"]', '=HYPERLINK("http://example.com","x")');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
  const csv = fs.readFileSync(await download.path(), 'utf8');
  expect(csv).not.toContain('"Observations","=');
});
