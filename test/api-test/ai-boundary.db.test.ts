// The AI boundary: the AI may suggest, but only the user may decide.
// These run the real upload route and real extraction code against the test database.
// Only the Gemini network function and R2's send() are replaced.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/documents/[id]/route";
import { POST } from "@/app/api/documents/route";
import { prisma } from "@/lib/prisma";
import { scriptGeminiAnswer, scriptGeminiFailure } from "@/test/support/fakes/gemini";
import { useFakeR2 } from "@/test/support/fakes/r2";
import {
  clearTestData,
  createCompanyUser,
  createTemplate,
  logInAs,
} from "@/test/support/test-data";

// Vitest cannot produce a real login session, so each test chooses the logged-in user.
vi.mock("@/lib/currentUser", () => ({ getCurrentUser: vi.fn() }));

// Keep the real gemini file, and replace only the function that uses the network.
vi.mock("@/lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/gemini")>()),
  generateWithRetry: vi.fn(),
}));

const CATEGORY = "test_category";
const TEMPLATE_NAME = "Food Safety";

// Sends one PDF to the real upload route, like the upload form does.
function uploadPdf() {
  const formData = new FormData();
  formData.set("file", new File(["%PDF-1.4 fake"], "certificate.pdf"));
  const request = new Request("http://localhost/api/documents", {
    method: "POST",
    body: formData,
  });
  return POST(request);
}

// Reads the document straight from the database, without going through a route.
const storedDocument = (id: number) => prisma.document.findUniqueOrThrow({ where: { id } });

let storedFiles: ReturnType<typeof useFakeR2>;
let template: Awaited<ReturnType<typeof createTemplate>>;

// A fresh start for every test: one logged-in company, its checklist item and empty storage.
beforeEach(async () => {
  await clearTestData();
  storedFiles = useFakeR2();
  template = await createTemplate(CATEGORY, TEMPLATE_NAME);
  logInAs(await createCompanyUser("Company A", CATEGORY));

  // The AI is confident here: it reads a type and a date, and picks a checklist item.
  scriptGeminiAnswer({
    certificateType: "Food Safety Certificate",
    expiryDate: "2027-03-31",
    matchedTemplate: TEMPLATE_NAME,
  });
});

// Put the real send() back, so the fake cannot leak into another test.
afterEach(() => {
  vi.restoreAllMocks();
});

// Leave nothing behind, and close the connection so the run can finish.
afterAll(async () => {
  await clearTestData();
  await prisma.$disconnect();
});

describe("AI boundary on upload", () => {
  // The heart of the boundary: the AI's choice comes back as a suggestion and is not saved.
  it("returns the AI's match as a suggestion but does not save it", async () => {
    const response = await uploadPdf();
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.extracted.matchedTemplateId).toBe(template.id);
    expect((await storedDocument(body.id)).requirementTemplateId).toBeNull();
  });

  // The dashboard only counts linked documents, so this item must still be uncovered.
  it("leaves the checklist item uncovered until the user decides", async () => {
    await uploadPdf();

    expect(await prisma.document.count({ where: { requirementTemplateId: template.id } })).toBe(0);
  });

  // A request to the admins is a decision too, so the AI must not create one.
  it("creates no pending request by itself", async () => {
    await uploadPdf();

    expect(await prisma.pendingRequirement.count()).toBe(0);
  });

  // Only the user's confirmation creates the link.
  it("links the document once the user confirms", async () => {
    const { id } = await (await uploadPdf()).json();

    const request = new Request(`http://localhost/api/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ requirementTemplateId: template.id }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: String(id) }) });

    expect(response.status).toBe(200);
    expect((await storedDocument(id)).requirementTemplateId).toBe(template.id);
  });

  // Model output is untrusted, so a name that is not on the checklist must be dropped.
  it("ignores a match that is not on the company's checklist", async () => {
    scriptGeminiAnswer({
      certificateType: "Food Safety Certificate",
      expiryDate: null,
      matchedTemplate: "Something the AI made up",
    });

    const body = await (await uploadPdf()).json();

    expect(body.extracted.matchedTemplateId).toBeNull();
    expect((await storedDocument(body.id)).requirementTemplateId).toBeNull();
  });

  // An AI outage must not lose the user's file.
  it("keeps the upload and saves no AI values when Gemini fails", async () => {
    scriptGeminiFailure();

    const response = await uploadPdf();
    const body = await response.json();
    const document = await storedDocument(body.id);

    expect(response.status).toBe(201);
    expect(body.extracted).toBeNull();
    expect(document.extractedType).toBeNull();
    expect(storedFiles.has(document.fileUrl)).toBe(true);
  });

  // KNOWN GAP, not fixed during setup: the first feature of the Phase 6 dry run.
  // The route saves these two AI values before the user confirms them.
  // it.fails means "this is wrong today". When the gap is fixed this reports a failure,
  // which is the reminder to change it.fails to it.
  it.fails("saves no AI values before the user confirms them", async () => {
    const { id } = await (await uploadPdf()).json();
    const document = await storedDocument(id);

    expect(document.extractedType).toBeNull();
    expect(document.expiryDate).toBeNull();
  });
});
