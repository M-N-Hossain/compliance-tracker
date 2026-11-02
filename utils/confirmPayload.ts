import { parseIsoDate } from "@/utils/date";

// The longest certificate type we accept, measured after trimming.
const MAX_TYPE_LENGTH = 200;

// The range of a PostgreSQL "integer" column. A number outside it makes the query crash.
const MIN_DB_INT = -2147483648;
const MAX_DB_INT = 2147483647;

// The clean values, in the form the database wants.
export type ConfirmPayload = {
  certificateType: string;
  expiryDate: Date | null; // null: the user ticked "No expiry date"
  requirementTemplateId: number | null; // null: the user chose "Not on my checklist"
};

// Either the clean values or a reason. Checking "ok" tells TypeScript which one we have.
export type ConfirmResult = { ok: true; data: ConfirmPayload } | { ok: false; error: string };

// Checks the shape of what the user confirmed. It does not touch the database, so the
// route must still check that the document and the checklist item are allowed.
// Error messages never repeat the value sent.
export function parseConfirmPayload(body: unknown): ConfirmResult {
  // Valid JSON can be text, a number or a list, and arrays count as objects in JavaScript.
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Expected an object" };
  }

  // Pull out only the three fields we know, so extra fields are dropped here.
  const { certificateType, expiryDate, requirementTemplateId } = body as Record<string, unknown>;

  // The type: text that is not blank and not too long once the outer spaces are gone.
  if (typeof certificateType !== "string") {
    return { ok: false, error: "Certificate type is required" };
  }
  const type = certificateType.trim();
  if (type === "") {
    return { ok: false, error: "Certificate type is required" };
  }
  if (type.length > MAX_TYPE_LENGTH) {
    return { ok: false, error: `Certificate type must be ${MAX_TYPE_LENGTH} characters or fewer` };
  }
  // PostgreSQL text cannot hold a NUL character, so we refuse it before the database does.
  if (type.includes("\u0000")) {
    return { ok: false, error: "Certificate type contains a character that is not allowed" };
  }

  // The date: null is a decision, but undefined means the field was left out.
  if (expiryDate === undefined) {
    return { ok: false, error: "Expiry date is required" };
  }
  // parseIsoDate also answers null for bad input, so only call it when a value was sent.
  const date = expiryDate === null ? null : parseIsoDate(expiryDate);
  // PostgreSQL has no year 0, so a date before 0001-01-01 is refused with the same message.
  if ((expiryDate !== null && date === null) || (date !== null && date.getUTCFullYear() < 1)) {
    return { ok: false, error: "Expiry date must be a real date in YYYY-MM-DD format" };
  }

  // The checklist item: null is a decision here too. Anything else must be a whole number
  // that fits the database column.
  if (
    requirementTemplateId !== null &&
    (!Number.isInteger(requirementTemplateId) ||
      (requirementTemplateId as number) < MIN_DB_INT ||
      (requirementTemplateId as number) > MAX_DB_INT)
  ) {
    return { ok: false, error: "Invalid covers value" };
  }

  // Everything passed. The "as" is safe because the line above ruled out everything else.
  return {
    ok: true,
    data: {
      certificateType: type,
      expiryDate: date,
      requirementTemplateId: requirementTemplateId as number | null,
    },
  };
}
