// Templates with this category apply to every company, whatever its own category.
export const GENERAL_CATEGORY = "general";

// The categories a company's checklist is built from:
// its own category plus the universal one.
// Every checklist query uses this.
export function checklistCategories(category: string): string[] {
  return [category, GENERAL_CATEGORY];
}

// Turns "FOOD_SERVICE" into "FOOD SERVICE" for display.
export function formatCategory(category: string): string {
  return category.replace(/_/g, " ");
}
