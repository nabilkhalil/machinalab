// Browser tests run against the deployable folder only (site/), served as static
// files the same way GitHub Pages serves them (tools/serve.js).
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
  // SwiftShader gives the 3D view software WebGL on CI machines without a GPU, so the same tests
  // run locally and in CI. (The no-WebGL fallback is tested separately by disabling WebGL.)
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } } }],
  webServer: {
    command: `node tools/serve.js ${PORT} site`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
