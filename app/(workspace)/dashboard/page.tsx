import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { checklistCategories, formatCategory, GENERAL_CATEGORY } from "@/utils/category";
import { formatDate } from "@/utils/date";
import { getStatus, type ComplianceStatus } from "@/utils/status";

// How each status looks: the badge colours and the tile number colour.
const STATUS_STYLE: Record<ComplianceStatus, { badge: string; number: string }> = {
  EXPIRED: { badge: "bg-bad-soft text-bad", number: "text-bad" },
  MISSING: { badge: "bg-canvas text-body", number: "text-body" },
  EXPIRING_SOON: { badge: "bg-warn-soft text-warn", number: "text-warn" },
  COVERED: { badge: "bg-ok-soft text-ok", number: "text-ok" },
};

// Lower number = shown higher in the checklist.
const URGENCY: Record<ComplianceStatus, number> = {
  EXPIRED: 0,
  MISSING: 1,
  EXPIRING_SOON: 2,
  COVERED: 3,
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = user.company;
  if (!company || !company.category) redirect("/company/setup");

  // The checklist, each item with its latest CONFIRMED document from this company.
  const requirements = await prisma.requirementTemplate.findMany({
    where: { category: { in: checklistCategories(company.category) } },
    include: {
      documents: {
        where: { companyId: company.id },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, expiryDate: true },
      },
    },
  });

  // Documents nobody has decided about yet (no link, no pending request).
  const unlinkedCount = await prisma.document.count({
    where: {
      companyId: company.id,
      requirementTemplateId: null,
      pendingRequirement: { is: null },
    },
  });

  // One "now" for the whole page.
  const now = new Date();

  const items = requirements
    .map((r) => {
      const latest = r.documents[0];
      const { status, daysLeft } = getStatus(!!latest, latest?.expiryDate ?? null, now);
      return { ...r, latest, status, daysLeft };
    })
    .sort((a, b) => {
      // 1. Most urgent status first.
      const byUrgency = URGENCY[a.status] - URGENCY[b.status];
      if (byUrgency !== 0) return byUrgency;
      // 2. Among "expiring soon": the one running out first, first.
      if (a.daysLeft !== null && b.daysLeft !== null) return a.daysLeft - b.daysLeft;
      // 3. Otherwise alphabetical. localeCompare sorts text properly
      //    (handles case and letters like æ, ø, å).
      return a.name.localeCompare(b.name);
    });

  // Tile counts. Every status starts at 0, so all four tiles always show.
  const counts: Record<ComplianceStatus, number> = {
    COVERED: 0,
    EXPIRING_SOON: 0,
    EXPIRED: 0,
    MISSING: 0,
  };
  for (const item of items) counts[item.status]++;

  const tiles: { status: ComplianceStatus; label: string }[] = [
    { status: "COVERED", label: "Covered" },
    { status: "EXPIRING_SOON", label: "Expiring within 30 days" },
    { status: "EXPIRED", label: "Expired" },
    { status: "MISSING", label: "Missing" },
  ];

  return (
    <main className="text-ink mx-auto flex max-w-5xl flex-col gap-6 px-6 pt-8 pb-16">
      {/* Company + main action */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted font-mono text-xs tracking-wider uppercase">
            {formatCategory(company.category)}
          </p>
          <h1 className="text-3xl font-semibold">{company.name}</h1>
          <p className="text-muted mt-1.5">{company.description}</p>
        </div>
        <Link
          href="/documents"
          className="bg-brand hover:bg-brand-dark inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-medium text-white"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 16V4" />
            <path d="M7 9l5-5 5 5" />
            <path d="M5 20h14" />
          </svg>
          Upload a certificate
        </Link>
      </section>

      {/* Summary tiles. auto-fit: as many 200px+ columns as fit, so they
          sit in one row on desktop and wrap on a phone. */}
      <section
        aria-label="Compliance summary"
        className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3"
      >
        {tiles.map((t) => (
          <div key={t.status} className="border-line rounded-xl border bg-white px-4.5 py-4">
            <p className="text-muted text-sm">{t.label}</p>
            <p className={`mt-1 text-3xl font-semibold ${STATUS_STYLE[t.status].number}`}>
              {counts[t.status]}
            </p>
          </div>
        ))}
      </section>

      {/* Checklist */}
      <section className="border-line overflow-hidden rounded-xl border bg-white">
        <div className="border-line border-b px-5 pt-5 pb-3.5">
          <h2 className="text-lg font-semibold">Your compliance checklist</h2>
          <p className="text-muted mt-1 text-sm">
            Needs attention first. Each item is checked against the expiry date of its linked
            certificate.
          </p>
        </div>

        <ul>
          {items.map((item) => {
            const expiry = item.latest?.expiryDate ?? null;

            // The grey detail line: scope · renewal · date info.
            const parts: string[] = [];
            if (item.category === GENERAL_CATEGORY) parts.push("All businesses");
            parts.push(`Renewal: ${item.renewalPeriod}`);
            if (item.status === "MISSING") parts.push("No document yet");
            else if (!expiry) parts.push("No expiry date on document");
            else if (item.status === "EXPIRED") parts.push(`Expired ${formatDate(expiry)}`);
            else parts.push(`Expires ${formatDate(expiry)}`);

            // Badge text: the countdown says more than "Expiring soon".
            let badge: string;
            if (item.status === "EXPIRING_SOON") {
              badge = item.daysLeft === 0 ? "Expires today" : `${item.daysLeft} days left`;
            } else if (item.status === "EXPIRED") badge = "Expired";
            else if (item.status === "MISSING") badge = "Missing";
            else badge = "Covered";

            return (
              <li
                key={item.id}
                className="border-line/60 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 last:border-b-0"
              >
                <div className="flex-[1_1_320px]">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-muted text-sm">{parts.join(" · ")}</p>
                </div>

                {/* Order: badge · upload action (if needed) · View PDF (always last) */}
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-sm font-medium ${STATUS_STYLE[item.status].badge}`}
                  >
                    {badge}
                  </span>

                  {item.status === "MISSING" && (
                    <Link
                      href="/documents"
                      className="text-brand hover:text-brand-dark text-sm font-medium"
                    >
                      Upload
                    </Link>
                  )}
                  {(item.status === "EXPIRED" || item.status === "EXPIRING_SOON") && (
                    <Link
                      href="/documents"
                      className="text-brand hover:text-brand-dark text-sm font-medium"
                    >
                      Upload renewal
                    </Link>
                  )}

                  {/* Plain <a>: it opens a file in a new tab, not a page of the app.*/}
                  {item.latest && (
                    <a
                      href={`/api/documents/${item.latest.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:text-brand-dark text-sm font-medium"
                    >
                      View PDF
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Nudge: only when there's something to review */}
      {unlinkedCount > 0 && (
        <p className="text-muted text-sm">
          {unlinkedCount === 1
            ? "1 uploaded document is not linked to the checklist yet."
            : `${unlinkedCount} uploaded documents are not linked to the checklist yet.`}{" "}
          <Link href="/documents" className="text-brand hover:text-brand-dark font-medium">
            Review them in Documents
          </Link>
        </p>
      )}
    </main>
  );
}
