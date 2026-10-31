import { describe, expect, it } from "vitest";
import { checklistCategories, formatCategory, GENERAL_CATEGORY } from "@/utils/category";

describe("checklistCategories", () => {
  // Every company's checklist includes the items that apply to all businesses.
  it("gives the company's own category plus the general one", () => {
    expect(checklistCategories("food_beverage")).toEqual(["food_beverage", GENERAL_CATEGORY]);
  });
});

describe("formatCategory", () => {
  // Every underscore goes, not only the first.
  it("replaces every underscore with a space", () => {
    expect(formatCategory("food_beverage")).toBe("food beverage");
    expect(formatCategory("a_b_c")).toBe("a b c");
  });

  it("leaves a category without underscores alone", () => {
    expect(formatCategory(GENERAL_CATEGORY)).toBe("general");
  });
});
