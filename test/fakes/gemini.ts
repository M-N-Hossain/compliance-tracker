// Scripted Gemini answers. A test file first replaces the network function, like this:
//
//   vi.mock("@/lib/gemini", async (importOriginal) => ({
//     ...(await importOriginal<typeof import("@/lib/gemini")>()),
//     generateWithRetry: vi.fn(),
//   }));
import { vi } from "vitest";
import { generateWithRetry } from "@/lib/gemini";

// The next Gemini call returns this answer as JSON text, like the real response.
export function scriptGeminiAnswer(answer: unknown) {
  vi.mocked(generateWithRetry).mockResolvedValue({ text: JSON.stringify(answer) } as never);
}

// The next Gemini call fails, for testing how the app handles an outage.
export function scriptGeminiFailure(message = "Fake Gemini failure") {
  vi.mocked(generateWithRetry).mockRejectedValue(new Error(message));
}
