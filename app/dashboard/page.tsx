import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import UploadForm from "./uploadForm";
import { checklistCategories, formatCategory, GENERAL_CATEGORY } from "@/utils/category";
import { formatDate } from "@/utils/formatDate";

export default async function DashboardPage() {
  // Not logged in (or user deleted) -> login page.
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Logged in but no company yet -> setup page.
  const company = user.company;
  if (!company || !company.category) {
    redirect("/company/setup");
  }

  // The checklist, plus each item's latest document FROM THIS COMPANY.
  const requirements = await prisma.requirementTemplate.findMany({
    where: { category: { in: checklistCategories(company.category) } },
    orderBy: { name: "asc" },
    include: {
      documents: {
        where: { companyId: company.id },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { expiryDate: true },
      },
    },
  });

  return (
    <main className="mx-auto mt-20 max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">{company.name}</h1>
      <p className="text-sm text-gray-600">Category: {formatCategory(company.category)}</p>

      <UploadForm templates={requirements.map((r) => ({ id: r.id, name: r.name }))} />

      <div className="pt-2">
        <h2 className="text-lg font-medium">Your compliance checklist</h2>
        <p className="text-xs text-gray-500">
          Upload a certificate for each item to keep a copy on file and track when it expires.
        </p>
      </div>

      <ul className="space-y-2">
        {requirements.map((r) => {
          const latest = r.documents[0];

          return (
            <li
              key={r.id}
              className={`flex items-start justify-between gap-4 rounded border p-3 ${
                latest ? "border-green-600" : ""
              }`}
            >
              <div>
                <p className="font-medium">{r.name}</p>
                {r.category === GENERAL_CATEGORY && (
                  <span className="text-xs text-gray-500">Applies to all businesses</span>
                )}
                <p className="text-sm text-gray-600">Renewal: {r.renewalPeriod}</p>
              </div>

              <div className="shrink-0 text-right text-sm">
                {latest ? (
                  <>
                    <p className="font-medium text-green-700">✓ Uploaded</p>
                    <p className="text-xs text-gray-500">
                      {latest.expiryDate
                        ? `Expires ${formatDate(latest.expiryDate)}`
                        : "No expiry date"}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-400">Not uploaded yet</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
