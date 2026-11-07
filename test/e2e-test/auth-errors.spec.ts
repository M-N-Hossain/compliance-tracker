// The failures are staged in the browser, so no real database outage is needed.
import { expect, test, type Page } from "@playwright/test";

const SERVER_MESSAGE = "Something went wrong on our side. Please try again in a moment.";

test("a server failure on login shows the server message and lets the user try again", async ({
  page,
}) => {
  // Answers the sign-in call the way Auth.js does when the server threw: error=Configuration.
  // The trailing * matters: signIn adds a query string to this address.
  await page.route("**/api/auth/callback/credentials*", (route) =>
    route.fulfill({
      json: { url: "http://localhost:3100/api/auth/error?error=Configuration" },
    }),
  );

  await page.goto("/login");
  await page.getByLabel("Email").fill("auth-errors@example.test");
  await page.getByLabel("Password").fill("fake-auth-errors-password");
  await page.getByRole("button", { name: "Log in" }).click();

  // Found by its text, because Next.js has its own hidden role="alert" element on every page.
  await expect(page.getByText(SERVER_MESSAGE)).toBeVisible();
  await expect(page.getByText("Wrong email or password.")).toHaveCount(0);

  await expect(page.getByRole("button", { name: "Log in" })).toBeEnabled();
});

async function submitRegisterForm(page: Page) {
  await page.goto("/register");
  await page.getByLabel("Email").fill("auth-errors-register@example.test");
  await page.getByLabel("Password").fill("fake-auth-errors-password");
  await page.getByRole("button", { name: "Create account" }).click();
}

test("a sign-up answer with no body shows the server message and lets the user try again", async ({
  page,
}) => {
  // The route fell over before it could write an answer: status 500 and an empty body.
  await page.route("**/api/register", (route) => route.fulfill({ status: 500, body: "" }));

  await submitRegisterForm(page);

  await expect(page.getByText(SERVER_MESSAGE)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
});

test("a failed automatic sign-in after sign-up stays on the page and explains it", async ({
  page,
}) => {
  // The account is created fine...
  await page.route("**/api/register", (route) =>
    route.fulfill({ json: { id: 1, email: "auth-errors-register@example.test" } }),
  );
  // ...but the automatic sign-in right after it fails on the server.
  await page.route("**/api/auth/callback/credentials*", (route) =>
    route.fulfill({
      json: { url: "http://localhost:3100/api/auth/error?error=Configuration" },
    }),
  );

  await submitRegisterForm(page);

  await expect(
    page.getByText("Your account was created, but we could not log you in. Please log in."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/register/);
});
