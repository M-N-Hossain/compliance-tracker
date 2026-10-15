export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

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

// The start of the given date's day, in UTC (midnight).
// Used on BOTH sides of a comparison, so only the calendar date counts,
// never the time of day.
export function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
