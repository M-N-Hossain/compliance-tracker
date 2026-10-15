"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // NEW: no double submits

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setError("Wrong email or password.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-line flex w-full max-w-105 flex-col gap-4 rounded-xl border bg-white p-8"
    >
      <div>
        <h1 className="text-[26px] font-semibold">Log in</h1>
        <p className="text-muted mt-1.5">
          See what&apos;s covered and what&apos;s about to expire.
        </p>
      </div>

      {/* role="alert": screen readers announce it the moment it appears */}
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border-field min-h-11 rounded-lg border px-3 font-normal"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="bg-brand hover:bg-brand-dark min-h-11 rounded-lg font-medium text-white disabled:opacity-50"
      >
        {loading ? "Logging in..." : "Log in"}
      </button>

      <p className="text-muted text-center text-sm">
        New here?{" "}
        <Link href="/register" className="text-brand hover:text-brand-dark font-medium">
          Create an account
        </Link>
      </p>
    </form>
  );
}
