import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { checklistCategories } from "@/utils/category";
import { formatDate } from "@/utils/date";
import { initialMatchValue, NOT_DECIDED } from "@/utils/match";
import UploadForm from "@/components/uploadForm";
import MatchSelect from "@/components/matchSelect";

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const company = user.company;
  if (!company || !company.category) redirect("/company/setup");

  // Company's checklist items for dropdown's choices.
  const templateOptions = await prisma.requirementTemplate.findMany({
    where: { category: { in: checklistCategories(company.category) } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Every document of THIS company, newest first.
  const rows = await prisma.document.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      extractedType: true,
      createdAt: true,
      expiryDate: true,
      requirementTemplateId: true,
      pendingRequirement: { select: { status: true } },
    },
  });

  // Work out each row's dropdown value once.
  const documents = rows.map((doc) => ({
    ...doc,
    value: initialMatchValue({
      requirementTemplateId: doc.requirementTemplateId,
      hasPendingRequest: doc.pendingRequirement !== null,
    }),
  }));

  // Undecided documents first (they need action), the rest after.
  const sorted = [
    ...documents.filter((d) => d.value === NOT_DECIDED),
    ...documents.filter((d) => d.value !== NOT_DECIDED),
  ];
  const notLinked = documents.filter((d) => d.value === NOT_DECIDED).length;

  return (
    <main className="text-ink mx-auto flex max-w-5xl flex-col gap-6 px-6 pt-8 pb-16">
      <div>
        <h1 className="text-3xl font-semibold">Documents</h1>
        <p className="text-muted mt-1.5">
          Upload a certificate, then confirm which checklist item it covers. Nothing counts until
          you save.
        </p>
      </div>

      <UploadForm templates={templateOptions} />

      <section className="border-line overflow-hidden rounded-xl border bg-white">
        <div className="border-line flex flex-wrap items-baseline justify-between gap-2 border-b px-5 pt-5 pb-3.5">
          <h2 className="text-lg font-semibold">Your documents</h2>
          <p className="text-muted text-sm">
            {documents.length} documents · {notLinked} not linked
          </p>
        </div>

        {sorted.length === 0 ? (
          <p className="text-muted px-5 py-6 text-sm">No documents uploaded yet.</p>
        ) : (
          <ul>
            {sorted.map((doc) => {
              const name = doc.extractedType ?? "Unreadable document";
              const pending = doc.pendingRequirement?.status;
              const undecided = doc.value === NOT_DECIDED;

              return (
                <li
                  key={doc.id}
                  className={`border-line/60 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 last:border-b-0 ${
                    undecided ? "bg-warn-faint" : ""
                  }`}
                >
                  <div className="flex-[1_1_280px]">
                    <p className="font-medium">{name}</p>
                    <p className="text-muted text-sm">
                      Uploaded {formatDate(doc.createdAt)} ·{" "}
                      {doc.extractedType === null
                        ? "The AI could not read this file"
                        : doc.expiryDate
                          ? `Expires ${formatDate(doc.expiryDate)}`
                          : "No expiry date"}
                    </p>

                    {/* One status line, only when there's something to say */}
                    {undecided && (
                      <p className="text-warn mt-1 text-sm font-medium">Not linked yet</p>
                    )}
                    {!undecided &&
                      doc.requirementTemplateId === null &&
                      pending === "PENDING_REVIEW" && (
                        <p className="text-warn mt-1 text-sm font-medium">
                          Waiting for admin review
                        </p>
                      )}
                    {!undecided && doc.requirementTemplateId === null && pending === "REJECTED" && (
                      <p className="text-muted mt-1 text-sm">
                        Admin decided this is not a checklist item
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <MatchSelect
                      key={`${doc.id}-${doc.value}`}
                      documentId={doc.id}
                      templates={templateOptions}
                      initialValue={doc.value}
                      initiallySaved={true}
                      label={`Checklist item for ${name}`}
                    />
                    <a
                      href={`/api/documents/${doc.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:text-brand-dark text-sm font-medium underline-offset-2 hover:underline"
                    >
                      View PDF
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
