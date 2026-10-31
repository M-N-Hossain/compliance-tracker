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

// Sends a PATCH with the chosen template, like the checklist dropdown does.
function patchDocument(id: number, requirementTemplateId: number | null) {
  const request = new Request(`http://localhost/api/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ requirementTemplateId }),
  });
  return PATCH(request, paramsFor(id));
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

  it("gives company B a 404 on company A's document and changes nothing", async () => {
    logInAs(companyB);

    const response = await patchDocument(documentOfA.id, template.id);

    expect(response.status).toBe(404);
    expect((await storedDocument()).requirementTemplateId).toBeNull();
  });

  // A company's own document still cannot use an item from another business type's checklist.
  it("refuses a template from outside the company's checklist", async () => {
    const otherTemplate = await createTemplate("other_test_category", "Other requirement");
    logInAs(companyA);

    const response = await patchDocument(documentOfA.id, otherTemplate.id);

    expect(response.status).toBe(400);
    expect((await storedDocument()).requirementTemplateId).toBeNull();
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
