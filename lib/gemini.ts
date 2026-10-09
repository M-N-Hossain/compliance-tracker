import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("Missing environment variable: GEMINI_API_KEY");

const ai = new GoogleGenAI({ apiKey });

export const MODELS = {
  classify: "gemini-3.8-flash", // 20/day: few calls, needs judgment
  extract: "gemini-3.5-flash-lite", // 500/day: one call per upload
} as const;

export async function generateWithRetry(
  params: Parameters<typeof ai.models.generateContent>[0],
  maxRetries = 3,
) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      // Errors from the SDK may carry an HTTP status. We check
      // carefully because "err" could be anything in JavaScript.
      const status =
        err && typeof err === "object" && "status" in err
          ? (err as { status?: number }).status
          : undefined;

      // Only 503 ("overloaded, try again") is worth retrying.
      // 429 ("quota used up") is not: waiting seconds won't help.
      const isRetryable = status === 503;

      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }

      // Exponential backoff: wait longer each time so we don't
      // hammer a server that is already struggling.
      const delayMs = 500 * 2 ** attempt; // 500ms, 1000ms, 2000ms
      console.warn(`Gemini 503, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  // The loop always returns or throws, but TypeScript can't prove it,
  // so this line satisfies the compiler.
  throw new Error("unreachable");
}
