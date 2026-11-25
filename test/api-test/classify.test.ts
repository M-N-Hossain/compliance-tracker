// The classify route with a fake session, a fake database and a fake Gemini.
// When the AI fails, the browser still needs the category list to let the user choose.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/company/classify/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scriptGeminiAnswer, scriptGeminiFailure } from "@/test/support/fakes/gemini";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { requirementTemplate: { findMany: vi.fn() } },
}));
vi.mock("@/lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/gemini")>()),
  generateWithRetry: vi.fn(),
}));

// Synthetic data only. The real route asks the database for these, without "general".
const CATEGORIES = ["digital_service", "food_beverage"];
const DESCRIPTION = "We run a small bakery that sells bread.";

const session = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;
const findMany = vi.mocked(prisma.requirementTemplate.findMany) as unknown as ReturnType<
  typeof vi.fn
>;

function classify(description: string = DESCRIPTION) {
  return POST(
    new Request("http://localhost/api/company/classify", {
      method: "POST",
      body: JSON.stringify({ description }),
    }),
  );
}

beforeEach(() => {
  session.mockResolvedValue({ user: { id: "1" } });
  findMany.mockResolvedValue(CATEGORIES.map((category) => ({ category })));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/company/classify", () => {
  it("answers 502 with the categories when Gemini throws a 429", async () => {
    scriptGeminiFailure("quota used up");

    const response = await classify();

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toEqual(expect.any(String));
    expect(body.categories).toEqual(CATEGORIES);
    expect(body.categories).not.toContain("general");
  });

  it("answers 502 with the categories when Gemini picks a category that is not on the list", async () => {
    scriptGeminiAnswer({ category: "not_a_real_category" });

    const response = await classify();

    expect(response.status).toBe(502);
    expect((await response.json()).categories).toEqual(CATEGORIES);
  });

  it("answers 400 without categories when the description is too short", async () => {
    const response = await classify("too short");

    expect(response.status).toBe(400);
    expect(await response.json()).not.toHaveProperty("categories");
  });

  it("answers 401 without categories when nobody is logged in", async () => {
    session.mockResolvedValue(null);

    const response = await classify();

    expect(response.status).toBe(401);
    expect(await response.json()).not.toHaveProperty("categories");
  });
});
