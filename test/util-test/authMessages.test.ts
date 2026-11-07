import { describe, expect, it } from "vitest";
import {
  BAD_CREDENTIALS_MESSAGE,
  SERVER_ERROR_MESSAGE,
  loginErrorMessage,
} from "@/lib/authMessages";

describe("loginErrorMessage", () => {
  it("says wrong email or password for a bad login", () => {
    expect(loginErrorMessage("CredentialsSignin")).toBe("Wrong email or password.");
    expect(loginErrorMessage("CredentialsSignin")).toBe(BAD_CREDENTIALS_MESSAGE);
  });

  // A server failure arrives as "Configuration". Anything unknown is treated the same way.
  it.each(["Configuration", "SomethingElse", ""])("says the server failed for %j", (error) => {
    expect(loginErrorMessage(error)).toBe(
      "Something went wrong on our side. Please try again in a moment.",
    );
    expect(loginErrorMessage(error)).toBe(SERVER_ERROR_MESSAGE);
  });
});
