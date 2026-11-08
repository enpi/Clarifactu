/**
 * Playwright fixtures for Electron E2E tests.
 * Provides `app` (ElectronApplication) and `window` (Page) fixtures.
 *
 * Each worker gets its own throwaway data folder with a valid test license, so the
 * tests never touch the real data in %APPDATA%/Clarifactu and never hit the
 * activation screen. Tests in the same file share it (they build on each other).
 * The window stays hidden so test runs don't pop windows up on screen.
 */

const { test: base, expect } = require('@playwright/test');
const { _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { generateKey } = require('../../scripts/generate-key');

// First window of a launched app, past the onboarding wizard a fresh data folder starts in
async function openReadyWindow(app) {
  const page = await app.firstWindow();
  // Since Electron 45 the window is handed over blank, before index.html loads
  await page.waitForURL(/index\.html$/);
  await page.waitForLoadState('domcontentloaded');
  const onboarded = await page.evaluate(() => window.api.settings.isOnboardingDone());
  if (!onboarded) {
    await page.evaluate(() => window.api.settings.markOnboardingDone());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  }
  await page.waitForSelector('.page-title');
  return page;
}

// selectOption() needs an exact label: pick the option whose text contains `text`
async function selectOptionContaining(select, text) {
  const value = await select.locator('option', { hasText: text }).first().getAttribute('value');
  await select.selectOption(value);
}

const test = base.extend({
  userDataDir: [async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clarifactu-e2e-'));
    fs.writeFileSync(path.join(dir, 'license.json'), JSON.stringify({
      activated: true, key: generateKey(), activatedAt: new Date().toISOString()
    }));
    await use(dir);
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }, { scope: 'worker' }],

  app: async ({ userDataDir }, use) => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../../main.js')],
      env: { ...process.env, NODE_ENV: 'test', CLARIFACTU_USER_DATA: userDataDir, CLARIFACTU_HIDE_WINDOW: '1' }
    });
    await use(electronApp);
    await electronApp.close();
  },

  window: async ({ app }, use) => {
    await use(await openReadyWindow(app));
  }
});

module.exports = { test, expect, openReadyWindow, selectOptionContaining };
