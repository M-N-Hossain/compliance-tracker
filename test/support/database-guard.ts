// The guard at the door: only the throwaway test database may be used by tests.
const TEST_HOST = "localhost";
const TEST_PORT = "5433";

// Throws unless the address is the test database. Messages never include the address itself,
// because it can contain a password.
export function assertTestDatabaseUrl(value: string | undefined): void {
  let url: URL;
  try {
    url = new URL(value ?? "");
  } catch {
    throw new Error("Refusing to run: DATABASE_URL is missing or is not a valid address.");
  }

  if (url.hostname !== TEST_HOST) {
    throw new Error(`Refusing to run: the database host must be ${TEST_HOST}.`);
  }
  if (url.port !== TEST_PORT) {
    throw new Error(`Refusing to run: the database port must be ${TEST_PORT}.`);
  }
  if (!url.pathname.endsWith("_test")) {
    throw new Error("Refusing to run: the database name must end in _test.");
  }
}
