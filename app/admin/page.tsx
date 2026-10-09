import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { formatCategory } from "@/utils/category";
import { formatDate } from "@/utils/formatDate";
import ReviewForm from "./reviewForm";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!user.isAdmin) {
    redirect("/dashboard");
  }

  const pending = await prisma.pendingRequirement.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { createdAt: "asc" },
    include: {
      // Only the fields we show. "select" inside "include" keeps
      // the query small and avoids sending unused data.
      sourceCompany: { select: { name: true } },
      document: { select: { expiryDate: true } },
    },
  });

  return (
    <main className="mx-auto mt-20 max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Admin</h1>

      <div>
        <h2 className="text-lg font-medium">Pending requests ({pending.length})</h2>
        <p className="text-xs text-gray-500">
          Documents users confirmed are not on their checklist. Approving one adds it as a checklist
          item for that category, or for all businesses.
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing to review.</p>
      ) : (
        <ul className="space-y-2">
          {pending.map((p) => (
            <li key={p.id} className="space-y-1 rounded border p-3">
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-gray-600">Category: {formatCategory(p.category)}</p>
              <p className="text-sm text-gray-600">
                From: {p.sourceCompany.name} · {formatDate(p.createdAt)}
              </p>
              <p className="text-xs text-gray-500">
                Expiry on document:{" "}
                {p.document?.expiryDate ? formatDate(p.document.expiryDate) : "none"}
              </p>
              <ReviewForm id={p.id} name={p.name} categoryLabel={formatCategory(p.category)} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
