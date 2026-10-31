import { describe, expect, it } from "vitest";
import { initialMatchValue, NOT_DECIDED, NOT_ON_CHECKLIST } from "@/utils/match";

describe("initialMatchValue", () => {
  // A link wins, even if an old pending request is still around.
  it("shows the linked template's id as text", () => {
    expect(initialMatchValue({ requirementTemplateId: 5, hasPendingRequest: false })).toBe("5");
    expect(initialMatchValue({ requirementTemplateId: 5, hasPendingRequest: true })).toBe("5");
  });

  // A pending request means the user already chose "none of these".
  it("shows 'not on my checklist' when a request is pending", () => {
    expect(initialMatchValue({ requirementTemplateId: null, hasPendingRequest: true })).toBe(
      NOT_ON_CHECKLIST,
    );
  });

  // The AI's guess is never pre-selected: nobody has decided until the user does.
  it("shows 'not decided' when nobody has decided", () => {
    expect(initialMatchValue({ requirementTemplateId: null, hasPendingRequest: false })).toBe(
      NOT_DECIDED,
    );
  });
});
