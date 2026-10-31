import { describe, expect, it } from "vitest";
import { formatDate, parseIsoDate, startOfDayUtc } from "@/utils/date";

describe("startOfDayUtc", () => {
  // Any time of day becomes midnight UTC of the same date.
  it("moves a time to midnight UTC on the same date", () => {
    const result = startOfDayUtc(new Date("2027-03-31T23:59:59Z"));
    expect(result.toISOString()).toBe("2027-03-31T00:00:00.000Z");
  });
});

describe("formatDate", () => {
  // Shown in UTC, so a date never moves to the day before in another time zone.
  it("shows the UTC date in day, short month, year order", () => {
    expect(formatDate(new Date("2027-03-01T00:00:00Z"))).toBe("1 Mar 2027");
  });
});

describe("parseIsoDate", () => {
  // The normal case: a real date becomes UTC midnight of that day.
  it("turns a real date into UTC midnight", () => {
    expect(parseIsoDate("2027-03-31")?.toISOString()).toBe("2027-03-31T00:00:00.000Z");
  });

  // JavaScript would roll these forward to March, so they must be refused.
  it("refuses dates that do not exist", () => {
    expect(parseIsoDate("2026-02-31")).toBeNull();
    expect(parseIsoDate("2026-13-01")).toBeNull();
  });

  // Leap years: February 29 only exists in some years.
  it("accepts February 29 only in a leap year", () => {
    expect(parseIsoDate("2028-02-29")).not.toBeNull();
    expect(parseIsoDate("2027-02-29")).toBeNull();
  });

  // Gemini's answer is untrusted, so any other format must give null.
  it("refuses other formats", () => {
    expect(parseIsoDate("31/03/2027")).toBeNull();
    expect(parseIsoDate("2027-3-31")).toBeNull();
    expect(parseIsoDate("2027-03-31T10:00:00Z")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
  });

  // The value comes from parsed JSON, so it may not be a string at all.
  it("refuses values that are not strings", () => {
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
    expect(parseIsoDate(20270331)).toBeNull();
  });
});
