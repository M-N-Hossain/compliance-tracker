// Calls the promote route against the real test database, so each test can check the row itself.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/promote/route";
import { prisma } from "@/lib/prisma";
import { clearTestData, createUserWithoutCompany, logInAs } from "@/test/support/test-data";

// Vitest cannot produce a real login session, so the logged-in user is chosen by each test.
vi.mock("@/lib/currentUser", () => ({ getCurrentUser: vi.fn() }));

// Synthetic data only.
const ADMIN_EMAIL = "promote-admin@example.test";
const TARGET_EMAIL = "promote-target@example.test";
const OTHER_EMAIL = "promote-other@example.test";

function promote(email: string) {
  return POST(
    new Request("http://localhost/api/admin/promote", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  );
}

async function isAdminInDatabase(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return user.isAdmin;
}

beforeEach(async () => {
  await clearTestData();
});

afterAll(async () => {
  await clearTestData();
  await prisma.$disconnect();
});

describe("POST /api/admin/promote by an admin", () => {
  it("makes the user an admin and says they must log in again", async () => {
    logInAs(await createUserWithoutCompany(ADMIN_EMAIL, true));
    await createUserWithoutCompany(TARGET_EMAIL);

    const response = await promote(TARGET_EMAIL);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("promoted");
    expect(body.message).toMatch(/log out and in again/i);
    expect(await isAdminInDatabase(TARGET_EMAIL)).toBe(true);
  });
});

describe("POST /api/admin/promote by someone who is not an admin", () => {
  it("answers 401 with no login, and the target stays a non-admin", async () => {
    logInAs(null);
    await createUserWithoutCompany(TARGET_EMAIL);

    const response = await promote(TARGET_EMAIL);

    expect(response.status).toBe(401);
    expect(await isAdminInDatabase(TARGET_EMAIL)).toBe(false);
  });

  it("answers 403 to a non-admin, and the target stays a non-admin", async () => {
    logInAs(await createUserWithoutCompany(OTHER_EMAIL));
    await createUserWithoutCompany(TARGET_EMAIL);

    const response = await promote(TARGET_EMAIL);

    expect(response.status).toBe(403);
    expect(await isAdminInDatabase(TARGET_EMAIL)).toBe(false);
  });

  it("answers 403 to a non-admin who tries to promote themselves", async () => {
    logInAs(await createUserWithoutCompany(OTHER_EMAIL));

    const response = await promote(OTHER_EMAIL);

    expect(response.status).toBe(403);
    expect(await isAdminInDatabase(OTHER_EMAIL)).toBe(false);
  });
});
