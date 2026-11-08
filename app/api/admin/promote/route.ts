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

  const { email } = await req.json();
  const target = await prisma.user.findUniqueOrThrow({ where: { email: email.trim() } });
  await prisma.user.update({ where: { id: target.id }, data: { isAdmin: true } });

  return NextResponse.json({
    status: "promoted",
    // The new admin's token was made at login, so it still says isAdmin: false.
    message: "They must log out and in again before the admin page opens for them.",
  });
}
