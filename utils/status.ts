import { startOfDayUtc } from "@/utils/date";

export type ComplianceStatus = "MISSING" | "EXPIRED" | "EXPIRING_SOON" | "COVERED";

// How early we warn.
export const EXPIRING_SOON_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// hasDocument: is a confirmed document linked to this checklist item?
// expiryDate:  that document's expiry date, or null if none was printed.
// now:         passed in (not read inside), so the function is pure and testable.
export function getStatus(
  hasDocument: boolean,
  expiryDate: Date | null,
  now: Date,
): { status: ComplianceStatus; daysLeft: number | null } {
  if (!hasDocument) return { status: "MISSING", daysLeft: null };

  if (!expiryDate) return { status: "COVERED", daysLeft: null };

  const today = startOfDayUtc(now);
  const expiryDay = startOfDayUtc(expiryDate);
  const daysLeft = Math.round((expiryDay.getTime() - today.getTime()) / MS_PER_DAY);

  // daysLeft 0 = expires today = still valid today.
  if (daysLeft < 0) return { status: "EXPIRED", daysLeft };
  if (daysLeft <= EXPIRING_SOON_DAYS) return { status: "EXPIRING_SOON", daysLeft };
  return { status: "COVERED", daysLeft };
}
