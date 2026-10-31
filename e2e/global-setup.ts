// Runs once before the browser tests: creates the tables and the checklist data.
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { parse } from "dotenv";
import { assertTestDatabaseUrl } from "../test/database-guard";

export default function globalSetup() {
  const env = parse(readFileSync(".env.test"));

  // The guard runs first. If it throws, neither command below starts.
  assertTestDatabaseUrl(env.DATABASE_URL);

  // The real .env is also loaded by these commands, but a value already set wins.
  // The seed is needed because saving a company checks that its category exists.
  for (const command of ["npx prisma migrate deploy", "npx prisma db seed"]) {
    const result = spawnSync(command, {
      shell: true,
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
    if (result.status !== 0) {
      throw new Error(`"${command}" failed. Is the database running? Try: npm run test:db:up`);
    }
  }

  // Start with an empty log, so the smoke test only sees calls made during the test.
  rmSync("e2e/.blocked-network.log", { force: true });
}
