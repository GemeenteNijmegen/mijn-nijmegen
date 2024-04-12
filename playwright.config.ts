import type { PlaywrightTestConfig } from '@playwright/test';


const localProjects: any = [
  // Config for running tests in local
  // {
  //   name: "chrome",
  //   use: {
  //     browserName: "chromium",
  //     channel: "chrome",
  //   },
  // },
  // {
  //   name: "safari",
  //   use: {
  //     browserName: "webkit",
  //     viewport: { width: 1200, height: 750 },
  //   },
  // },
  {
    name: 'firefox',
    use: {
      browserName: 'firefox',
      viewport: { width: 1625, height: 1240 },
    },
  },
];

const lambdaTestProjects: any = [
  // -- LambdaTest Config --
  // name in the format: browserName:browserVersion:platform@lambdatest
  // Browsers allowed: `Chrome`, `MicrosoftEdge`, `pw-chromium`, `pw-firefox` and `pw-webkit`
  // Use additional configuration options provided by Playwright if required: https://playwright.dev/docs/api/class-testconfig
  {
    name: 'chrome:latest:MacOS Ventura@lambdatest',
    use: {
      viewport: { width: 1920, height: 1080 },
    },
  },
  // {
  //   name: "chrome:latest:Windows 11@lambdatest",
  //   use: {
  //     viewport: { width: 1280, height: 720 },
  //   },
  // },
  // {
  //   name: "MicrosoftEdge:109:MacOS Ventura@lambdatest",
  //   use: {
  //     ...devices["iPhone 12 Pro Max"],
  //   },
  // },
  // {
  //   name: "pw-firefox:latest:Windows 11@lambdatest",
  //   use: {
  //     viewport: { width: 1280, height: 720 },
  //   },
  // },
  // {
  //   name: "pw-webkit:latest:Windows 10@lambdatest",
  //   use: {
  //     viewport: { width: 1920, height: 1080 },
  //   },
  // },
];
/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config: PlaywrightTestConfig = {
  testDir: './test/playwright',
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'line' : [ [ 'html', { outputFolder: 'test/playwright/report' }] ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: (process.env?.LT_USERNAME && process.env?.LT_ACCESS_KEY) ? lambdaTestProjects : localProjects,
}
  
export default config;
