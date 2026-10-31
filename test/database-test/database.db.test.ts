// Proves the database tests really reach the test database, with every migration applied.
import { readdirSync } from "node:fs";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { assertTestDatabaseUrl } from "@/test/support/database-guard";

// Check the address again here, before this file opens a connection.
assertTestDatabaseUrl(process.env.DATABASE_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Close the connection so the test run can finish.
afterAll(() => pool.end());

describe("test database", () => {
  // Asks the server itself, instead of trusting the address we sent.
  it("is the database whose name ends in _test", async () => {
    const { rows } = await pool.query("SELECT current_database() AS name");
    expect(rows[0].name).toBe("compliance_tracker_test");
  });

  // Each folder in prisma/migrations is one migration, so the counts must match.
  it("has every migration applied", async () => {
    const folders = readdirSync("prisma/migrations", { withFileTypes: true }).filter((entry) =>
      entry.isDirectory(),
    );
    const { rows } = await pool.query(
      "SELECT count(*)::int AS applied FROM _prisma_migrations WHERE finished_at IS NOT NULL",
    );
    expect(rows[0].applied).toBe(folders.length);
  });
});
