import { describe, expect, it } from "vitest";
import { assertTestDatabaseUrl } from "@/test/support/database-guard";

describe("assertTestDatabaseUrl", () => {
  // The one address that is allowed.
  it("accepts the test database", () => {
    const good = "postgresql://user:pass@localhost:5433/compliance_tracker_test";
    expect(() => assertTestDatabaseUrl(good)).not.toThrow();
  });

  // Each of these must stop the run before anything touches a database.
  it.each([
    ["no address at all", undefined],
    ["an empty address", ""],
    ["text that is not an address", "not-a-url"],
    ["the dev port", "postgresql://user:pass@localhost:5432/compliance_tracker_test"],
    [
      "no port, which means the dev port",
      "postgresql://user:pass@localhost/compliance_tracker_test",
    ],
    ["the Docker host name", "postgresql://user:pass@db:5433/compliance_tracker_test"],
    ["a remote server", "postgresql://user:pass@example.com:5433/compliance_tracker_test"],
    [
      "a host that only starts with localhost",
      "postgresql://u:p@localhost.example.com:5433/x_test",
    ],
    ["a name without _test", "postgresql://user:pass@localhost:5433/compliance_tracker"],
    ["_test that is not at the end", "postgresql://user:pass@localhost:5433/x_test_real"],
  ])("refuses %s", (_label, url) => {
    expect(() => assertTestDatabaseUrl(url)).toThrow("Refusing to run");
  });

  // A refusal is printed in logs, so it must not repeat a password.
  it("never prints the address in its message", () => {
    const url = "postgresql://user:secret-password@localhost:5432/compliance_tracker";
    expect(() => assertTestDatabaseUrl(url)).toThrow(
      expect.not.objectContaining({ message: expect.stringContaining("secret-password") }),
    );
  });
});
