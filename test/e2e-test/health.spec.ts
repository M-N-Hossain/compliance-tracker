// Goes through proxy.ts on the real server, which the Vitest tests of the route skip.
import { expect, test } from "@playwright/test";

test("the health check answers without a login", async ({ request }) => {
  // A followed redirect could land on the 200 login page and pass by mistake.
  const response = await request.get("/api/health", { maxRedirects: 0 });

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
});
