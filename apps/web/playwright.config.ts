import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    colorScheme: "light",
    locale: "fr-FR",
    timezoneId: "UTC",
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
      threshold: 0.2,
    },
  },
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  webServer: {
    command: "TREE_VISUAL_FIXTURE=1 pnpm dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/visual-fixtures/tree",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
