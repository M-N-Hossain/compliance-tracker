"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  id: number;
  name: string;
  categoryLabel: string;
};

const RENEWAL_OPTIONS = ["yearly", "every 2 years", "every 3 years", "every 5 years", "one-time"];

export default function ReviewForm({ id, name, categoryLabel }: Props) {
  const router = useRouter();
  const [itemName, setItemName] = useState(name);
  const [scope, setScope] = useState<"category" | "general">("category");
  const [renewalPeriod, setRenewalPeriod] = useState("yearly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // One function for both buttons; only the body differs.
  async function decide(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/pending/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong, please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        decide({ action: "approve", name: itemName, scope, renewalPeriod });
      }}
      className="flex flex-[1_1_420px] flex-col gap-3.5"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Checklist item name
        <input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          required
          className="border-field min-h-11 rounded-lg border px-3 font-normal"
        />
      </label>

      {/* fieldset + legend: the accessible way to label a group of radios */}
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1.5 font-medium">Applies to</legend>
        <label className="flex min-h-8 items-center gap-2">
          <input
            type="radio"
            name={`scope-${id}`}
            checked={scope === "category"}
            onChange={() => setScope("category")}
          />
          {categoryLabel} only
        </label>
        <label className="flex min-h-8 items-center gap-2">
          <input
            type="radio"
            name={`scope-${id}`}
            checked={scope === "general"}
            onChange={() => setScope("general")}
          />
          all businesses
        </label>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Renewal period
        <select
          value={renewalPeriod}
          onChange={(e) => setRenewalPeriod(e.target.value)}
          className="border-field min-h-11 rounded-lg border bg-white px-2.5 font-normal"
        >
          {RENEWAL_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="bg-brand hover:bg-brand-dark min-h-11 rounded-lg px-5 font-medium text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide({ action: "reject" })}
          className="border-line text-bad hover:bg-bad-soft min-h-11 rounded-lg border bg-white px-5 font-medium disabled:opacity-50"
        >
          Reject
        </button>
      </div>

      {error && (
        <p role="alert" className="text-bad text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
