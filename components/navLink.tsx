"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      // aria-current tells screen readers "you are here", not just colour.
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "bg-brand-soft text-brand rounded-md px-3.5 py-2.5 font-medium"
          : "text-body hover:bg-canvas rounded-md px-3.5 py-2.5"
      }
    >
      {children}
    </Link>
  );
}
