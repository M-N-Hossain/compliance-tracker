// When the AI cannot suggest a business type, the user must still be able to choose one.
// Only /api/company/classify is answered in the browser, so Gemini is never called.
// Saving uses the real /api/company route and the real test database.
import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const FALLBACK_MESSAGE =
  "The AI suggestion is not available right now. Choose your business type yourself.";
const NETWORK_MESSAGE = "Could not reach the server. Please try again.";
const CATEGORIES = ["digital_service", "food_beverage"];
const DESCRIPTION = "We run a small bakery that sells bread.";

// A new made-up user for each test, so tests do not collide. Synthetic data only.
async function registerAndOpenSetup(page: Page) {
  const email = `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("fake-fallback-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/company\/setup/);
  await page.getByLabel("Company name").fill("Fallback Test Company");
  await page.getByLabel("What does your company do?").fill(DESCRIPTION);
}

const suggest = (page: Page) => page.getByRole("button", { name: "Suggest a business type" });
const save = (page: Page) => page.getByRole("button", { name: "Save and build my checklist" });
// Next.js adds its own hidden alert element, so look inside the form only.
const formError = (page: Page) => page.locator("form").getByRole("alert");

test("when the AI fails, the user chooses a business type and reaches the right checklist", async ({
  page,
}) => {
  await page.route("**/api/company/classify", (route) =>
    route.fulfill({
      status: 502,
      json: { error: "The AI service failed.", categories: CATEGORIES },
    }),
  );
  await registerAndOpenSetup(page);
  await suggest(page).click();

  // The step opens with the message and nothing chosen for the user.
  await expect(page.getByText(FALLBACK_MESSAGE)).toBeVisible();
  const dropdown = page.getByLabel("Business type");
  await expect(dropdown).toHaveValue("");
  await expect(dropdown.locator("option", { hasText: "Choose a business type" })).toBeDisabled();
  await expect(save(page)).toBeDisabled();

  // Choosing a type is what enables Save.
  await dropdown.selectOption("food_beverage");
  await expect(save(page)).toBeEnabled();
  await save(page).click();

  // The checklist belongs to the chosen category, not to the first one in the list.
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Food safety certification (HACCP)")).toBeVisible();
  await expect(page.getByText("Accessibility compliance statement")).toHaveCount(0);
});

for (const [status, error] of [
  [400, "Please describe what your company does (at least 10 characters)."],
  [401, "Not logged in."],
] as const) {
  test(`a ${status} from classify shows its message and no fallback`, async ({ page }) => {
    await page.route("**/api/company/classify", (route) =>
      route.fulfill({ status, json: { error } }),
    );
    await registerAndOpenSetup(page);
    await suggest(page).click();

    await expect(formError(page)).toHaveText(error);
    await expect(page.getByLabel("Business type")).toHaveCount(0);
    await expect(page.getByText(FALLBACK_MESSAGE)).toHaveCount(0);
  });
}

test("when the request itself fails, the button recovers and an error shows", async ({ page }) => {
  await page.route("**/api/company/classify", (route) => route.abort());
  await registerAndOpenSetup(page);
  await suggest(page).click();

  await expect(formError(page)).toHaveText(NETWORK_MESSAGE);
  await expect(suggest(page)).toBeEnabled();
});

test("asking the AI again after the fallback works as before, and leaves no old choice behind", async ({
  page,
}) => {
  // First the AI fails, then it answers, then it fails again.
  const answers = [
    { status: 502, json: { error: "The AI service failed.", categories: CATEGORIES } },
    { status: 200, json: { category: "digital_service", categories: CATEGORIES } },
    { status: 502, json: { error: "The AI service failed.", categories: CATEGORIES } },
  ];
  await page.route("**/api/company/classify", (route) =>
    route.fulfill(answers.shift() ?? { status: 500, json: { error: "unexpected extra call" } }),
  );
  await registerAndOpenSetup(page);

  await suggest(page).click();
  await expect(page.getByText(FALLBACK_MESSAGE)).toBeVisible();
  await page.getByLabel("Business type").selectOption("food_beverage");

  // Editing the description sends the user back to the first step.
  await page.getByLabel("What does your company do?").fill(`${DESCRIPTION} We also deliver.`);
  await suggest(page).click();
  await expect(page.getByLabel("Business type")).toHaveValue("digital_service");
  await expect(page.getByText(FALLBACK_MESSAGE)).toHaveCount(0);

  await page.getByLabel("What does your company do?").fill(`${DESCRIPTION} We also ship.`);
  await suggest(page).click();
  await expect(page.getByText(FALLBACK_MESSAGE)).toBeVisible();
  await expect(page.getByLabel("Business type")).toHaveValue("");
  await expect(save(page)).toBeDisabled();
});

// The app may catch a blocked call, so check the block's log as well.
test.afterEach(() => {
  const log = "test/support/.blocked-network.log";
  const blocked = existsSync(log) ? readFileSync(log, "utf8").trim() : "";
  expect(blocked, "the app's server tried to reach the network").toBe("");
});
