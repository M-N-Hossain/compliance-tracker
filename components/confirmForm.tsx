"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { NOT_ON_CHECKLIST, NOT_DECIDED } from "@/utils/match";

// The most characters the server accepts for a type (see utils/confirmPayload.ts).
const MAX_TYPE_LENGTH = 200;

// The form's starting values. The form does not know where they came from:
// the upload card passes Gemini's suggestion, and an unconfirmed row passes empty values.
export type ConfirmFormValues = {
  type: string;
  date: string; // "YYYY-MM-DD" as plain text, so no time zone can shift it. "" means empty.
  noExpiry: boolean; // never true by default: only the user may say there is no expiry date
  match: string; // dropdown value: a template id as text, NOT_ON_CHECKLIST or NOT_DECIDED
};

type Props = {
  documentId: number;
  templates: { id: number; name: string }[];
  initialValues: ConfirmFormValues;
  initiallySaved: boolean; // true when these values are already in the database
  label: string; // tells screen readers which document this form is for
};

// One document's type, expiry date and checklist item, with one Save button.
export default function ConfirmForm({
  documentId,
  templates,
  initialValues,
  initiallySaved,
  label,
}: Props) {
  const router = useRouter();

  // A page can show many of these forms, so each needs its own ids for its labels.
  const id = useId();

  // What the user has on screen right now.
  const [values, setValues] = useState(initialValues);
  // What the database holds, so the button can say "Saved" only when it is true.
  const [savedValues, setSavedValues] = useState<ConfirmFormValues | null>(
    initiallySaved ? initialValues : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Changes one field and clears any old error, because the user is fixing it.
  function update(change: Partial<ConfirmFormValues>) {
    setValues((current) => ({ ...current, ...change }));
    setError("");
  }

  // All three questions must be answered. The server checks again, because a browser can lie.
  const isComplete =
    values.type.trim() !== "" &&
    (values.noExpiry || values.date !== "") &&
    values.match !== NOT_DECIDED;

  // Saved means what is on screen matches what the database holds, field by field.
  const isSaved =
    savedValues !== null &&
    values.type.trim() === savedValues.type.trim() &&
    values.noExpiry === savedValues.noExpiry &&
    values.date === savedValues.date &&
    values.match === savedValues.match;

  const canSave = !saving && isComplete && !isSaved;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // otherwise the browser reloads the page

    // Pressing Enter submits even when the button is disabled, so check here too.
    if (!canSave) return;

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificateType: values.type,
          // null means the user ticked "No expiry date", which is different from leaving it out.
          expiryDate: values.noExpiry ? null : values.date,
          // null means "Not on my checklist".
          requirementTemplateId: values.match === NOT_ON_CHECKLIST ? null : Number(values.match),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save");
        return;
      }
      setSavedValues(values);
      router.refresh(); // reloads the server data, so the dashboard counts stay right
    } catch {
      setError("Something went wrong, please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label={label} className="flex flex-col gap-3">
      {/* Certificate type. React shows this as plain text, so HTML in it never runs. */}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-type`} className="text-sm font-medium">
          Certificate type
        </label>
        <input
          id={`${id}-type`}
          type="text"
          value={values.type}
          maxLength={MAX_TYPE_LENGTH}
          onChange={(e) => update({ type: e.target.value })}
          className="border-field min-h-11 w-72 max-w-full rounded-lg border bg-white px-2.5 text-sm"
        />
      </div>

      {/* Expiry date, or an explicit "there is none". Ticking the box clears the date. */}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-date`} className="text-sm font-medium">
          Expiry date
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id={`${id}-date`}
            type="date"
            value={values.date}
            disabled={values.noExpiry}
            onChange={(e) => update({ date: e.target.value })}
            className="border-field min-h-11 rounded-lg border bg-white px-2.5 text-sm disabled:opacity-50"
          />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.noExpiry}
              onChange={(e) =>
                update({
                  noExpiry: e.target.checked,
                  date: e.target.checked ? "" : values.date,
                })
              }
            />
            No expiry date
          </label>
        </div>
      </div>

      {/* Which checklist item this document covers. */}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-match`} className="text-sm font-medium">
          Checklist item
        </label>
        <select
          id={`${id}-match`}
          value={values.match}
          onChange={(e) => update({ match: e.target.value })}
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
      </div>

      {/* The button's look follows the same three states as its text. */}
      <button
        type="submit"
        disabled={!canSave}
        className={`min-h-11 self-start rounded-lg px-4 text-sm ${
          canSave
            ? "bg-brand hover:bg-brand-dark font-medium text-white"
            : "border-line bg-canvas text-muted border"
        }`}
      >
        {saving ? "Saving..." : isSaved ? "Saved" : "Save"}
      </button>

      {/* The server's reason, when it refuses. */}
      {error && <p className="text-bad text-xs">{error}</p>}
    </form>
  );
}
