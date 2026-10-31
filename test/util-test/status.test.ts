import { describe, expect, it } from "vitest";
import { EXPIRING_SOON_DAYS, getStatus } from "@/utils/status";

// A fixed "today", so these tests give the same result on any day.
const NOW = new Date("2026-06-15T12:00:00Z");

// A date the given number of days after NOW, at UTC midnight.
const daysFromNow = (days: number) => new Date(Date.UTC(2026, 5, 15 + days));

describe("getStatus", () => {
  // No linked document means missing, even if a date is passed in.
  it("is MISSING without a document", () => {
    expect(getStatus(false, null, NOW)).toEqual({ status: "MISSING", daysLeft: null });
    expect(getStatus(false, daysFromNow(90), NOW)).toEqual({ status: "MISSING", daysLeft: null });
  });

  // A certificate with no printed expiry date counts as covered.
  it("is COVERED with a document that has no expiry date", () => {
    expect(getStatus(true, null, NOW)).toEqual({ status: "COVERED", daysLeft: null });
  });

  // The edges below are where this kind of logic usually breaks.
  it("is EXPIRED from the day after the expiry date", () => {
    expect(getStatus(true, daysFromNow(-1), NOW)).toEqual({ status: "EXPIRED", daysLeft: -1 });
  });

  it("is still valid on the expiry date itself", () => {
    expect(getStatus(true, daysFromNow(0), NOW)).toEqual({ status: "EXPIRING_SOON", daysLeft: 0 });
  });

  it("warns on the last day of the warning period", () => {
    expect(getStatus(true, daysFromNow(EXPIRING_SOON_DAYS), NOW)).toEqual({
      status: "EXPIRING_SOON",
      daysLeft: EXPIRING_SOON_DAYS,
    });
  });

  it("is COVERED the day after the warning period ends", () => {
    expect(getStatus(true, daysFromNow(EXPIRING_SOON_DAYS + 1), NOW)).toEqual({
      status: "COVERED",
      daysLeft: EXPIRING_SOON_DAYS + 1,
    });
  });

  // Only the calendar date counts, so a late hour must not change the answer.
  it("ignores the time of day", () => {
    const lateTonight = new Date("2026-06-15T23:59:59Z");
    const earlyToday = new Date("2026-06-15T00:00:01Z");
    expect(getStatus(true, lateTonight, earlyToday).daysLeft).toBe(0);
    expect(getStatus(true, earlyToday, lateTonight).daysLeft).toBe(0);
  });

  // The calculation must also work across a year boundary.
  it("counts days across a new year", () => {
    const newYear = new Date("2027-01-01T00:00:00Z");
    const newYearsEve = new Date("2026-12-31T12:00:00Z");
    expect(getStatus(true, newYear, newYearsEve).daysLeft).toBe(1);
  });
});
