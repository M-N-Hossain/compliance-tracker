import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyCredentials } from "@/lib/verifyCredentials";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));

// Synthetic data only. A low bcrypt cost keeps the test fast.
const EMAIL = "guard-test@example.test";
const PASSWORD = "fake-guard-password";
const user = {
  id: 7,
  email: EMAIL,
  passwordHash: bcrypt.hashSync(PASSWORD, 4),
  isAdmin: false,
};

const findUnique = vi.mocked(prisma.user.findUnique) as unknown as ReturnType<typeof vi.fn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  findUnique.mockReset();
  logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe("verifyCredentials", () => {
  it("returns null and logs nothing for a wrong password", async () => {
    findUnique.mockResolvedValue(user);

    expect(await verifyCredentials(EMAIL, "not-the-password")).toBeNull();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("returns null and logs nothing for an unknown email", async () => {
    findUnique.mockResolvedValue(null);

    expect(await verifyCredentials("nobody@example.test", PASSWORD)).toBeNull();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("returns the user for the right email and password", async () => {
    findUnique.mockResolvedValue(user);

    expect(await verifyCredentials(EMAIL, PASSWORD)).toEqual({
      id: "7",
      email: EMAIL,
      isAdmin: false,
    });
  });

  it("throws on a database error and logs its name and code without the email or password", async () => {
    const dbError = Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" });
    findUnique.mockRejectedValue(dbError);

    // Not null: a server failure must not look like a wrong password. It is a new, plain error.
    const thrown = await verifyCredentials(EMAIL, PASSWORD).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBe(dbError);
    expect((thrown as Error).message).toBe("Login check failed (Error ECONNREFUSED)");

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

    const thrown = await verifyCredentials(EMAIL, PASSWORD).catch((e: unknown) => e);

    expect(logSpy.mock.calls[0]).toContain("PrismaClientValidationError");
    const logged = JSON.stringify(logSpy.mock.calls.flat().map(String));
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain(PASSWORD);

    // Review finding 12: Auth.js prints the thrown error's stack, which starts with its message.
    // So the thrown error must not carry the quoted email either.
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain(EMAIL);
    expect((thrown as Error).stack).not.toContain(EMAIL);
    expect((thrown as Error).stack).not.toContain(PASSWORD);
  });
});
