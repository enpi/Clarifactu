const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  expect: { timeout: 10000 },
  use: { screenshot: 'only-on-failure', video: 'retain-on-failure' },
  reporter: [['list'], ['html', { open: 'never' }]],
});
