// The database is a fake that fails on purpose, so no Docker is needed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/register/route";
import { prisma } from "@/lib/prisma";
import { SERVER_ERROR_MESSAGE } from "@/utils/authMessages";

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
  logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

function register() {
  return POST(
    new Request("http://localhost/api/register", {
      method: "POST",
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    }),
  );
}

describe("POST /api/register when the database fails", () => {
  it("answers 500 with the server message, logs the error's name and code, and keeps the email and password out of the log", async () => {
    const dbError = Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" });
    findUnique.mockRejectedValue(dbError);

    const response = await register();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: SERVER_ERROR_MESSAGE });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]).toContain("Error");
    expect(logSpy.mock.calls[0]).toContain("ECONNREFUSED");

    const logged = JSON.stringify(logSpy.mock.calls.flat().map(String));
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain(PASSWORD);
  });

  // Review finding 1: a Prisma error can quote the query, so the message must never be logged.
  it("keeps the email out of the log even when the error message quotes it", async () => {
    const leaky = Object.assign(
      new Error(`Invalid findUnique invocation: where: { email: "${EMAIL}" }`),
      { name: "PrismaClientValidationError" },
    );
    findUnique.mockRejectedValue(leaky);

    const response = await register();

    expect(response.status).toBe(500);

    expect(logSpy.mock.calls[0]).toContain("PrismaClientValidationError");
    const logged = JSON.stringify(logSpy.mock.calls.flat().map(String));
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain(PASSWORD);
  });
});
