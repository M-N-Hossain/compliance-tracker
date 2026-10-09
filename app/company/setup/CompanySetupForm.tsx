"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CompanySetupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<"input" | "confirm">("input");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClassify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/company/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setCategory(data.category);
    setCategories(data.categories);
    setPhase("confirm");
  }

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

  if (phase === "input") {
    return (
      <main className="mx-auto mt-20 max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Set up your company</h1>
        <form onSubmit={handleClassify} className="space-y-3">
          <input
            placeholder="Company name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border p-2"
            required
          />
          <textarea
            placeholder="What does your company do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border p-2"
            rows={4}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-black p-2 text-white"
          >
            {loading ? "Classifying..." : "Continue"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto mt-20 max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">Confirm category</h1>
      <p className="text-sm text-gray-600">We think this is the best fit. Change it if not.</p>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full rounded border p-2"
      >
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="w-full rounded bg-black p-2 text-white"
      >
        {loading ? "Creating..." : "Create company"}
      </button>
    </main>
  );
}
