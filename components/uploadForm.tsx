"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmForm, { type ConfirmFormValues } from "./confirmForm";
import { NOT_DECIDED, NOT_ON_CHECKLIST } from "@/utils/match";

type TemplateOption = { id: number; name: string };

type UploadedDoc = {
  id: number;
  readable: boolean; // false if the AI returned nothing we could use
  suggestion: ConfirmFormValues; // starting values for the form, not saved until the user does
};

// Turns the upload response into the form's starting values.
// "extracted" is null when Gemini failed or its answer was unusable.
function toSuggestion(
  extracted: {
    certificateType: string;
    expiryDate: string | null; // ISO string from the JSON response
    matchedTemplateId: number | null;
  } | null,
): ConfirmFormValues {
  // Nothing was read, so nothing is suggested, not even "Not on my checklist".
  if (!extracted) return { type: "", date: "", noExpiry: false, match: NOT_DECIDED };

  return {
    type: extracted.certificateType,
    // The first 10 characters are the UTC date, so no time zone can shift it by a day.
    date: extracted.expiryDate ? extracted.expiryDate.slice(0, 10) : "",
    // Never ticked for the user: only they may say there is no expiry date.
    noExpiry: false,
    match:
      extracted.matchedTemplateId !== null ? String(extracted.matchedTemplateId) : NOT_ON_CHECKLIST,
  };
}

export default function UploadForm({
  templates,
  confirmedIds,
}: {
  templates: TemplateOption[];
  confirmedIds: number[]; // from the database, and updated by router.refresh() after any save
}) {
  const router = useRouter();
  // needed to put a dropped file into it.
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState<UploadedDoc | null>(null);

  // Drag and drop: put the dropped file into the hidden input,
  // so the form submits it exactly like a picked file.
  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault(); // otherwise the browser opens the PDF in the tab
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && inputRef.current) {
      inputRef.current.files = files;
      setFileName(files[0].name);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    // The input is visually hidden, so the browser's own "required"
    // bubble can't show. We check ourselves instead.
    if (!fileName) {
      setError("Choose a PDF first");
      return;
    }

    setUploading(true);
    setError("");
    setUploaded(null);

    try {
      const res = await fetch("/api/documents", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }

      setUploaded({
        id: data.id,
        readable: data.extracted !== null,
        suggestion: toSuggestion(data.extracted),
      });

      form.reset();
      setFileName("");
      router.refresh();
    } catch {
      setError("Something went wrong, please try again");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="flex flex-wrap gap-4">
      {/* Left card: the form */}
      <form
        onSubmit={handleSubmit}
        className="border-line flex flex-[1_1_380px] flex-col gap-3.5 rounded-xl border bg-white p-5"
      >
        <h2 className="text-lg font-semibold">Upload a certificate</h2>

        {/* Clicking a <label> opens its input's file picker, so the whole
            dashed area is clickable without any JavaScript. */}
        <label
          htmlFor="pdf"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed p-4 text-center ${
            dragging ? "border-brand bg-brand-soft" : "border-field bg-canvas/50"
          }`}
        >
          <svg
            aria-hidden="true"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted"
          >
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
            <path d="M12 17v-6" />
            <path d="M9.5 13.5L12 11l2.5 2.5" />
          </svg>
          {fileName ? (
            <span className="font-medium">{fileName}</span>
          ) : (
            <span className="font-medium">Choose a PDF or drop it here</span>
          )}
          <span className="text-muted text-sm">PDF only, up to 5 MB</span>
        </label>

        {/* sr-only: hidden visually, but still a real input for keyboards
            and screen readers. display:none would remove it entirely. */}
        <input
          ref={inputRef}
          id="pdf"
          type="file"
          name="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />

        <button
          type="submit"
          disabled={uploading || !fileName}
          className="bg-brand hover:bg-brand-dark min-h-11 self-start rounded-lg px-5 font-medium text-white disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload PDF"}
        </button>

        {error && <p className="text-bad text-sm">{error}</p>}
      </form>

      {/* Right card: only after an upload */}
      {uploaded && (
        <div className="border-brand-line flex flex-[1_1_380px] flex-col gap-3 rounded-xl border bg-white p-5">
          <p className="text-brand font-mono text-xs tracking-wider uppercase">Just uploaded</p>
          {/* Once confirmed, in the card or the row, the row is the only place to edit.
              A second form here could overwrite the confirmed values with the AI's. */}
          {confirmedIds.includes(uploaded.id) ? (
            <p className="text-muted text-sm">Saved. You can edit it in the list below.</p>
          ) : (
            <>
              {/* Says where the values came from, so the user knows to check them. */}
              <p className="text-muted text-sm">
                {uploaded.readable
                  ? "Suggested by AI. Check each value against the PDF and change anything that is wrong. Nothing is saved until you click Save."
                  : "This file could not be read. Fill in the values by hand."}
              </p>
              {/* key: a new upload starts a fresh form instead of reusing the old one's values. */}
              <ConfirmForm
                key={uploaded.id}
                documentId={uploaded.id}
                templates={templates}
                initialValues={uploaded.suggestion}
                initiallySaved={false}
                label="Confirm the uploaded document"
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}
