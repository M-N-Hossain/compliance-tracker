import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { checklistCategories } from "@/utils/category";
import { formatDate } from "@/utils/date";
import { initialMatchValue, NOT_DECIDED } from "@/utils/match";
import UploadForm from "@/components/uploadForm";
import ConfirmForm from "@/components/confirmForm";

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
  const notConfirmed = documents.filter((d) => d.value === NOT_DECIDED).length;

  return (
    <main className="text-ink mx-auto flex max-w-5xl flex-col gap-6 px-6 pt-8 pb-16">
      <div>
        <h1 className="text-3xl font-semibold">Documents</h1>
        <p className="text-muted mt-1.5">
          Upload a certificate, then check the details and confirm them. Nothing counts until you
          save.
        </p>
      </div>

      {/* The card needs to know when its document stops being undecided. */}
      <UploadForm
        templates={templateOptions}
        confirmedIds={documents.filter((d) => d.value !== NOT_DECIDED).map((d) => d.id)}
      />

      <section className="border-line overflow-hidden rounded-xl border bg-white">
        <div className="border-line flex flex-wrap items-baseline justify-between gap-2 border-b px-5 pt-5 pb-3.5">
          <h2 className="text-lg font-semibold">Your documents</h2>
          <p className="text-muted text-sm">
            {documents.length} documents · {notConfirmed} not confirmed
          </p>
        </div>

        {sorted.length === 0 ? (
          <p className="text-muted px-5 py-6 text-sm">No documents uploaded yet.</p>
        ) : (
          <ul>
            {sorted.map((doc) => {
              // An empty type no longer means the AI failed: it may just not be confirmed yet.
              const name = doc.extractedType ?? "Unnamed document";
              const pending = doc.pendingRequirement?.status;
              const undecided = doc.value === NOT_DECIDED;
              // The linked item's name, for the read-only "Covers" line.
              const covers = templateOptions.find((t) => t.id === doc.requirementTemplateId)?.name;
              // The first 10 characters are the UTC date, so no time zone can shift it by a day.
              const date = doc.expiryDate ? doc.expiryDate.toISOString().slice(0, 10) : "";

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
                      Uploaded {formatDate(doc.createdAt)}
                      {/* Only a confirmed row has an expiry answer worth stating. */}
                      {!undecided &&
                        ` · ${doc.expiryDate ? `Expires ${formatDate(doc.expiryDate)}` : "No expiry date"}`}
                    </p>

                    {/* One status line, only when there's something to say */}
                    {undecided && (
                      <p className="text-warn mt-1 text-sm font-medium">Not confirmed yet</p>
                    )}
                    {covers && <p className="text-muted mt-1 text-sm">Covers: {covers}</p>}
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

                  {/* key: a fresh form whenever the database values change after a save.
                      It places View PDF beside Edit, and its panel under the row's text. */}
                  <ConfirmForm
                    key={`${doc.id}-${doc.value}-${doc.extractedType}-${date}`}
                    documentId={doc.id}
                    templates={templateOptions}
                    initialValues={{
                      type: doc.extractedType ?? "",
                      date,
                      // A decided row with no date means the user said so. An undecided one
                      // means nobody has said anything yet, so the box stays unticked.
                      noExpiry: !undecided && !doc.expiryDate,
                      match: doc.value,
                    }}
                    initiallySaved={!undecided}
                    label={`Confirm ${name}`}
                    actions={
                      <a
                        href={`/api/documents/${doc.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:text-brand-dark text-sm font-medium underline-offset-2 hover:underline"
                      >
                        View PDF
                      </a>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
