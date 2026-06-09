"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export const dynamic = "force-dynamic";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin/sessions";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(next.startsWith("/admin") ? next : "/admin/sessions");
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Sign-in failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm bg-ngpa-panel/80 backdrop-blur-sm rounded-2xl border border-ngpa-slate/60 p-6 sm:p-8"
    >
      <h1 className="font-heading text-2xl font-black mb-1">NGA Admin</h1>
      <p className="text-ngpa-white/70 text-sm mb-6">Sessions editor — staff only.</p>
      <label className="block text-xs font-bold uppercase tracking-wide text-ngpa-white/65 mb-2">
        Password
      </label>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg bg-ngpa-deep border border-ngpa-slate/60 px-3 py-2.5 text-ngpa-white outline-none focus:border-ngpa-teal"
        placeholder="••••••••"
      />
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      <button
        type="submit"
        disabled={busy || !password}
        className="mt-5 w-full rounded-full bg-ngpa-teal text-ngpa-deep font-black py-2.5 disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-ngpa-deep text-ngpa-white flex items-center justify-center px-4 py-16">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
