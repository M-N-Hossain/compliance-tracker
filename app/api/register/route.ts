import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SERVER_ERROR_MESSAGE } from "@/lib/authMessages";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Email and a password of at least 8 characters are required." },
      { status: 400 },
    );
  }

  // Everything below talks to the database, so a failure here is a server problem.
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, passwordHash },
    });

    return NextResponse.json({ id: user.id, email: user.email });
  } catch (error) {
    // Log only the kind of error (its name and code). The message is left out on purpose:
    // a Prisma error can quote the query, which would put the email in the log.
    const { name, code } = (error ?? {}) as { name?: string; code?: string };
    console.error("Sign-up failed because of a server error:", name, code);
    // A calm answer the page can read, with no internal details in it.
    return NextResponse.json({ error: SERVER_ERROR_MESSAGE }, { status: 500 });
  }
}
