// The database is a fake that fails on purpose, so no Docker is needed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

// Synthetic values. A real connection error can quote the host and the connection string.
const HOST = "db.secret-host.test";
const DB_PASSWORD = "fake-db-password";

const queryRaw = vi.mocked(prisma.$queryRaw) as unknown as ReturnType<typeof vi.fn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  queryRaw.mockReset();
  logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe("GET /api/health when the database fails", () => {
  it("answers 503 with the down body, is not cached, and logs only the error's name and code", async () => {
    const dbError = Object.assign(
      new Error(`connect ECONNREFUSED postgres://app:${DB_PASSWORD}@${HOST}:5432/app`),
      { code: "ECONNREFUSED" },
    );
    queryRaw.mockRejectedValue(dbError);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "error", database: "down" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]).toContain("Error");
    expect(logSpy.mock.calls[0]).toContain("ECONNREFUSED");

    const logged = JSON.stringify(logSpy.mock.calls.flat().map(String));
    expect(logged).not.toContain(HOST);
    expect(logged).not.toContain(DB_PASSWORD);
  });
});
