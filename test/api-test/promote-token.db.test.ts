// Fakes the login token, not getCurrentUser, so the real database lookup decides who is an admin.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { POST } from "@/app/api/admin/promote/route";
import { prisma } from "@/lib/prisma";
import { clearTestData, createUserWithoutCompany } from "@/test/support/test-data";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

// Synthetic data only.
const CALLER_EMAIL = "stale-token-caller@example.test";
const TARGET_EMAIL = "stale-token-target@example.test";

const fakeAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await clearTestData();
});

afterAll(async () => {
  await clearTestData();
  await prisma.$disconnect();
});

describe("POST /api/admin/promote with a stale admin token", () => {
  it("answers 403 when the token says admin but the database does not", async () => {
    const caller = await createUserWithoutCompany(CALLER_EMAIL);
    await createUserWithoutCompany(TARGET_EMAIL);
    fakeAuth.mockResolvedValue({ user: { id: String(caller.id), isAdmin: true } });

    const response = await POST(
      new Request("http://localhost/api/admin/promote", {
        method: "POST",
        body: JSON.stringify({ email: TARGET_EMAIL }),
      }),
    );

    expect(response.status).toBe(403);
    const target = await prisma.user.findUniqueOrThrow({ where: { email: TARGET_EMAIL } });
    expect(target.isAdmin).toBe(false);
  });
});
