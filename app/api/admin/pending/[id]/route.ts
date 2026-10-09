import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { GENERAL_CATEGORY } from "@/utils/category";

// POST /api/admin/pending/:id
// Body: { action: "reject" }
// or { action: "approve", name, scope: "category" | "general", renewalPeriod }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  // id parsing as the documents PATCH route.
  const { id } = await params;
  const pendingId = Number(id);
  if (!Number.isInteger(pendingId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  //  Read the body.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  // Reject: a single write, so no transaction needed
  if (body.action === "reject") {
    // Claim it: only changes the row if it is still pending.
    const result = await prisma.pendingRequirement.updateMany({
      where: { id: pendingId, status: "PENDING_REVIEW" },
      data: { status: "REJECTED" },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Already decided or not found" }, { status: 409 });
    }
    return NextResponse.json({ status: "REJECTED" });
  }

  if (body.action !== "approve") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // Approve: validate the admin's input first ──
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const renewalPeriod = typeof body.renewalPeriod === "string" ? body.renewalPeriod.trim() : "";
  const scope = body.scope;
  if (!name || !renewalPeriod) {
    return NextResponse.json({ error: "Name and renewal period are required" }, { status: 400 });
  }
  if (scope !== "category" && scope !== "general") {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  // Everything below happens inside ONE transaction.
  // Every write uses "tx", not "prisma". If anything throws, all of it is undone.
  const result = await prisma.$transaction(async (tx) => {
    // a) Claim it first (protects against double clicks and two admins).
    const claimed = await tx.pendingRequirement.updateMany({
      where: { id: pendingId, status: "PENDING_REVIEW" },
      data: { status: "APPROVED" },
    });
    if (claimed.count === 0) return null;

    // b) Now read the request we just claimed.
    const pending = await tx.pendingRequirement.findUniqueOrThrow({
      where: { id: pendingId },
    });

    // c) Where the new checklist item lives.
    const category = scope === "general" ? GENERAL_CATEGORY : pending.category;

    // d) Find it or create it. If it already exists, the admin's
    //    renewalPeriod is ignored ("update: {}" changes nothing).
    const template = await tx.requirementTemplate.upsert({
      where: { category_name: { category, name } },
      update: {},
      create: { category, name, renewalPeriod },
    });

    // e) Other undecided requests for the same thing (case-insensitive name).
    //    "general" covers every category; otherwise only the same category.
    const others = await tx.pendingRequirement.findMany({
      where: {
        status: "PENDING_REVIEW",
        name: { equals: pending.name, mode: "insensitive" },
        ...(scope === "general" ? {} : { category: pending.category }),
      },
      select: { id: true, documentId: true },
    });
    if (others.length > 0) {
      await tx.pendingRequirement.updateMany({
        where: { id: { in: others.map((o) => o.id) } },
        data: { status: "APPROVED" },
      });
    }

    // f) Tick every related document on its company's checklist.
    //    documentId is optional, so filter out the nulls first.
    const documentIds = [pending, ...others]
      .map((p) => p.documentId)
      .filter((d): d is number => d !== null);
    if (documentIds.length > 0) {
      await tx.document.updateMany({
        where: { id: { in: documentIds } },
        data: { requirementTemplateId: template.id },
      });
    }

    return { templateId: template.id, resolved: 1 + others.length };
  });

  if (!result) {
    return NextResponse.json({ error: "Already decided or not found" }, { status: 409 });
  }
  return NextResponse.json(result);
}
