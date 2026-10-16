// 3D turning view on the Live Simulator page (Stage 9): synchronisation with the inputs,
// illustration vs prediction labelling, reduced motion, the no-WebGL fallback, and accessibility.
'use strict';
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const path = require('path');

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function openSimulator(page) {
  await page.click('#nav button[data-page="simulator"]');
  await page.waitForSelector('#latheHost canvas', { timeout: 15000 });
}

const readout = page => page.locator('.lathe-readout');
const canvasShot = page => page.locator('#latheHost canvas').screenshot();

test.beforeEach(async ({ page }) => {
  await page.goto('index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('the 3D view loads only when the simulator opens, without errors', async ({ page }) => {
  const errors = watchErrors(page);
  expect(await page.evaluate(() => typeof window.THREE)).toBe('undefined');
  await openSimulator(page);
  expect(await page.evaluate(() => window.THREE.REVISION)).toBe('159');
  await expect(page.locator('.lathe-card .pill.illus').first()).toHaveText('ILLUSTRATION · NOT TO SCALE');
  expect(errors).toEqual([]);
});

test('typing while the 3D view loads keeps the input box and its caret', async ({ page }) => {
  // Hold Three.js back so the load finishes in the middle of typing (this raced on CI).
  let release;
  const gate = new Promise(r => { release = r; });
  await page.route('**/three.min.js*', async route => { await gate; await route.continue(); });
  await page.click('#nav button[data-page="simulator"]');
  const box = page.locator('#final');
  await box.evaluate(el => { el.dataset.marker = 'same'; });
  await box.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('4');
  release();
  await page.waitForSelector('#latheHost canvas', { timeout: 15000 });
  await page.keyboard.type('8');
  await expect(box).toHaveValue('48');
  await expect(box).toHaveAttribute('data-marker', 'same');   // the box was never rebuilt
  await expect(box).toBeFocused();
  await expect(page.locator('#latheToggle')).toHaveText('Pause');
});

test('the readout shows model predictions, matching the baseline at defaults', async ({ page }) => {
  await openSimulator(page);
  await expect(readout(page)).toContainText('MODEL PREDICTION');
  await expect(readout(page)).toContainText('965 rev/min');
  await expect(readout(page)).toContainText('41.5 s');
  await expect(readout(page)).toContainText('0.879 µm');
  await expect(readout(page)).toContainText('FEASIBLE');
  // The illustration panel spells out every scale factor.
  await expect(readout(page)).toContainText('1/10 of the predicted spindle speed');
  await expect(readout(page)).toContainText('drawn 6 times deeper');
});

test('moving the feed slider updates the number box, readout and picture description', async ({ page }) => {
  await openSimulator(page);
  await page.locator('#liveFeed-slider').fill('0.3');
  await expect(page.locator('#liveFeed')).toHaveValue('0.3');
  await expect(readout(page)).toContainText('0.30 mm/rev');
  await expect(readout(page)).toContainText('3.516 µm');      // 1000·0.3²/(32·0.8)
  await expect(readout(page)).toContainText('NOT FEASIBLE');
  await expect(page.locator('#latheHost canvas')).toHaveAttribute('aria-label', /0\.3 mm per revolution/);
  await expect(page.locator('.lathe-readout')).toContainText('one fifth of the predicted cutting time of 20.7 s');
});

test('typing a cutting speed updates the slider and the spindle speed', async ({ page }) => {
  await openSimulator(page);
  await page.fill('#liveSpeed', '300');
  await page.locator('#liveSpeed').dispatchEvent('input');
  await expect(page.locator('#liveSpeed-slider')).toHaveValue('300');
  await expect(readout(page)).toContainText('1,929 rev/min');
});

test('the animation runs, and Pause stops it', async ({ page }) => {
  await openSimulator(page);
  await expect(page.locator('#latheToggle')).toHaveText('Pause');
  const a = await canvasShot(page);
  await page.waitForTimeout(400);
  const b = await canvasShot(page);
  expect(a.equals(b)).toBe(false);
  await page.click('#latheToggle');
  await expect(page.locator('#latheToggle')).toHaveText('Play');
  await page.waitForTimeout(100);
  const c = await canvasShot(page);
  await page.waitForTimeout(400);
  const d = await canvasShot(page);
  expect(c.equals(d)).toBe(true);
});

test('reduced motion (system setting) shows a still picture until Play is pressed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await openSimulator(page);
  await expect(page.locator('#latheToggle')).toHaveText('Play');
  const a = await canvasShot(page);
  await page.waitForTimeout(400);
  const b = await canvasShot(page);
  expect(a.equals(b)).toBe(true);
});

test('the reduce-motion choice is remembered without touching the student work', async ({ page }) => {
  await openSimulator(page);
  await page.check('#prefReduceMotion');
  await expect(page.locator('#latheToggle')).toHaveText('Play');
  const stored = await page.evaluate(() => ({
    prefs: localStorage.getItem('machinalab:mmt15603:prefs:v1'),
    keys: Object.keys(localStorage).sort(),
  }));
  expect(JSON.parse(stored.prefs)).toEqual({ reduceMotion: true, showArrows: true });
  await page.reload();
  await openSimulator(page);
  await expect(page.locator('#prefReduceMotion')).toBeChecked();
  await expect(page.locator('#latheToggle')).toHaveText('Play');
});

