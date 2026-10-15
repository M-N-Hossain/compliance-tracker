import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isProtectedRoute =
    req.nextUrl.pathname.startsWith("/dashboard") || req.nextUrl.pathname.startsWith("/admin");

  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");

  if (isProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  } else if (isLoggedIn && isAdminRoute && !req.auth?.user?.isAdmin) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/documents/:path*", "/admin/:path*", "/company/:path*"],
};
