// What a user sees on the login and sign-up pages when the server fails.
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

  // The user is told it is the server, and is not told the password is wrong.
  // Found by its text, because Next.js has its own hidden role="alert" element on every page.
  await expect(page.getByText(SERVER_MESSAGE)).toBeVisible();
  await expect(page.getByText("Wrong email or password.")).toHaveCount(0);

  // The button is back to "Log in" and can be pressed again.
  await expect(page.getByRole("button", { name: "Log in" })).toBeEnabled();
});

// Fills in the sign-up form with made-up values and presses the button.
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

  // The page shows the server message instead of hanging on "Creating account...".
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

  // The user is told the account exists and what to do, and is not sent away silently.
  await expect(
    page.getByText("Your account was created, but we could not log you in. Please log in."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/register/);
});
