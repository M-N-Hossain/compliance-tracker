import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Returns the user for a right email and password, and null for anything the user got wrong.
// A server failure is not null: it throws, so the login page can tell it from "wrong password".
export async function verifyCredentials(email: string, password: string) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    return { id: String(user.id), email: user.email, isAdmin: user.isAdmin };
  } catch (error) {
    // Log only name and code: a Prisma error message can quote the query, and so the email.
    const { name, code } = (error ?? {}) as { name?: string; code?: string };
    console.error("Login check failed because of a server error:", name, code);
    // A new error, not the original: Auth.js logs the thrown error's stack, which starts with
    // its message.
    throw new Error(`Login check failed (${name} ${code})`);
  }
}
