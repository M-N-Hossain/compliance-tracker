"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NOT_ON_CHECKLIST, NOT_DECIDED } from "@/utils/match";

type Props = {
  documentId: number;
  templates: { id: number; name: string }[];
  initialValue: string;
  initiallySaved: boolean;
  label: string;
};

// Checklist-item dropdown + Save for ONE document.
export default function MatchSelect({
  documentId,
  templates,
  initialValue,
  initiallySaved,
  label,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialValue);
  const [savedValue, setSavedValue] = useState<string | null>(initiallySaved ? initialValue : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isSaved = selected === savedValue;
  const canSave = !saving && selected !== NOT_DECIDED && !isSaved;

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirementTemplateId: selected === NOT_ON_CHECKLIST ? null : Number(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save");
        return;
      }
      setSavedValue(selected);
      router.refresh();
    } catch {
      setError("Something went wrong, please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={label}
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setError("");
          }}
          className="border-field min-h-11 w-72 max-w-full rounded-lg border bg-white px-2.5 text-sm"
        >
          <option value={NOT_DECIDED} disabled>
            Choose a checklist item...
          </option>
          {templates.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.name}
            </option>
          ))}
          <option value={NOT_ON_CHECKLIST}>Not on my checklist</option>
        </select>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={
            canSave
              ? "bg-brand hover:bg-brand-dark min-h-11 rounded-lg px-4 text-sm font-medium text-white"
              : "border-line bg-canvas text-muted min-h-11 rounded-lg border px-4 text-sm"
          }
        >
          {saving ? "Saving..." : isSaved && selected !== NOT_DECIDED ? "Saved" : "Save"}
        </button>
      </div>
      {error && <p className="text-bad text-xs">{error}</p>}
    </div>
  );
}
