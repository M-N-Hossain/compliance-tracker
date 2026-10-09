"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// The checklist items, passed down from the dashboard (server component).
type TemplateOption = { id: number; name: string };

// What we remember about the last upload, so the dropdown knows
// which document it is editing.
type UploadedDoc = { id: number };

export default function UploadForm({ templates }: { templates: TemplateOption[] }) {
  const router = useRouter();

  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const [uploaded, setUploaded] = useState<UploadedDoc | null>(null);
  const [selected, setSelected] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const formData = new FormData(form);

    setStatus("uploading");
    setMessage("");
    setUploaded(null);
    setSaveMessage("");

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Upload failed");
        return;
      }

      const ex = data.extracted;
      setStatus("done");
      setMessage(
        ex
          ? `Uploaded: ${ex.certificateType}, ` +
              (ex.expiryDate ? `expires ${ex.expiryDate.slice(0, 10)}` : "no expiry date found")
          : `Uploaded (document #${data.id}), but the certificate could not be read`,
      );

      // Show the dropdown, pre-selected with the AI's suggestion.
      setUploaded({ id: data.id });
      setSelected(ex?.matchedTemplateId != null ? String(ex.matchedTemplateId) : "");
      form.reset();
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Something went wrong, please try again");
    }
  }

  // Sends the user's choice to the PATCH route from Part 1.
  async function handleSave() {
    if (!uploaded) return;
    setSaving(true);
    setSaveMessage("");

    try {
      const res = await fetch(`/api/documents/${uploaded.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirementTemplateId: selected === "" ? null : Number(selected),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSaveMessage(data.error ?? "Could not save");
        return;
      }
      setSaveMessage("Saved");
      router.refresh();
      setSaveMessage("Something went wrong, please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded border p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h2 className="text-lg font-medium">Upload a certificate</h2>

        {/* accept= is a convenience only; the server checks the bytes */}
        <input
          type="file"
          name="file"
          accept="application/pdf"
          required
          className="block text-sm"
        />

        <button
          type="submit"
          disabled={status === "uploading"}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {status === "uploading" ? "Uploading..." : "Upload PDF"}
        </button>

        {message && (
          <p className={`text-sm ${status === "error" ? "text-red-600" : "text-green-700"}`}>
            {message}
          </p>
        )}
      </form>

      {/* Only shown after a successful upload */}
      {uploaded && (
        <div className="space-y-2 border-t pt-3">
          <label className="block text-sm font-medium">Which checklist item does this cover?</label>
          <p className="text-xs text-gray-500">Suggested by AI. Change it if it is wrong.</p>

          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setSaveMessage("");
            }}
            className="block w-full rounded border p-2 text-sm"
          >
            {templates.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
            <option value="">Not on my checklist</option>
          </select>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded border px-4 py-2 text-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          {saveMessage && <p className="text-sm text-gray-700">{saveMessage}</p>}
        </div>
      )}
    </div>
  );
}
