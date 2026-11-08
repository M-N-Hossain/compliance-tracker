// Calls the real route handler against the real test database.
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health when the database is reachable", () => {
  it("answers 200 with the up body and is not cached", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", database: "up" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
