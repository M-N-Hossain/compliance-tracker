// The cross-tenant test: one company must never reach another company's documents.
// These call the real route handlers against the real test database.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getFile } from "@/app/api/documents/[id]/file/route";
import { PATCH } from "@/app/api/documents/[id]/route";
import { prisma } from "@/lib/prisma";
import {
  clearTestData,
  createCompanyUser,
  createDocument,
  createTemplate,
  createUserWithoutCompany,
  logInAs,
} from "@/test/support/test-data";

// Vitest cannot produce a real login session, so the logged-in user is chosen by each test.
// The browser smoke test covers real login.
vi.mock("@/lib/currentUser", () => ({ getCurrentUser: vi.fn() }));

// Both companies share a category, so the template is valid for each of them.
// If company B is refused, the ownership check must be what refused it.
const CATEGORY = "test_category";

// The route handlers receive their id as a promise.
const paramsFor = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

// Sends any body at all, for the tests about bodies the route must refuse.
function sendPatch(id: number, body: unknown) {
  const request = new Request(`http://localhost/api/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return PATCH(request, paramsFor(id));
}

// The values a user confirms in these tests, different from what createDocument stores.
const CONFIRMED_TYPE = "Confirmed Certificate";
const CONFIRMED_DATE = "2027-03-31";

// Sends a complete, valid body, like the confirm form does. "changes" replaces single fields.
function patchDocument(
  id: number,
  requirementTemplateId: number | null,
  changes: Record<string, unknown> = {},
) {
  return sendPatch(id, {
    certificateType: CONFIRMED_TYPE,
    expiryDate: CONFIRMED_DATE,
    requirementTemplateId,
    ...changes,
  });
}

// Sends a GET, like the "View PDF" link does.
function getDocumentFile(id: number) {
  return getFile(new Request(`http://localhost/api/documents/${id}/file`), paramsFor(id));
}

// A fresh start for every test: company A with a document, company B, and a template.
let companyA: Awaited<ReturnType<typeof createCompanyUser>>;
let companyB: Awaited<ReturnType<typeof createCompanyUser>>;
let documentOfA: Awaited<ReturnType<typeof createDocument>>;
let template: Awaited<ReturnType<typeof createTemplate>>;

beforeEach(async () => {
  await clearTestData();
  companyA = await createCompanyUser("Company A", CATEGORY);
  companyB = await createCompanyUser("Company B", CATEGORY);
  documentOfA = await createDocument(companyA.companyId!);
  template = await createTemplate(CATEGORY, "Test requirement");
});

// Leave nothing behind, and close the connection so the run can finish.
afterAll(async () => {
  await clearTestData();
  await prisma.$disconnect();
});

// Reads the document straight from the database, without going through a route.
const storedDocument = () => prisma.document.findUniqueOrThrow({ where: { id: documentOfA.id } });

describe("PATCH /api/documents/:id", () => {
  // Without this, the 404 below could just mean the route is broken for everyone.
  it("lets a company change its own document", async () => {
    logInAs(companyA);

    const response = await patchDocument(documentOfA.id, template.id);

    expect(response.status).toBe(200);
    expect((await storedDocument()).requirementTemplateId).toBe(template.id);
  });

  // The heart of confirming: all three values are saved together, as the user sent them.
  it("stores the confirmed type, date and checklist item", async () => {
    logInAs(companyA);

    const response = await patchDocument(documentOfA.id, template.id, {
      certificateType: `  ${CONFIRMED_TYPE}  `,
    });
    const stored = await storedDocument();

    expect(response.status).toBe(200);
    expect(stored.extractedType).toBe(CONFIRMED_TYPE);
    expect(stored.expiryDate).toEqual(new Date(`${CONFIRMED_DATE}T00:00:00.000Z`));
    expect(stored.requirementTemplateId).toBe(template.id);
  });

  // Null is the user saying "No expiry date", and it replaces any date stored before.
  it("stores no expiry date when the user sends null", async () => {
    await prisma.document.update({
      where: { id: documentOfA.id },
      data: { expiryDate: new Date("2030-01-01T00:00:00.000Z") },
    });
    logInAs(companyA);

    const response = await patchDocument(documentOfA.id, template.id, { expiryDate: null });

    expect(response.status).toBe(200);
    expect((await storedDocument()).expiryDate).toBeNull();
  });

  // Admins must review the name the user confirmed, not the one stored before.
  it("names the pending request with the type the user sent", async () => {
    logInAs(companyA);

    const response = await patchDocument(documentOfA.id, null);
    const pending = await prisma.pendingRequirement.findUniqueOrThrow({
      where: { documentId: documentOfA.id },
    });

    expect(response.status).toBe(200);
    expect(pending.name).toBe(CONFIRMED_TYPE);
  });

  // Uploading an expired certificate is allowed, and the dashboard then shows Expired.
  it("stores an expiry date in the past", async () => {
    logInAs(companyA);

    const response = await patchDocument(documentOfA.id, template.id, {
      expiryDate: "2001-01-31",
    });

    expect(response.status).toBe(200);
    expect((await storedDocument()).expiryDate).toEqual(new Date("2001-01-31T00:00:00.000Z"));
  });

  // The validator's own tests cover every shape. These prove the route really uses it,
  // and that a refused body changes nothing at all.
  it.each([
    ["only requirementTemplateId, as the old dropdown sent", { requirementTemplateId: null }],
    ["no type", { expiryDate: CONFIRMED_DATE, requirementTemplateId: null }],
    ["no date", { certificateType: CONFIRMED_TYPE, requirementTemplateId: null }],
    ["no checklist item", { certificateType: CONFIRMED_TYPE, expiryDate: CONFIRMED_DATE }],
  ])("refuses a body with %s and changes nothing", async (_name, body) => {
    logInAs(companyA);
    const before = await storedDocument();

    const response = await sendPatch(documentOfA.id, body);

    expect(response.status).toBe(400);
    expect(await storedDocument()).toEqual(before);
  });

  it.each([
    ["a type that is not text", { certificateType: 5 }],
    ["a blank type", { certificateType: "   " }],
    ["a type over 200 characters", { certificateType: "a".repeat(201) }],
    ["an impossible date", { expiryDate: "2026-02-31" }],
    ["a date in the wrong format", { expiryDate: "31/03/2027" }],
  ])("refuses %s and changes nothing", async (_name, changes) => {
    logInAs(companyA);
    const before = await storedDocument();

    const response = await patchDocument(documentOfA.id, template.id, changes);

    expect(response.status).toBe(400);
    expect(await storedDocument()).toEqual(before);
    expect(await prisma.pendingRequirement.count()).toBe(0);
  });

  // Every field is checked, because all three are now written from this one request.
  it("gives company B a 404 on company A's document and changes nothing", async () => {
    logInAs(companyB);
    const before = await storedDocument();

    const response = await patchDocument(documentOfA.id, template.id);

    expect(response.status).toBe(404);
    expect(await storedDocument()).toEqual(before);
  });

  // A company's own document still cannot use an item from another business type's checklist.
  // The type and date must not be saved either, even though they are valid.
  it("refuses a template from outside the company's checklist", async () => {
    const otherTemplate = await createTemplate("other_test_category", "Other requirement");
    logInAs(companyA);
    const before = await storedDocument();

    const response = await patchDocument(documentOfA.id, otherTemplate.id);

    expect(response.status).toBe(400);
    expect(await storedDocument()).toEqual(before);
  });

  // Saying "null" also triggers pending request logic, which must not run for an outsider.
  it("creates no pending request when company B sends null", async () => {
    logInAs(companyB);

    const response = await patchDocument(documentOfA.id, null);

    expect(response.status).toBe(404);
    expect(await prisma.pendingRequirement.count()).toBe(0);
  });

  // Identical answers, so company B cannot use them to discover which ids exist.
  it("answers the same for another company's document and a missing one", async () => {
    logInAs(companyB);

    const theirs = await patchDocument(documentOfA.id, template.id);
    const missing = await patchDocument(documentOfA.id + 100_000, template.id);

    expect(theirs.status).toBe(missing.status);
    expect(await theirs.json()).toEqual(await missing.json());
  });

  it("gives 401 when nobody is logged in and changes nothing", async () => {
    logInAs(null);

    const response = await patchDocument(documentOfA.id, template.id);

    expect(response.status).toBe(401);
    expect((await storedDocument()).requirementTemplateId).toBeNull();
  });

  it("refuses a user with no company and changes nothing", async () => {
    logInAs(await createUserWithoutCompany("no-company@example.test"));

    const response = await patchDocument(documentOfA.id, template.id);

    expect(response.status).toBe(400);
    expect((await storedDocument()).requirementTemplateId).toBeNull();
  });
});

describe("GET /api/documents/:id/file", () => {
  it("sends a company to a signed link for its own document", async () => {
    logInAs(companyA);

    const response = await getDocumentFile(documentOfA.id);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(documentOfA.fileUrl);
    expect(response.headers.get("location")).toContain("X-Amz-Signature");
  });

  // This is the route that hands out the actual PDF, so no link may leak.
  it("gives company B a 404 and no link on company A's document", async () => {
    logInAs(companyB);

    const response = await getDocumentFile(documentOfA.id);

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).not.toContain(documentOfA.fileUrl);
  });

  it("sends a visitor who is not logged in to the login page", async () => {
    logInAs(null);

    const response = await getDocumentFile(documentOfA.id);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("gives a user with no company a 404", async () => {
    logInAs(await createUserWithoutCompany("no-company@example.test"));

    const response = await getDocumentFile(documentOfA.id);

    expect(response.status).toBe(404);
  });

  // The one intended exception: admins review other companies' pending requests.
  it("lets an admin open any company's document", async () => {
    logInAs(await createUserWithoutCompany("admin@example.test", true));

    const response = await getDocumentFile(documentOfA.id);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(documentOfA.fileUrl);
  });
});
