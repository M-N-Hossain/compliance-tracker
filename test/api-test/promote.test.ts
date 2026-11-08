// The database is a fake that fails on purpose, so no Docker is needed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/promote/route";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { SERVER_ERROR_MESSAGE } from "@/utils/authMessages";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/currentUser", () => ({ getCurrentUser: vi.fn() }));

// Synthetic data only. A Prisma error message can quote the query, and so the email.
const EMAIL = "promote-unit@example.test";
const leakyError = Object.assign(
  new Error(`Invalid findUnique invocation: where: { email: "${EMAIL}" }`),
  { name: "PrismaClientKnownRequestError", code: "P1001" },
);

const currentUser = vi.mocked(getCurrentUser) as unknown as ReturnType<typeof vi.fn>;
const findUnique = vi.mocked(prisma.user.findUnique) as unknown as ReturnType<typeof vi.fn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  currentUser.mockReset();
  findUnique.mockReset();
  logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe("POST /api/admin/promote when the database fails", () => {
  // When the database is down, the login check is the first call to fail.
  it.each([
    ["the login check", () => currentUser.mockRejectedValue(leakyError)],
    [
      "the user lookup",
      () => {
        currentUser.mockResolvedValue({ id: 1, isAdmin: true });
        findUnique.mockRejectedValue(leakyError);
      },
    ],
  ])(
    "answers 500 with JSON when %s fails, and logs only the error's name and code",
    async (_, failDatabase) => {
      failDatabase();

      const response = await POST(
        new Request("http://localhost/api/admin/promote", {
          method: "POST",
          body: JSON.stringify({ email: EMAIL }),
        }),
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: SERVER_ERROR_MESSAGE });

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0]).toContain("PrismaClientKnownRequestError");
      expect(logSpy.mock.calls[0]).toContain("P1001");
      const logged = JSON.stringify(logSpy.mock.calls.flat().map(String));
      expect(logged).not.toContain(EMAIL);
    },
  );
});
