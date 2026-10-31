// Proves that tests only ever see fake keys and the test database's address.
// Failure messages name the key, never its value, so a real key is not printed.
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { describe, expect, it } from "vitest";

// .env.example lists every key the app needs, so a new key is covered automatically.
const allKeys = Object.keys(parse(readFileSync(".env.example")));

// These two hold a database name or address, so they are checked separately below.
const DATABASE_KEYS = ["POSTGRES_DB", "DATABASE_URL"];
const fakeKeys = allKeys.filter((key) => !DATABASE_KEYS.includes(key));

describe("test environment", () => {
  // A key missing from .env.test would leave the app's code without a value.
  it.each(allKeys)("has a value for %s", (key) => {
    expect(process.env[key], `${key} is missing from .env.test`).toBeDefined();
  });

  // Every other key must be clearly fake.
  it.each(fakeKeys)("uses a fake value for %s", (key) => {
    const isFake = process.env[key]?.startsWith("fake-");
    expect(isFake, `${key} must start with fake-`).toBe(true);
  });

  it("only uses a database whose name ends in _test", () => {
    expect(process.env.POSTGRES_DB?.endsWith("_test"), "POSTGRES_DB must end in _test").toBe(true);
  });

  // The address must be this machine, on the test port, never the dev port 5432.
  it("points DATABASE_URL at the test database", () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    expect(url.hostname).toBe("localhost");
    expect(url.port).toBe("5433");
    expect(url.pathname.endsWith("_test"), "database name must end in _test").toBe(true);
  });
});
