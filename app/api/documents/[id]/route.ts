import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { checklistCategories } from "@/utils/category";
import { syncPendingRequirement } from "@/lib/pendingRequirements";

// PATCH /api/documents/:id
// Lets the user confirm or change which checklist item a document covers.
// Body: { requirementTemplateId: number | null }   (null = "not on my checklist")
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  const company = user.company;
  if (!company) {
    return NextResponse.json({ error: "Set up your company first" }, { status: 400 });
  }

  // parsing id
  const { id } = await params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId)) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }

  // IDOR protection: find the document only if it belongs to this company.
  // Not theirs and doesn't exist look identical: 404 either way.
  const document = await prisma.document.findFirst({
    where: { id: documentId, companyId: company.id },
  });
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Read the body. Malformed JSON throws, so guard it.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("requirementTemplateId" in body)) {
    return NextResponse.json({ error: "requirementTemplateId is required" }, { status: 400 });
  }
  const templateId = (body as { requirementTemplateId: unknown }).requirementTemplateId;

  // Allowed values: null ("not on my checklist") or a whole number.
  if (templateId !== null && !Number.isInteger(templateId)) {
    return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
  }

  // If a template was chosen, it must be on THIS company's checklist:
  // its own category or general.
  if (templateId !== null) {
    if (!company.category) {
      return NextResponse.json({ error: "Set up your company first" }, { status: 400 });
    }
    const template = await prisma.requirementTemplate.findFirst({
      where: {
        id: templateId as number,
        category: { in: checklistCategories(company.category) },
      },
    });
    if (!template) {
      return NextResponse.json({ error: "Not on your checklist" }, { status: 400 });
    }
  }

  // Everything checked: save the user's decision.
  const updated = await prisma.document.update({
    where: { id: document.id },
    data: { requirementTemplateId: templateId as number | null },
  });

  // most provably we remove it.
  try {
    await syncPendingRequirement(updated.id);
  } catch (err) {
    console.error("Syncing pending requirement failed:", err);
  }

  return NextResponse.json({
    id: updated.id,
    requirementTemplateId: updated.requirementTemplateId,
  });
}
