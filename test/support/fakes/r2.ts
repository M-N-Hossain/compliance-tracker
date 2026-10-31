// Fake file storage. The real client stays, because signing links happens locally.
// Only send() is replaced, since that is the part that uses the network.
import { vi } from "vitest";
import { r2 } from "@/lib/r2";

// Call this in a test. Returns the stored files, as a map from key to contents.
export function useFakeR2() {
  const files = new Map<string, unknown>();

  vi.spyOn(r2, "send").mockImplementation((async (command: {
    constructor: { name: string };
    input: { Key?: string; Body?: unknown };
  }) => {
    const key = command.input.Key ?? "";

    // Handles the commands the app uses, and fails loudly on any other.
    switch (command.constructor.name) {
      case "PutObjectCommand":
        files.set(key, command.input.Body);
        return {};
      case "DeleteObjectCommand":
        files.delete(key);
        return {};
      default:
        throw new Error(`The fake R2 does not handle ${command.constructor.name}.`);
    }
  }) as never);

  return files;
}
