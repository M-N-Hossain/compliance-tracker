import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GENERAL_CATEGORY } from "@/utils/category";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { name, description, category } = await request.json();

  if (typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  }
  if (typeof description !== "string" || description.trim().length < 10) {
    return NextResponse.json({ error: "Description is required." }, { status: 400 });
  }
  if (typeof category !== "string") {
    return NextResponse.json({ error: "Category is required." }, { status: 400 });
  }

  const userId = Number(session.user.id);

  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (existingUser?.companyId) {
    return NextResponse.json({ error: "You already have a company set up." }, { status: 409 });
  }

  // "general" exists as a template category, but it is not a kind of business.
  // The dropdown never offers it; this stops anyone sending it directly.
  if (category === GENERAL_CATEGORY) {
    return NextResponse.json({ error: "Not a recognized category." }, { status: 400 });
  }

  const validCategory = await prisma.requirementTemplate.findFirst({ where: { category } });
  if (!validCategory) {
    return NextResponse.json({ error: "Not a recognized category." }, { status: 400 });
  }

  const company = await prisma.$transaction(async (tx) => {
    const newCompany = await tx.company.create({ data: { name, description, category } });
    await tx.user.update({
      where: { id: userId },
      data: { companyId: newCompany.id },
    });
    return newCompany;
  });

  return NextResponse.json({ id: company.id, name: company.name, category: company.category });
}
