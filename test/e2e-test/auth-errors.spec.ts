// What a user sees on the login and sign-up pages when the server fails.
// The failures are staged in the browser, so no real database outage is needed.
import { expect, test } from "@playwright/test";

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
