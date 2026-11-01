// Drives the confirm flow in a real browser: real pages, real PATCH route, real test database.
// Only POST /api/documents is answered in the browser, so Gemini and R2 are never called.
import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";
import { parse } from "dotenv";
import { assertTestDatabaseUrl } from "../support/database-guard";

// Far behind UTC on purpose: a date handled as local time would land one day early here.
test.use({ timezoneId: "Pacific/Honolulu" });

// This item comes from the seed data, and every checklist includes it.
const ITEM_NAME = "GDPR data processing policy";
const CARD = "Confirm the uploaded document";
const NEW_ROW = "Confirm Unnamed document";

// Answers in the shape the real upload route uses.
type Extracted = {
  certificateType: string;
  expiryDate: string | null;
  matchedTemplateId: number | null;
} | null;

// The guard runs before any connection opens, so this can only reach the test database.
const { DATABASE_URL } = parse(readFileSync(".env.test"));
assertTestDatabaseUrl(DATABASE_URL);
const pool = new Pool({ connectionString: DATABASE_URL });

// Registers a new made-up user and company, so each test starts with no documents.
async function setUpCompany(page: Page) {
  const email = `confirm-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;

  // Company setup asks Gemini on the server. Answer in the browser, so Gemini is never called.
  await page.route("**/api/company/classify", (route) =>
    route.fulfill({
      json: { category: "digital_service", categories: ["digital_service", "food_beverage"] },
    }),
  );

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("fake-confirm-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/company\/setup/);

  await page.getByLabel("Company name").fill("Confirm Test Company");
  await page.getByLabel("What does your company do?").fill("We build software for small shops.");
  await page.getByRole("button", { name: "Suggest a business type" }).click();
  await page.getByRole("button", { name: "Save and build my checklist" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const { rows } = await pool.query('SELECT "companyId" FROM "User" WHERE email = $1', [email]);
  return rows[0].companyId as number;
}

// Adds an empty document row, exactly what the real upload route creates.
async function createDocument(companyId: number) {
  const { rows } = await pool.query(
    'INSERT INTO "Document" ("companyId", "fileUrl") VALUES ($1, $2) RETURNING id',
    [companyId, `company-${companyId}/fake.pdf`],
  );
  return rows[0].id as number;
}

// The id of the seeded checklist item.
async function itemId() {
  const { rows } = await pool.query('SELECT id FROM "RequirementTemplate" WHERE name = $1', [
    ITEM_NAME,
  ]);
  return rows[0].id as number;
}

// Reads the document straight from the database, without going through the app.
async function storedDocument(id: number) {
  // ::text: the column has no time zone, and the pg driver would read it as this machine's
  // local time, shifting the date. As text, we see exactly what the database holds.
  const { rows } = await pool.query(
    'SELECT "extractedType", "expiryDate"::text AS "expiryDate", "requirementTemplateId" FROM "Document" WHERE id = $1',
    [id],
  );
  return rows[0];
}

// Uploads through the real form, with the response replaced by a scripted Gemini suggestion.
async function upload(page: Page, documentId: number, extracted: Extracted) {
  await page.route("**/api/documents", (route) =>
    route.fulfill({ status: 201, json: { id: documentId, extracted } }),
  );
  await page.goto("/documents");
  await page.locator('input[type="file"]').setInputFiles({
    name: "certificate.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 fake"),
  });
  await page.getByRole("button", { name: "Upload PDF" }).click();
  await expect(page.getByRole("form", { name: CARD })).toBeVisible();
}

// The form's fields, found the way a person finds them: by their labels.
function fields(page: Page, formName: string) {
  const form = page.getByRole("form", { name: formName });
  return {
    form,
    type: form.getByLabel("Certificate type"),
    // exact: otherwise "Expiry date" would also match the "No expiry date" box.
    date: form.getByLabel("Expiry date", { exact: true }),
    noExpiry: form.getByLabel("No expiry date"),
    covers: form.getByLabel("Covers"),
    // exact: otherwise "Save" would also match the "Saved" button.
    save: form.getByRole("button", { name: "Save", exact: true }),
  };
}

// The app may catch a blocked call, so check the block's log as well.
test.afterEach(() => {
  const log = "test/support/.blocked-network.log";
  const blocked = existsSync(log) ? readFileSync(log, "utf8").trim() : "";
  expect(blocked, "the app's server tried to reach the network").toBe("");
});

// Close the connection so the run can finish.
test.afterAll(() => pool.end());

test.describe("the upload card", () => {
  test("shows Gemini's suggestion in editable fields, with no date shift", async ({ page }) => {
    const companyId = await setUpCompany(page);
    const id = await createDocument(companyId);
    const matchedTemplateId = await itemId();

    await upload(page, id, {
      certificateType: "Food Safety Certificate",
      expiryDate: "2027-03-31T00:00:00.000Z",
      matchedTemplateId,
    });

    const card = fields(page, CARD);
    await expect(card.type).toHaveValue("Food Safety Certificate");
    await expect(card.date).toHaveValue("2027-03-31");
    await expect(card.covers).toHaveValue(String(matchedTemplateId));
    await expect(page.getByText("Suggested by AI.")).toBeVisible();
    await expect(card.type).toBeEditable();
  });

  // A blank date must never become Covered by itself, so the box stays for the user to tick.
  test("leaves the date empty and the box unticked when Gemini found no date", async ({ page }) => {
    const companyId = await setUpCompany(page);
    const id = await createDocument(companyId);

    await upload(page, id, {
      certificateType: "Food Safety Certificate",
      expiryDate: null,
      matchedTemplateId: await itemId(),
    });

    const card = fields(page, CARD);
    await expect(card.date).toHaveValue("");
    await expect(card.noExpiry).not.toBeChecked();
    await expect(card.save).toBeDisabled();
  });

  test("shows empty fields and a message when Gemini returned nothing", async ({ page }) => {
    const companyId = await setUpCompany(page);
    const id = await createDocument(companyId);

    await upload(page, id, null);

    const card = fields(page, CARD);
    await expect(page.getByText("This file could not be read.")).toBeVisible();
    await expect(card.type).toHaveValue("");
    await expect(card.date).toHaveValue("");
    await expect(card.noExpiry).not.toBeChecked();
    await expect(card.covers).toHaveValue("choose");
    await expect(card.save).toBeDisabled();
  });

  // Saving proves the stored value is plain text too, because the row then shows it.
  test("shows HTML in a suggestion as plain text and runs nothing", async ({ page }) => {
    const html = "<img src=x onerror=alert(1)>";
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    const companyId = await setUpCompany(page);
    const id = await createDocument(companyId);

    await upload(page, id, {
      certificateType: html,
      expiryDate: "2027-03-31T00:00:00.000Z",
      matchedTemplateId: await itemId(),
    });

    const card = fields(page, CARD);
    await expect(card.type).toHaveValue(html);
    await card.save.click();
    await expect(page.getByText(html, { exact: true })).toBeVisible();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(dialogs).toEqual([]);
  });
});

test.describe("an unconfirmed row", () => {
  test("keeps Save disabled until every question is answered", async ({ page }) => {
    const companyId = await setUpCompany(page);
    await createDocument(companyId);
    await page.goto("/documents");

    const row = fields(page, NEW_ROW);
    await expect(row.save).toBeDisabled();

    await row.type.fill("Food Safety Certificate");
    await expect(row.save).toBeDisabled();

    await row.date.fill("2027-03-31");
    await expect(row.save).toBeDisabled();

    await row.covers.selectOption({ label: ITEM_NAME });
    await expect(row.save).toBeEnabled();

    // Removing the date closes it again, and ticking the box is the other valid answer.
    await row.date.fill("");
    await expect(row.save).toBeDisabled();
    await row.noExpiry.check();
    await expect(row.save).toBeEnabled();

    // A blank type is still blank, even with spaces in it.
    await row.type.fill("   ");
    await expect(row.save).toBeDisabled();
  });

  // The suggestion only ever lived in the browser, so a reload loses it and saves nothing.
  test("shows no AI value after a reload before confirming", async ({ page }) => {
    const companyId = await setUpCompany(page);
    const id = await createDocument(companyId);
    await upload(page, id, {
      certificateType: "Food Safety Certificate",
      expiryDate: "2027-03-31T00:00:00.000Z",
      matchedTemplateId: await itemId(),
    });

    await page.reload();

    const row = fields(page, NEW_ROW);
    await expect(page.getByText("Not confirmed yet")).toBeVisible();
    await expect(row.type).toHaveValue("");
    await expect(row.date).toHaveValue("");
    await expect(row.covers).toHaveValue("choose");
    await expect(page.getByRole("link", { name: "View PDF" })).toBeVisible();
    await expect(page.getByRole("form", { name: CARD })).toHaveCount(0);

    const stored = await storedDocument(id);
    expect(stored.extractedType).toBeNull();
    expect(stored.expiryDate).toBeNull();
  });

  // An empty type used to mean the AI failed. Now it only means nobody has confirmed it.
  test("no longer says the AI could not read the file", async ({ page }) => {
    const companyId = await setUpCompany(page);
    await createDocument(companyId);

    await page.goto("/documents");

    await expect(page.getByText("Unnamed document")).toBeVisible();
    await expect(page.getByText("The AI could not read this file")).toHaveCount(0);
  });
});

test.describe("confirming and editing", () => {
  // The only test that sends the form's real request to the real route.
  test("saves the values the user typed, then closes the row", async ({ page }) => {
    const companyId = await setUpCompany(page);
    const id = await createDocument(companyId);
    await page.goto("/documents");

    const row = fields(page, NEW_ROW);
    await row.type.fill("Food Safety Certificate");
    await row.date.fill("2027-03-31");
    await row.covers.selectOption({ label: ITEM_NAME });
    await row.save.click();

    await expect(page.getByText(`Covers: ${ITEM_NAME}`)).toBeVisible();
    await expect(page.getByText("Expires 31 Mar 2027")).toBeVisible();
    await expect(page.getByRole("form")).toHaveCount(0);

    const stored = await storedDocument(id);
    expect(stored.extractedType).toBe("Food Safety Certificate");
    expect(stored.expiryDate).toBe("2027-03-31 00:00:00");
    expect(stored.requirementTemplateId).toBe(await itemId());
  });

  // "Not on my checklist" must still reach the admins, under the name the user confirmed.
  test("sends 'Not on my checklist' to the admins for review", async ({ page }) => {
    const companyId = await setUpCompany(page);
    const id = await createDocument(companyId);
    await page.goto("/documents");

    const row = fields(page, NEW_ROW);
    await row.type.fill("Unusual Permit");
    await row.noExpiry.check();
    await row.covers.selectOption({ label: "Not on my checklist" });
    await row.save.click();

    await expect(page.getByText("Waiting for admin review")).toBeVisible();

    const { rows } = await pool.query(
      'SELECT name, status FROM "PendingRequirement" WHERE "documentId" = $1',
      [id],
    );
    expect(rows).toEqual([{ name: "Unusual Permit", status: "PENDING_REVIEW" }]);
  });

  test("opens with Edit, and Cancel throws away the change", async ({ page }) => {
    const companyId = await setUpCompany(page);
    const id = await createDocument(companyId);
    await pool.query(
      'UPDATE "Document" SET "extractedType" = $1, "requirementTemplateId" = $2 WHERE id = $3',
      ["Saved Certificate", await itemId(), id],
    );
    await page.goto("/documents");

    const formName = "Confirm Saved Certificate";
    const editButton = page.getByRole("button", { name: `Edit: ${formName}` });
    const row = fields(page, formName);

    // Closed at first: the values are text, and there is no form.
    await expect(row.form).toHaveCount(0);

    await editButton.click();
    await row.type.fill("Abandoned change");

    await row.form.getByRole("button", { name: "Cancel" }).click();
    await expect(row.form).toHaveCount(0);

    await editButton.click();
    await expect(row.type).toHaveValue("Saved Certificate");
    expect((await storedDocument(id)).extractedType).toBe("Saved Certificate");
  });

  test("saves an edit and closes the row with the new value", async ({ page }) => {
    const companyId = await setUpCompany(page);
    const id = await createDocument(companyId);
    await pool.query(
      'UPDATE "Document" SET "extractedType" = $1, "requirementTemplateId" = $2 WHERE id = $3',
      ["Food Safty", await itemId(), id],
    );
    await page.goto("/documents");

    await page.getByRole("button", { name: "Edit: Confirm Food Safty" }).click();
    const row = fields(page, "Confirm Food Safty");
    await row.type.fill("Food Safety");
    await row.save.click();

    await expect(page.getByRole("button", { name: "Edit: Confirm Food Safety" })).toBeVisible();
    await expect(page.getByRole("form")).toHaveCount(0);
    expect((await storedDocument(id)).extractedType).toBe("Food Safety");
  });
});
