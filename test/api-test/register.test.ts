// The sign-up desk when the records room is flooded: a clear answer, a log line, no secrets in it.
// The database is a fake that fails on purpose, so no Docker is needed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/register/route";
import { prisma } from "@/lib/prisma";
import { SERVER_ERROR_MESSAGE } from "@/lib/authMessages";

// A fake prisma. Only the two calls the route makes are needed.
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
}));

// Synthetic data only.
const EMAIL = "register-test@example.test";
const PASSWORD = "fake-register-password";

const findUnique = vi.mocked(prisma.user.findUnique) as unknown as ReturnType<typeof vi.fn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  findUnique.mockReset();
  // Replaces console.error, so the test can read what was logged and the output stays clean.
  logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

// Sends a sign-up request the way the register page does.
function register() {
  return POST(
    new Request("http://localhost/api/register", {
      method: "POST",
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    }),
  );
}

describe("POST /api/register when the database fails", () => {
  // Criterion 5 and the sign-up half of criterion 10.
  it("answers 500 with the server message, logs the error, and keeps the email and password out of the log", async () => {
    const dbError = new Error("connection refused");
    findUnique.mockRejectedValue(dbError);

    const response = await register();

    // A calm answer the page can read, with no internal error text in it.
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: SERVER_ERROR_MESSAGE });

    // The real error is logged...
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]).toContain(dbError);

    // ...and nothing logged contains the email or the password.
    const logged = JSON.stringify(logSpy.mock.calls.flat().map(String));
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain(PASSWORD);
  });
});
