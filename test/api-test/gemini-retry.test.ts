// One click must never cost more than 3 Gemini calls: they all count against the free quota.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithRetry, MODELS } from "@/lib/gemini";

const generateContent = vi.hoisted(() => vi.fn());

// Replace only the SDK client, so no call can reach the network and no key is used.
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

function failWith(status: number) {
  generateContent.mockRejectedValue(Object.assign(new Error("fake Gemini failure"), { status }));
}

beforeEach(() => {
  generateContent.mockReset();
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("generateWithRetry", () => {
  it("calls Gemini 3 times when every call is overloaded (503), then throws", async () => {
    failWith(503);

    // Attach the rejection check before the timers run, so it is never unhandled.
    const result = expect(
      generateWithRetry({ model: MODELS.classify, contents: "hi" }),
    ).rejects.toThrow("fake Gemini failure");
    await vi.runAllTimersAsync();
    await result;

    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 429 (quota used up)", async () => {
    failWith(429);

    await expect(generateWithRetry({ model: MODELS.classify, contents: "hi" })).rejects.toThrow(
      "fake Gemini failure",
    );

    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
