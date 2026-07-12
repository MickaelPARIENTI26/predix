import { defineConfig, devices } from "@playwright/test";

// Locally: fast dev server. In CI: the production build (npm run build first).
const isCI = !!process.env.CI;

// Dedicated port: 3000 is often taken by another project's dev server, and
// reuseExistingServer would silently test the wrong app.
const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: isCI
      ? `npm run start -- --port ${PORT}`
      : `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
