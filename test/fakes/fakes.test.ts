// Proves the fakes work with the app's real code, without any network call.
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractCertificate } from "@/lib/extractCertificate";
import { r2, R2_BUCKET } from "@/lib/r2";
import { scriptGeminiAnswer, scriptGeminiFailure } from "./gemini";
import { useFakeR2 } from "./r2";

// Keep the real gemini file, and replace only the function that uses the network.
vi.mock("@/lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/gemini")>()),
  generateWithRetry: vi.fn(),
}));

// Put the real send() back, so one test's fake cannot affect the next.
afterEach(() => {
  vi.restoreAllMocks();
});

describe("fake Gemini", () => {
  const pdf = Buffer.from("%PDF-");
  const templates = [{ id: 7, name: "Food Safety" }];

  // Real extractCertificate code runs on the scripted answer.
  it("gives real code a scripted answer", async () => {
    scriptGeminiAnswer({
      certificateType: "Food Safety Certificate",
      expiryDate: "2027-03-31",
      matchedTemplate: "Food Safety",
    });

    const result = await extractCertificate(pdf, templates);

    expect(result?.certificateType).toBe("Food Safety Certificate");
    expect(result?.matchedTemplateId).toBe(7);
    expect(result?.expiryDate?.toISOString()).toBe("2027-03-31T00:00:00.000Z");
  });

  it("can simulate an outage", async () => {
    scriptGeminiFailure();
    await expect(extractCertificate(pdf, templates)).rejects.toThrow("Fake Gemini failure");
  });
});

describe("fake R2", () => {
  it("stores and deletes files without the network", async () => {
    const files = useFakeR2();

    await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: "company-1/a.pdf", Body: "x" }));
    expect(files.get("company-1/a.pdf")).toBe("x");

    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: "company-1/a.pdf" }));
    expect(files.has("company-1/a.pdf")).toBe(false);
  });

  // Signing needs no network, so the real client can still make a link.
  it("still signs links with the real client", async () => {
    useFakeR2();
    const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: "company-1/a.pdf" });
    const url = await getSignedUrl(r2, command, { expiresIn: 60 });
    expect(url).toContain("company-1/a.pdf");
  });
});
