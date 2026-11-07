import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// The guard at the login door. Returns the user for a right email and password,
// and null for anything the user got wrong. A server failure is NOT null: it is
// logged and thrown, so the login page can tell "wrong password" from "server down".
export async function verifyCredentials(email: string, password: string) {
  try {
    // Look the person up by email.
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;

    // Compare the typed password with the stored hash.
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    // The shape Auth.js expects for a logged-in user.
    return { id: String(user.id), email: user.email, isAdmin: user.isAdmin };
  } catch (error) {
    // Log the real error for the developer. Only the error itself: never the email or password.
    console.error("Login check failed because of a server error:", error);
    // Rethrow, so the result is an error and not a "wrong password" null.
    throw error;
  }
}
