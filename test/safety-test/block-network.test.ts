// Proves the block stops every way the app connects out, using the app's real clients.
import https from "node:https";
import net from "node:net";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { generateWithRetry, MODELS } from "@/lib/gemini";
import { r2, R2_BUCKET } from "@/lib/r2";
import { takeBlockedCalls } from "@/test/support/block-network";

describe("network block", () => {
  // Each test below empties the list itself, so the check after each test passes.
  it("stops fetch", async () => {
    await expect(fetch("https://example.com")).rejects.toThrow();
    expect(takeBlockedCalls()).toContain("example.com");
  });

  it("stops Node's https module", async () => {
    await new Promise<void>((resolve) => {
      try {
        https.get("https://example.com", resolve as never).on("error", () => resolve());
      } catch {
        resolve();
      }
    });
    expect(takeBlockedCalls()).toContain("example.com");
  });

  // The real Gemini client, with its fake key.
  it("stops the real Gemini client", async () => {
    await expect(generateWithRetry({ model: MODELS.extract, contents: "hi" })).rejects.toThrow();
    expect(takeBlockedCalls().length).toBeGreaterThan(0);
  });

  // The real R2 client, with its fake keys. The SDK retries, so it may try more than once.
  it("stops the real R2 client", async () => {
    await expect(r2.send(new HeadBucketCommand({ Bucket: R2_BUCKET }))).rejects.toThrow();
    expect(takeBlockedCalls().some((host) => host.includes("r2.cloudflarestorage.com"))).toBe(true);
  });

  // Port 1 has nothing listening, so the connection fails, but it must not count as blocked.
  it("still allows this computer", async () => {
    await new Promise<void>((resolve) => {
      net.connect(1, "localhost").on("error", () => resolve());
    });
    expect(takeBlockedCalls()).toEqual([]);
  });
});
