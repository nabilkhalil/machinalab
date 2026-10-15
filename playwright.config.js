// Browser tests run against the deployable folder only (site/), served as static
// files the same way GitHub Pages serves them.
'use strict';
const { defineConfig, devices } = require('@playwright/test');

const PORT = 8765;

module.exports = defineConfig({
  testDir: 'tests/browser',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `python -m http.server ${PORT} --bind 127.0.0.1 -d site`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: false,
    stderr: 'ignore', // http.server logs every request to stderr
    timeout: 30000,
  },
});
