import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatCategory } from "@/utils/category";
import { formatDate } from "@/utils/date";
import ReviewForm from "./reviewForm";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/dashboard");

  // The queue: undecided requests, oldest first.
  const pending = await prisma.pendingRequirement.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { createdAt: "asc" },
    include: {
      sourceCompany: { select: { name: true } },
      document: { select: { id: true, expiryDate: true } }, // id: for View PDF
    },
  });

  // For each name (ignoring case), which companies asked for it.
  // A Set keeps each company id once, so we count companies, not requests.
  const companiesByName = new Map<string, Set<number>>();
  for (const p of pending) {
    const key = p.name.toLowerCase();
    if (!companiesByName.has(key)) companiesByName.set(key, new Set());
    companiesByName.get(key)!.add(p.sourceCompanyId);
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 pt-8 pb-16">
      <div>
        <p className="text-muted font-mono text-xs tracking-wider uppercase">Admin</p>
        <h1 className="text-3xl font-semibold">Pending requests ({pending.length})</h1>
        <p className="text-muted mt-1.5">
          Documents users confirmed are not on their checklist. Approving one adds a checklist item
          for that category, or for all businesses.
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="border-line text-muted rounded-xl border bg-white px-5 py-6">
          Nothing to review.
        </p>
      ) : (
        pending.map((p) => {
          // Other companies asking for the same thing (this one excluded).
          const others = (companiesByName.get(p.name.toLowerCase())?.size ?? 1) - 1;

          return (
            <article
              key={p.id}
              className="border-line flex flex-wrap gap-6 rounded-xl border bg-white p-5"
            >
              {/* Left: what was requested, and by whom */}
              <div className="flex flex-[1_1_280px] flex-col gap-1.5">
                <h2 className="text-lg font-semibold">{p.name}</h2>
                <p className="text-muted text-sm">
                  From {p.sourceCompany.name} · {formatCategory(p.category)} ·{" "}
                  {formatDate(p.createdAt)}
                </p>
                <p className="text-muted text-sm">
                  Expiry on document:{" "}
                  {p.document?.expiryDate ? formatDate(p.document.expiryDate) : "none"}
                </p>

                {others > 0 && (
                  <p className="bg-canvas text-body mt-1 self-start rounded-md px-2.5 py-1.5 text-sm">
                    Also requested by {others} other {others === 1 ? "company" : "companies"}
                  </p>
                )}

                {/* The admin can open it because the file route allows admins. */}
                {p.document && (
                  <a
                    href={`/api/documents/${p.document.id}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:text-brand-dark mt-1 self-start text-sm font-medium"
                  >
                    View PDF
                  </a>
                )}
              </div>

              {/* Right: the decision */}
              <ReviewForm id={p.id} name={p.name} categoryLabel={formatCategory(p.category)} />
            </article>
          );
        })
      )}
    </main>
  );
}
