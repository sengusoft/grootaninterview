import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const profile = process.env.RUN_PROFILE === 'baseline' ? 'baseline' : 'current';
const jsonOutput = path.join('reports', profile, 'results.json');
fs.mkdirSync(path.dirname(jsonOutput), { recursive: true });

export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: jsonOutput }],
    ['list'],
  ],
  use: {
    baseURL: process.env.CONTACT_LIST_BASE_URL ?? 'https://thinking-tester-contact-list.herokuapp.com',
    trace: 'retain-on-failure',
    video: 'on',
    screenshot: 'on',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
