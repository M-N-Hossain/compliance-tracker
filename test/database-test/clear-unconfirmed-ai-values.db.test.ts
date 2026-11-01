// The one-time cleanup: it must clear unconfirmed AI values and touch nothing else.
// The migration already ran on an empty test database, so this runs its SQL again on real rows.
import { readdirSync, readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { clearTestData, createCompanyUser, createTemplate } from "@/test/support/test-data";

// test-data.ts imports this file, and the real one needs a login system these tests do not use.
vi.mock("@/lib/currentUser", () => ({ getCurrentUser: vi.fn() }));

const CATEGORY = "test_category";
const STORED_TYPE = "Stored Certificate";
const STORED_DATE = new Date("2027-03-31T00:00:00.000Z");

// Reads the real migration file, so this test can never drift away from what really runs.
function migrationSql() {
  const folder = readdirSync("prisma/migrations").find((name) =>
    name.endsWith("_clear_unconfirmed_ai_values"),
  );
  return readFileSync(`prisma/migrations/${folder}/migration.sql`, "utf8");
}

let companyId: number;

// A document with AI values already stored, plus whatever makes it linked or not.
function createStoredDocument(requirementTemplateId: number | null = null) {
  return prisma.document.create({
    data: {
      companyId,
      fileUrl: `company-${companyId}/fake.pdf`,
      extractedType: STORED_TYPE,
      expiryDate: STORED_DATE,
      requirementTemplateId,
    },
  });
}

// A document with a request for the admins, in the given status.
async function createDocumentWithRequest(status: "PENDING_REVIEW" | "APPROVED" | "REJECTED") {
  const document = await createStoredDocument();
  await prisma.pendingRequirement.create({
    data: {
      name: STORED_TYPE,
      category: CATEGORY,
      sourceCompanyId: companyId,
      documentId: document.id,
      status,
    },
  });
  return document;
}

// Reads the document straight from the database.
const stored = (id: number) => prisma.document.findUniqueOrThrow({ where: { id } });

// A fresh start for every test: one company and no documents.
beforeEach(async () => {
  await clearTestData();
  companyId = (await createCompanyUser("Company A", CATEGORY)).companyId!;
});

// Leave nothing behind, and close the connection so the run can finish.
afterAll(async () => {
  await clearTestData();
  await prisma.$disconnect();
});

describe("clear_unconfirmed_ai_values migration", () => {
  // The whole point: nobody confirmed these values, so they go.
  it("clears the type and date of an undecided document", async () => {
    const document = await createStoredDocument();

    await prisma.$executeRawUnsafe(migrationSql());

    expect((await stored(document.id)).extractedType).toBeNull();
    expect((await stored(document.id)).expiryDate).toBeNull();
  });

  // The user acted on these values by linking the document.
  it("keeps the values of a linked document", async () => {
    const template = await createTemplate(CATEGORY, "Test requirement");
    const document = await createStoredDocument(template.id);

    await prisma.$executeRawUnsafe(migrationSql());

    expect((await stored(document.id)).extractedType).toBe(STORED_TYPE);
    expect((await stored(document.id)).expiryDate).toEqual(STORED_DATE);
  });

  // Any request counts, whatever the admin decided, because the user chose to send it.
  it.each(["PENDING_REVIEW", "APPROVED", "REJECTED"] as const)(
    "keeps the values of a document with a %s request",
    async (status) => {
      const document = await createDocumentWithRequest(status);

      await prisma.$executeRawUnsafe(migrationSql());

      expect((await stored(document.id)).extractedType).toBe(STORED_TYPE);
      expect((await stored(document.id)).expiryDate).toEqual(STORED_DATE);
    },
  );

  // A cleanup must never lose a document or the file it points to.
  it("deletes no row and keeps the file key", async () => {
    const document = await createStoredDocument();
    await createDocumentWithRequest("PENDING_REVIEW");

    await prisma.$executeRawUnsafe(migrationSql());

    expect(await prisma.document.count()).toBe(2);
    expect(await prisma.pendingRequirement.count()).toBe(1);
    expect((await stored(document.id)).fileUrl).toBe(document.fileUrl);
  });
});
