// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './playwright-tests',
  timeout: 15000,
  use: {
    channel: 'chrome',   // use system Google Chrome
    headless: true,
  },
});
