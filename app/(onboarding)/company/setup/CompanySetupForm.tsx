"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCategory } from "@/utils/category";

const FALLBACK_MESSAGE =
  "The AI suggestion is not available right now. Choose your business type yourself.";
const NETWORK_MESSAGE = "Could not reach the server. Please try again.";

export function CompanySetupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<"input" | "confirm">("input");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  // True when the AI could not suggest a type and the user must choose one.
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ask the AI for a category.
  async function handleClassify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/company/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Only a 502 means the AI failed. A 400 or 401 is the user's to fix, so no fallback.
        if (res.status === 502 && Array.isArray(data.categories)) {
          // Empty on purpose: a guessed category would build the wrong checklist.
          setCategory("");
          setCategories(data.categories);
          setFallback(true);
          setPhase("confirm");
          return;
        }
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setCategory(data.category);
      setCategories(data.categories);
      setFallback(false);
      setPhase("confirm");
    } catch {
      // The request failed, or the answer was not JSON.
      setError(NETWORK_MESSAGE);
    } finally {
      // Without this, a thrown error would leave the button on "Thinking..." forever.
      setLoading(false);
    }
  }

  // create the company.
  async function handleConfirm() {
    setError("");
    setLoading(true);

    const res = await fetch("/api/company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, category }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form
      onSubmit={
        phase === "input"
          ? handleClassify
          : (e) => {
              e.preventDefault();
              handleConfirm();
            }
      }
      className="border-line flex w-full max-w-140 flex-col gap-4.5 rounded-xl border bg-white p-8"
    >
      <div>
        <p className="text-muted font-mono text-xs tracking-wider uppercase">Step 2 of 2</p>
        <h1 className="text-[26px] font-semibold">Set up your company</h1>
        <p className="text-muted mt-1.5">
          Your business type decides which certificates go on your checklist.
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Company name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="border-field min-h-11 rounded-lg border px-3 font-normal"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        What does your company do?
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            // NEW: a changed description makes the old suggestion stale.
            if (phase === "confirm") setPhase("input");
          }}
          rows={3}
          required
          className="border-field resize-y rounded-lg border px-3 py-2.5 font-normal"
        />
      </label>

      {phase === "input" ? (
        <button
          type="submit"
          disabled={loading}
          className="border-brand text-brand hover:bg-brand-soft min-h-11 self-start rounded-lg border bg-white px-4.5 font-medium disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Suggest a business type"}
        </button>
      ) : (
        <>
          <div className="border-line/60 flex flex-col gap-1.5 border-t pt-4.5">
            <label htmlFor="category" className="text-sm font-medium">
              Business type
            </label>
            <p className="text-muted text-sm">
              {fallback
                ? FALLBACK_MESSAGE
                : "Suggested by AI from your description. Change it if it is wrong."}
            </p>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border-field min-h-11 rounded-lg border bg-white px-2.5"
            >
              {fallback && (
                <option value="" disabled>
                  Choose a business type
                </option>
              )}
              {categories.map((c) => (
                <option key={c} value={c}>
                  {formatCategory(c)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || !category}
            className="bg-brand hover:bg-brand-dark min-h-11 rounded-lg font-medium text-white disabled:opacity-50"
          >
            {loading ? "Creating..." : "Save and build my checklist"}
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="text-bad text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
