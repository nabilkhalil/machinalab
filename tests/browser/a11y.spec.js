// Automated accessibility checks (axe-core, WCAG 2.2 A/AA rules) on every page and in key states.
// Automated tools find roughly a third of accessibility problems; the keyboard and screen-reader
// behaviour tests in smoke.spec.js cover more, and a manual check is still recommended.
'use strict';
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const PAGES = ['dashboard', 'simulator', 'experiments', 'analysis', 'cost', 'pbl', 'models'];

async function violations(page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return result.violations.map(v => ({
    id: v.id, impact: v.impact, help: v.help,
    nodes: v.nodes.slice(0, 5).map(n => n.target.join(' ')),
    count: v.nodes.length,
  }));
}

test.beforeEach(async ({ page }) => {
  await page.goto('index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

for (const name of PAGES) {
  test(`no WCAG A/AA violations: ${name}`, async ({ page }) => {
    await page.click(`#nav button[data-page="${name}"]`);
    expect(await violations(page)).toEqual([]);
  });
}

test('no WCAG A/AA violations with errors, warnings and overrides showing', async ({ page }) => {
  await page.click('#nav button[data-page="cost"]');
  await page.selectOption('#scenario', 'B');
  await page.fill('#weights-0', '20');
  await page.locator('#weights-0').dispatchEvent('change');
  await page.click('#nav button[data-page="simulator"]');
  await page.fill('#final', '55');
  await page.locator('#final').dispatchEvent('change');
  await page.fill('#liveFeed', '0.9');
  await page.locator('#liveFeed').dispatchEvent('change');
  await expect(page.locator('#notice')).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('no WCAG A/AA violations at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const name of ['dashboard', 'simulator', 'cost']) {
    await page.click(`#nav button[data-page="${name}"]`);
    expect(await violations(page), name).toEqual([]);
  }
});

// ---- Content-Security-Policy (index.html <meta>) ------------------------------------------
const path = require('path');

async function exerciseEverything(page) {
  await page.evaluate(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', e => window.__cspViolations.push(`${e.violatedDirective}: ${e.blockedURI}`));
    window.print = () => {};
  });
  for (const name of PAGES) await page.click(`#nav button[data-page="${name}"]`);
  await page.click('#nav button[data-page="simulator"]');
  await page.fill('#liveSpeed', '180');
  await page.locator('#liveSpeed').dispatchEvent('input');
  await page.waitForTimeout(250);
  await page.click('#printBtn');                       // report with SVG charts
  await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);  // blob download
  await page.click('#nav button[data-page="pbl"]');
  await Promise.all([page.waitForEvent('download'), page.click('#saveProgress')]);
  return page.evaluate(() => window.__cspViolations);
}

test('CSP: the whole app runs with no policy violations (http)', async ({ page }) => {
  expect(await exerciseEverything(page)).toEqual([]);
});

test('CSP: the whole app runs with no policy violations (file://, double-click)', async ({ page }) => {
  const file = path.resolve(__dirname, '..', '..', 'site', 'index.html').split(path.sep).join('/');
  await page.goto('file:///' + file.replace(/^\//, ''));
  expect(await exerciseEverything(page)).toEqual([]);
});

test('CSP is enforced: injected inline script and inline style are blocked', async ({ page }) => {
  const result = await page.evaluate(() => {
    const s = document.createElement('script');
    s.textContent = 'window.__inlineRan = true';
    document.head.appendChild(s);
    const d = document.createElement('div');
    d.innerHTML = '<p id="styled" style="color: rgb(255, 0, 0)">x</p><img src="x" onerror="window.__handlerRan = true">';
    document.body.appendChild(d);
    return new Promise(r => setTimeout(() => r({
      inline: window.__inlineRan === true,
      handler: window.__handlerRan === true,
      red: getComputedStyle(document.getElementById('styled')).color === 'rgb(255, 0, 0)',
    }), 300));
  });
  expect(result).toEqual({ inline: false, handler: false, red: false });
});

// ---- Keyboard and screen-reader behaviour -----------------------------------------------
test('choosing a page marks it current and moves focus to its heading', async ({ page }) => {
  await page.locator('#nav button[data-page="cost"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#pageTitle')).toBeFocused();
  await expect(page.locator('#pageTitle')).toHaveText('Cost & Decision Analysis');
  await expect(page.locator('#nav button[aria-current="page"]')).toHaveCount(1);
  await expect(page.locator('#nav button[data-page="cost"]')).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Tab'); // next stop is inside the page content area, not back in the menu
  expect(await page.evaluate(() => !!document.activeElement.closest('main'))).toBe(true);
});

test('skip link is the first Tab stop and jumps to the main heading', async ({ page }) => {
  await page.keyboard.press('Tab');
  const skip = page.locator('.skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#pageTitle')).toBeFocused();
});

test('decorative glyphs are hidden from screen readers and nav has a name', async ({ page }) => {
  await expect(page.getByRole('navigation', { name: 'Pages' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Live Simulator', exact: true })).toBeVisible(); // no "⚙" in the name
  await page.click('#nav button[data-page="analysis"]');
  await expect(page.getByRole('img', { name: /^Ideal surface roughness, bar chart of the nine trials\. Lowest 0\.391 µm \(trial 1, 4, 7\), highest 1\.563 µm \(trial 3, 6, 9\)\.$/ })).toBeVisible();
});

test('wide tables can be scrolled with the keyboard on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.click('#nav button[data-page="experiments"]');
  const region = page.getByRole('region', { name: 'Predicted machining results table' });
  await region.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(await region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
});
