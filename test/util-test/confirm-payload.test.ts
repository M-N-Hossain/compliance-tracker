// The clerk at the counter: what the confirm endpoint accepts, and what it hands back.
import { describe, expect, it } from "vitest";
import { parseConfirmPayload } from "@/utils/confirmPayload";

// A body that passes. Each test below changes only the one thing it is about.
const valid = {
  certificateType: "Food Safety Certificate",
  expiryDate: "2027-03-31",
  requirementTemplateId: 5,
};

// Removes one field, to build a body where that field is missing.
function without(field: keyof typeof valid) {
  const copy: Record<string, unknown> = { ...valid };
  delete copy[field];
  return copy;
}

describe("parseConfirmPayload", () => {
  describe("a valid body", () => {
    // The date comes back as a real Date at UTC midnight, ready for the database.
    it("returns the clean values", () => {
      expect(parseConfirmPayload(valid)).toEqual({
        ok: true,
        data: {
          certificateType: "Food Safety Certificate",
          expiryDate: new Date("2027-03-31T00:00:00.000Z"),
          requirementTemplateId: 5,
        },
      });
    });

    it("trims the type", () => {
      const result = parseConfirmPayload({ ...valid, certificateType: "  Food Safety  " });

      expect(result.ok && result.data.certificateType).toBe("Food Safety");
    });

    // Null is a decision: the user ticked "No expiry date".
    it("accepts null as the expiry date", () => {
      const result = parseConfirmPayload({ ...valid, expiryDate: null });

      expect(result.ok && result.data.expiryDate).toBeNull();
    });

    // Null is a decision here too: the user chose "Not on my checklist".
    it("accepts null as the checklist item", () => {
      const result = parseConfirmPayload({ ...valid, requirementTemplateId: null });

      expect(result.ok && result.data.requirementTemplateId).toBeNull();
    });

    // Uploading an expired certificate is allowed, and the dashboard then shows Expired.
    it("accepts an expiry date in the past", () => {
      const result = parseConfirmPayload({ ...valid, expiryDate: "2001-01-31" });

      expect(result.ok && result.data.expiryDate).toEqual(new Date("2001-01-31T00:00:00.000Z"));
    });

    // Exactly at the limit must pass, so the limit itself is tested from both sides.
    it("accepts a type of exactly 200 characters", () => {
      expect(parseConfirmPayload({ ...valid, certificateType: "a".repeat(200) }).ok).toBe(true);
    });

    // Extra fields are ignored, and never reach the clean values.
    it("drops extra fields", () => {
      const result = parseConfirmPayload({ ...valid, companyId: 999 });

      expect(result.ok && result.data).not.toHaveProperty("companyId");
    });
  });

  // Missing is different from null: a missing field means the request is broken.
  describe("a missing field", () => {
    it.each(["certificateType", "expiryDate", "requirementTemplateId"] as const)(
      "refuses a body without %s",
      (field) => {
        expect(parseConfirmPayload(without(field)).ok).toBe(false);
      },
    );

    // The exact shape the old dropdown sent.
    it("refuses a body with only requirementTemplateId", () => {
      expect(parseConfirmPayload({ requirementTemplateId: 5 }).ok).toBe(false);
    });
  });

  // JSON can be any shape at all, not only an object.
  describe("a body that is not an object", () => {
    it.each([[null], ["text"], [5], [[]]])("refuses %j", (body) => {
      expect(parseConfirmPayload(body).ok).toBe(false);
    });
  });

  describe("a bad type", () => {
    it.each([
      ["a number", 5],
      ["null", null],
      ["an empty string", ""],
      ["only spaces", "   "],
      ["201 characters", "a".repeat(201)],
    ])("refuses %s", (_name, certificateType) => {
      expect(parseConfirmPayload({ ...valid, certificateType }).ok).toBe(false);
    });

    // Spaces around the text do not count towards the limit.
    it("measures the length after trimming", () => {
      const certificateType = ` ${"a".repeat(200)} `;

      expect(parseConfirmPayload({ ...valid, certificateType }).ok).toBe(true);
    });

    // PostgreSQL text cannot hold a NUL character, so saving it would crash with a 500.
    it("refuses a NUL character", () => {
      expect(parseConfirmPayload({ ...valid, certificateType: "Food\u0000Safety" }).ok).toBe(false);
    });
  });

  describe("a bad expiry date", () => {
    it.each([
      ["a number", 20270331],
      ["an empty string", ""],
      ["the wrong format", "31/03/2027"],
      ["a date with a time", "2027-03-31T00:00:00.000Z"],
      ["an impossible date", "2026-02-31"],
    ])("refuses %s", (_name, expiryDate) => {
      expect(parseConfirmPayload({ ...valid, expiryDate }).ok).toBe(false);
    });

    // PostgreSQL has no year 0 (1 BC is followed by AD 1), so saving it would crash with a 500.
    it("refuses the year 0000", () => {
      expect(parseConfirmPayload({ ...valid, expiryDate: "0000-01-01" }).ok).toBe(false);
    });

    // The first day PostgreSQL can store must still pass, so the limit is tested from both sides.
    it("accepts the year 0001", () => {
      expect(parseConfirmPayload({ ...valid, expiryDate: "0001-01-01" }).ok).toBe(true);
    });
  });

  describe("a bad checklist item", () => {
    it.each([
      ["text", "5"],
      ["a decimal", 1.5],
      ["a boolean", true],
    ])("refuses %s", (_name, requirementTemplateId) => {
      expect(parseConfirmPayload({ ...valid, requirementTemplateId }).ok).toBe(false);
    });

    // The id column is a 32-bit integer, so a bigger number would crash the query with a 500.
    it("refuses an id over 32 bits", () => {
      expect(parseConfirmPayload({ ...valid, requirementTemplateId: 2147483648 }).ok).toBe(false);
    });

    // The largest id the column can hold must still pass.
    it("accepts the largest 32-bit id", () => {
      expect(parseConfirmPayload({ ...valid, requirementTemplateId: 2147483647 }).ok).toBe(true);
    });
  });

  // The error goes back to the browser, so it must not echo what was sent.
  it("does not repeat the sent value in the error", () => {
    const result = parseConfirmPayload({ ...valid, expiryDate: "secret-looking-value" });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).not.toContain("secret-looking-value");
  });
});
