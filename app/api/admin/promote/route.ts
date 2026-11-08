import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { SERVER_ERROR_MESSAGE } from "@/utils/authMessages";

// The try wraps everything, because on an outage getCurrentUser is the first call to fail.
export async function POST(req: Request) {
  try {
    // "return await", so a rejected promise is caught here and not passed on.
    return await promote(req);
  } catch (error) {
    // Log only name and code: a Prisma error message can quote the query, and so the email.
    const { name, code } = (error ?? {}) as { name?: string; code?: string };
    console.error("Promote failed because of a server error:", name, code);
    return NextResponse.json({ error: SERVER_ERROR_MESSAGE }, { status: 500 });
  }
}

async function promote(req: Request) {
  // getCurrentUser reads isAdmin from the database, so a stale login token cannot pass.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  // Review finding F1: a text/plain POST needs no preflight, and SameSite=Lax still sends the
  // login cookie from another port or a sibling subdomain. Another origin can only send
  // application/json after a preflight, which this app never allows.
  const contentType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return NextResponse.json({ error: "Expected application/json" }, { status: 415 });
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
  // Ids, not emails: enough to trace who did it, without personal data in the log.
  console.info("Admin", user.id, "promoted user", target.id, "to admin.");

  return NextResponse.json({
    status: "promoted",
    // The new admin's token was made at login, so it still says isAdmin: false.
    message: "They must log out and in again before the admin page opens for them.",
  });
}
