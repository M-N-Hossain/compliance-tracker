// The manual fallback sends the user's own choice to this route, so the route must check it.
// Real route, real test database. Only the session is replaced.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/company/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GENERAL_CATEGORY } from "@/utils/category";
import { clearTestData, createUserWithoutCompany } from "@/test/support/test-data";

// Vitest cannot produce a real login session, so each test chooses the logged-in user.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

// Synthetic data only.
const session = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;
let userId: number;

beforeEach(async () => {
  await clearTestData();
  const user = await createUserWithoutCompany("company-test@example.test");
  userId = user.id;
  session.mockResolvedValue({ user: { id: String(user.id) } });
});

afterAll(async () => {
  await clearTestData();
  await prisma.$disconnect();
});

function createCompany(category: string) {
  return POST(
    new Request("http://localhost/api/company", {
      method: "POST",
      body: JSON.stringify({
        name: "Category Test Company",
        description: "A made-up company for a category check.",
        category,
      }),
    }),
  );
}

describe("POST /api/company category check", () => {
  it.each([
    ["general, which is not a kind of business", GENERAL_CATEGORY],
    ["a category that does not exist", "not_a_real_category"],
  ])("answers 400 and creates no company for %s", async (_label, category) => {
    const response = await createCompany(category);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Not a recognized category." });
    expect(await prisma.company.count()).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).companyId).toBeNull();
  });
});
