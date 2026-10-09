// lib/pending-requirements.ts
import { prisma } from "@/lib/prisma";

// Enforces one rule:
//   a document has a pending request if and only if it is unmatched.
// Call it after ANYTHING changes a document's match (upload, PATCH).
// Idempotent: calling it again changes nothing.
export async function syncPendingRequirement(documentId: number) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { company: true, pendingRequirement: true },
  });
  if (!document) return;

  const isMatched = document.requirementTemplateId !== null;

  const pending = document.pendingRequirement; // null if none

  if (isMatched) {
    if (pending && pending.status === "PENDING_REVIEW") {
      await prisma.pendingRequirement.delete({ where: { id: pending.id } });
    }
    return;
  }

  if (pending) return;

  // Nothing to suggest if the AI couldn't read a type,
  // or if the company has no category yet.
  if (!document.extractedType || !document.company.category) return;

  await prisma.pendingRequirement.create({
    data: {
      name: document.extractedType,
      category: document.company.category,
      sourceCompanyId: document.companyId,
      documentId: document.id,
    },
  });
}
