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

// Sends any body at all, for the tests about bodies the route must refuse.
function sendRaw(body: string) {
  return POST(new Request("http://localhost/api/admin/promote", { method: "POST", body }));
}

function promote(email: string) {
  return sendRaw(JSON.stringify({ email }));
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

  it("logs one line with both user ids and no email", async () => {
    const admin = await createUserWithoutCompany(ADMIN_EMAIL, true);
    logInAs(admin);
    const target = await createUserWithoutCompany(TARGET_EMAIL);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    try {
      await promote(TARGET_EMAIL);

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy.mock.calls[0]).toContain(admin.id);
      expect(infoSpy.mock.calls[0]).toContain(target.id);
      const logged = JSON.stringify(infoSpy.mock.calls.flat().map(String));
      expect(logged).not.toContain(ADMIN_EMAIL);
      expect(logged).not.toContain(TARGET_EMAIL);
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("answers already-admin for a user who is already an admin", async () => {
    logInAs(await createUserWithoutCompany(ADMIN_EMAIL, true));
    await createUserWithoutCompany(TARGET_EMAIL, true);

    const response = await promote(TARGET_EMAIL);

    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("already-admin");
    expect(await isAdminInDatabase(TARGET_EMAIL)).toBe(true);
  });

  it("answers 404 for an unknown email, without repeating it, and changes nobody", async () => {
    logInAs(await createUserWithoutCompany(ADMIN_EMAIL, true));
    await createUserWithoutCompany(TARGET_EMAIL);
    const unknown = "nobody-here@example.test";

    const response = await promote(unknown);

    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain(unknown);
    expect(await isAdminInDatabase(TARGET_EMAIL)).toBe(false);
  });

  it.each([
    ["no email", JSON.stringify({})],
    ["an empty email", JSON.stringify({ email: "   " })],
    ["an email that is not a string", JSON.stringify({ email: 123 })],
    ["a body that is not JSON", "not json"],
  ])("answers 400 for %s, and changes nobody", async (_, body) => {
    logInAs(await createUserWithoutCompany(ADMIN_EMAIL, true));
    await createUserWithoutCompany(TARGET_EMAIL);

    const response = await sendRaw(body);

    expect(response.status).toBe(400);
    expect(await isAdminInDatabase(TARGET_EMAIL)).toBe(false);
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