test('tampered preferences are ignored', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('machinalab:mmt15603:prefs:v1', '{"reduceMotion":"<img src=x>"'));
  await page.reload();
  await openSimulator(page);
  await expect(page.locator('#prefReduceMotion')).not.toBeChecked();
});

test('invalid inputs grey out the view and hide the predictions', async ({ page }) => {
  await openSimulator(page);
  await page.fill('#final', '55');
  await page.locator('#final').dispatchEvent('change');
  await expect(page.locator('#latheHost')).toHaveClass(/is-blocked/);
  await expect(readout(page)).toContainText('No 3D view yet');
  await expect(readout(page)).not.toContainText('rev/min');
  await expect(page.locator('#latheHost canvas')).toHaveAttribute('aria-label', /paused/);
});

test('the canvas survives re-rendering and returning to the page', async ({ page }) => {
  await openSimulator(page);
  await page.evaluate(() => { document.querySelector('#latheHost canvas').dataset.marker = 'same'; });
  await page.click('#nav button[data-page="models"]');
  await expect(page.locator('h2', { hasText: 'About the 3D turning view' })).toBeVisible();
  await openSimulator(page);
  await expect(page.locator('#latheHost canvas')).toHaveAttribute('data-marker', 'same');
  await expect(page.locator('#latheHost canvas')).toHaveCount(1);
});

test('view buttons work from the keyboard', async ({ page }) => {
  await openSimulator(page);
  await page.click('#latheToggle');                             // pause, so frames are stable
  const before = await canvasShot(page);
  await page.getByRole('button', { name: 'Rotate view left' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  const after = await canvasShot(page);
  expect(before.equals(after)).toBe(false);
});

test('the labelled schematic opens and stays open after an input change', async ({ page }) => {
  await openSimulator(page);
  await page.click('#latheSchematicBox summary');
  await expect(page.getByRole('img', { name: /Turning schematic \(side view\)/ })).toBeVisible();
  await page.fill('#liveFeed', '0.2');
  await page.locator('#liveFeed').dispatchEvent('change');
  await expect(page.locator('#latheSchematicBox')).toHaveAttribute('open', '');
  await expect(page.locator('#latheSchematicBox')).toContainText('f = 0.2 mm/rev');
});

test('direction arrows: legend with model values, and a remembered on/off switch', async ({ page }) => {
  await openSimulator(page);
  const legend = page.locator('.arrow-legend');
  await expect(legend).toContainText('Cutting speed, Vc: The bar surface moves down past the tool tip at 150 m/min');
  await expect(legend).toContainText('Feed, f: The tool moves along the bar towards the chuck by 0.15 mm');
  await expect(legend).toContainText('Depth of cut, ap');
  await expect(legend).toContainText('135.0 N');
  await expect(legend).toContainText('lengths are not to scale');
  // The legend follows the inputs while typing.
  await page.fill('#liveFeed', '0.2');
  await page.locator('#liveFeed').dispatchEvent('input');
  await expect(legend).toContainText('180.0 N');                 // 1800 × 0.5 × 0.2
  // Switching the arrows off changes the picture and is remembered.
  await page.click('#latheToggle');                                // pause for stable frames
  await expect(page.locator('#prefShowArrows')).toBeChecked();
  const withArrows = await canvasShot(page);
  await page.uncheck('#prefShowArrows');
  await page.waitForTimeout(100);
  expect(withArrows.equals(await canvasShot(page))).toBe(false);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('machinalab:mmt15603:prefs:v1')))).toEqual({ reduceMotion: false, showArrows: false });
  await page.reload();
  await openSimulator(page);
  await expect(page.locator('#prefShowArrows')).not.toBeChecked();
});

test('without WebGL the labelled schematic replaces the 3D view', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      return /webgl/.test(type) ? null : original.call(this, type, ...rest);
    };
  });
  await page.reload();
  await page.click('#nav button[data-page="simulator"]');
  await expect(page.locator('.lathe-fallback')).toBeVisible();
  await expect(page.locator('.lathe-fallback').getByRole('img', { name: /Turning schematic/ })).toBeVisible();
  await expect(page.getByText('The 3D view cannot run on this computer')).toBeVisible();
  await expect(page.locator('#latheToggle')).toHaveCount(0);
  // The still picture's notes do not talk about rotation or timing.
  await expect(readout(page)).not.toContainText('spindle is drawn');
  expect(errors).toEqual([]);
});

test('no WCAG A/AA violations with the 3D view loaded', async ({ page }) => {
  await openSimulator(page);
  await page.click('#latheSchematicBox summary');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
});

test('no horizontal page scroll at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await openSimulator(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('works when opened by double-click (file://)', async ({ page }) => {
  const errors = watchErrors(page);
  const file = path.resolve(__dirname, '..', '..', 'site', 'index.html').split(path.sep).join('/');
  await page.goto('file:///' + file.replace(/^\//, ''));
  await openSimulator(page);
  await expect(readout(page)).toContainText('965 rev/min');
  expect(errors).toEqual([]);
});
