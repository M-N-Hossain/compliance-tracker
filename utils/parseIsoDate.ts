// Turns "2027-03-31" into a Date at UTC midnight, or null if it isn't a real date.
export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  // "T00:00:00Z" pins it to UTC midnight, so no timezone shift.
  const date = new Date(`${value}T00:00:00Z`);

  // JavaScript rolls impossible dates forward (2026-02-31 -> 2026-03-03).
  // Converting back and comparing catches that.
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null;
  }
  return date;
}
