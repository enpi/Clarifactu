/**
 * Playwright fixtures for Electron E2E tests.
 * Provides `app` (ElectronApplication) and `window` (Page) fixtures.
 */

const { test: base, expect } = require('@playwright/test');
const { _electron: electron } = require('@playwright/test');
const path = require('path');

const test = base.extend({
  app: async ({}, use) => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../../main.js')],
      env: { ...process.env, NODE_ENV: 'test' }
    });
    await use(electronApp);
    await electronApp.close();
  },

  window: async ({ app }, use) => {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    // Allow time for the renderer to fully initialize and render the dashboard
    await page.waitForTimeout(1500);
    await use(page);
  }
});

module.exports = { test, expect };
