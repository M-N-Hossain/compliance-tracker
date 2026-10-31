// Drives the real app in a real browser: register, log in, set up a company, see the dashboard.
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { parse } from "dotenv";
import { assertTestDatabaseUrl } from "../support/database-guard";

// A new made-up user for each run, so runs do not collide. Synthetic data only.
const email = `smoke-${Date.now()}@example.test`;
const password = "fake-smoke-password";
const companyName = "Smoke Test Company";

test("a new user can register, log in and reach the dashboard", async ({ page }) => {
  // Company setup asks Gemini on the server. Answer in the browser, so Gemini is never called.
  await page.route("**/api/company/classify", (route) =>
    route.fulfill({
      json: { category: "digital_service", categories: ["digital_service", "food_beverage"] },
    }),
  );

  // Register. This logs the user in and moves on to company setup.
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/company\/setup/);

  // Sign out, so that the login form below is really tested.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  // Log in. With no company yet, the dashboard sends the user back to setup.
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/company\/setup/);

  // Set up the company. Saving it uses the real route and the real database.
  await page.getByLabel("Company name").fill(companyName);
  await page.getByLabel("What does your company do?").fill("We build software for small shops.");
  await page.getByRole("button", { name: "Suggest a business type" }).click();
  await page.getByRole("button", { name: "Save and build my checklist" }).click();

  // The dashboard shows this company and the checklist from the seed data.
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: companyName })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your compliance checklist" })).toBeVisible();
  await expect(page.getByText("GDPR data processing policy")).toBeVisible();
});

// Asks the test database directly, to prove the app really used it.
test.afterAll(async () => {
  const { DATABASE_URL } = parse(readFileSync(".env.test"));
  assertTestDatabaseUrl(DATABASE_URL);

  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const { rows } = await pool.query(
      'SELECT count(*)::int AS found FROM "User" WHERE email = $1',
      [email],
    );
    expect(rows[0].found, "the new user must be in the test database").toBe(1);
  } finally {
    await pool.end();
  }
});

// The app may catch a blocked call, so check the block's log as well.
test.afterEach(() => {
  const log = "test/support/.blocked-network.log";
  const blocked = existsSync(log) ? readFileSync(log, "utf8").trim() : "";
  expect(blocked, "the app's server tried to reach the network").toBe("");
});
