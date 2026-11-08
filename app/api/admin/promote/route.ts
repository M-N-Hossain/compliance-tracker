import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  // getCurrentUser reads isAdmin from the database, so a stale login token cannot pass.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  let body: { email?: unknown } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "An email is required" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) {
    // The email is not repeated, to keep personal data out of error answers.
    return NextResponse.json({ error: "No user with that email" }, { status: 404 });
  }
  if (target.isAdmin) {
    return NextResponse.json({ status: "already-admin" });
  }

  await prisma.user.update({ where: { id: target.id }, data: { isAdmin: true } });

  return NextResponse.json({
    status: "promoted",
    // The new admin's token was made at login, so it still says isAdmin: false.
    message: "They must log out and in again before the admin page opens for them.",
  });
}
