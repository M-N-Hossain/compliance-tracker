import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { checklistCategories } from "@/utils/category";
import { parseConfirmPayload } from "@/utils/confirmPayload";
import { syncPendingRequirement } from "@/lib/pendingRequirements";

// PATCH /api/documents/:id
// The confirm endpoint: saves the type, expiry date and checklist item the user confirmed.
// Body: { certificateType: string,
//         expiryDate: "YYYY-MM-DD" | null,      (null = "no expiry date")
//         requirementTemplateId: number | null } (null = "not on my checklist")
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

  // Check the shape of all three values. Nothing the browser sends is trusted.
  const parsed = parseConfirmPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { certificateType, expiryDate, requirementTemplateId: templateId } = parsed.data;

  // If a template was chosen, it must be on THIS company's checklist:
  // its own category or general.
  if (templateId !== null) {
    if (!company.category) {
      return NextResponse.json({ error: "Set up your company first" }, { status: 400 });
    }
    const template = await prisma.requirementTemplate.findFirst({
      where: {
        id: templateId,
        category: { in: checklistCategories(company.category) },
      },
    });
    if (!template) {
      return NextResponse.json({ error: "Not on your checklist" }, { status: 400 });
    }
  }

  // Everything checked: save the user's decision, all three values in one write.
  const updated = await prisma.document.update({
    where: { id: document.id },
    data: {
      extractedType: certificateType,
      expiryDate,
      requirementTemplateId: templateId,
    },
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
