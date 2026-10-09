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

  // The admin's choices, pre-filled with sensible defaults.
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

  function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    decide({ action: "approve", name: itemName, scope, renewalPeriod });
  }

  return (
    <form onSubmit={handleApprove} className="mt-2 space-y-2 border-t pt-2">
      <label className="block text-sm">
        Checklist item name
        <input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          required
          className="mt-1 block w-full rounded border p-2 text-sm"
        />
      </label>

      <fieldset className="text-sm">
        <legend className="mb-1">Applies to</legend>
        <label className="mr-4">
          <input
            type="radio"
            name={`scope-${id}`}
            checked={scope === "category"}
            onChange={() => setScope("category")}
          />{" "}
          {categoryLabel} only
        </label>
        <label>
          <input
            type="radio"
            name={`scope-${id}`}
            checked={scope === "general"}
            onChange={() => setScope("general")}
          />{" "}
          all businesses
        </label>
      </fieldset>

      <label className="block text-sm">
        Renewal period
        <select
          value={renewalPeriod}
          onChange={(e) => setRenewalPeriod(e.target.value)}
          className="mt-1 block w-full rounded border p-2 text-sm"
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
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide({ action: "reject" })}
          className="rounded border px-4 py-2 text-sm disabled:opacity-50"
        >
          Reject
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
