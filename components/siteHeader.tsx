// components/site-header.tsx
import Link from "next/link";
import { signOut } from "@/auth";
import NavLink from "./navLink";

type Props = {
  homeHref: string;
  links: { href: string; label: string }[];
};

export default function SiteHeader({ homeHref, links }: Props) {
  return (
    <header className="border-line border-b bg-white">
      <nav
        aria-label="Main"
        className="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-3 px-6"
      >
        <Link href={homeHref} className="text-ink text-[17px] font-semibold">
          Compliance Tracker
        </Link>

        <div className="flex flex-wrap items-center gap-1">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href}>
              {l.label}
            </NavLink>
          ))}

          {/* Server Action: the form posts to a server function Next.js creates.
              signOut clears the auth cookie, then redirects to /login. */}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="border-line text-body hover:bg-canvas ml-2 rounded-md border px-3.5 py-2.5"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
