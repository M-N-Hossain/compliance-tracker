import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { parse } from "dotenv";
import { assertTestDatabaseUrl } from "./test/support/database-guard";

// Fake values only. These beat the real .env, because values already set win over the file.
const env = parse(readFileSync(".env.test"));

// Checked here, so nothing starts at all if the address is wrong.
assertTestDatabaseUrl(env.DATABASE_URL);

// Its own port, so it can never be confused with a dev server on 3000.
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "test/e2e-test",
  // Prepares the test database before the first test.
  globalSetup: "./test/support/playwright-global-setup.ts",
  // One browser at a time, against one shared database.
  workers: 1,
  // A smoke test that needs a retry is reporting a real problem.
  retries: 0,
  // next dev compiles each route on first use, so pages can take many seconds the first time.
  timeout: 180_000,
  expect: { timeout: 45_000 },
  use: {
    baseURL,
    // Keeps a recording only when a test fails, for finding out why.
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `${baseURL}/login`,
    // Never reuse a running server: it could be connected to the development database.
    reuseExistingServer: false,
    // The first page compile can be slow.
    timeout: 120_000,
    env: {
      ...env,
      // Auth.js refuses to run unless told to trust the Host header.
      AUTH_TRUST_HOST: "true",
      NEXT_TELEMETRY_DISABLED: "1",
      // Loads the network block inside the app's server too.
      NODE_OPTIONS: "--import=./test/support/block-server-network.mjs",
    },
  },
});
