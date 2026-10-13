import { createRequire } from 'node:module';
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';
const base = createRequire(__filename)('./playwright.config.js') as PlaywrightTestConfig;
export default defineConfig({
  ...base,
  testMatch: [
    '**/meeting-link-admission.spec.ts',
    '**/meeting-tablet-recovery.spec.ts',
    '**/meeting-roles-audio.spec.ts',
  ],
  projects: [
    { name: 'ipad-webkit', use: { ...devices['iPad Pro 11'], browserName: 'webkit' } },
    {
      name: 'android-tablet-chromium',
      use: { ...devices['Galaxy Tab S4'], browserName: 'chromium' },
    },
  ],
});
