// Runs once before the database tests: checks the address, then creates the tables.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { assertTestDatabaseUrl } from "./database-guard";

// Prints the reason and ends the run. An error thrown from global setup crashes
// Vitest's error printer, which would hide this message.
function stop(message: string): never {
  console.error(message);
  process.exit(1);
}

export default function setup() {
  // Vitest's "env" setting does not reach this file, so read .env.test directly.
  const env = parse(readFileSync(".env.test"));

  // The guard runs first. If it refuses, the migration below never starts.
  try {
    assertTestDatabaseUrl(env.DATABASE_URL);
  } catch (error) {
    stop((error as Error).message);
  }

  // prisma.config.ts also loads the real .env, but a value that is already set wins,
  // so env.DATABASE_URL below is the address Prisma uses.
  const result = spawnSync("npx prisma migrate deploy", {
    shell: true,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

  // Prisma's own output is left out of the message, and only the next step is shown.
  if (result.status !== 0) {
    stop("Could not prepare the test database. Is it running? Try: npm run test:db:up");
  }
}
