"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }

    // sign in with the same credentials, so the user goes straight to step 2.
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      router.push("/login");
      return;
    }

    router.push("/company/setup");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-line flex w-full max-w-105 flex-col gap-4 rounded-xl border bg-white p-8"
    >
      <div>
        <p className="text-muted font-mono text-xs tracking-wider uppercase">Step 1 of 2</p>
        <h1 className="text-[26px] font-semibold">Create an account</h1>
        <p className="text-muted mt-1.5">
          Then tell us about your company, and we build your checklist.
        </p>
      </div>

      {error && (
        <p role="alert" className="bg-bad-soft text-bad rounded-lg px-3 py-2.5 text-sm">
          {error}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border-field min-h-11 rounded-lg border px-3 font-normal"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Password
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border-field min-h-11 rounded-lg border px-3 font-normal"
        />
        <span className="text-muted text-sm font-normal">At least 8 characters</span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="bg-brand hover:bg-brand-dark min-h-11 rounded-lg font-medium text-white disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>

      <p className="text-muted text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-brand hover:text-brand-dark font-medium">
          Log in
        </Link>
      </p>
    </form>
  );
}
