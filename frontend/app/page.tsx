
"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

type AuthUser = { sub: string; email?: string; name?: string };

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok && response.status !== 401) throw new Error("Session lookup failed");
        return response.json();
      })
      .then((data) => {
        if (active) setUser(data.authenticated ? data.user : null);
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-5 py-10 text-zinc-100">
      <section aria-labelledby="account-title" className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl shadow-black/30 sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><h2 id="account-title" className="text-lg font-semibold text-zinc-100">Workspace access</h2><p className="mt-1 text-sm text-zinc-400">Use your organization account to continue.</p></div>
          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-medium text-zinc-300">{loading ? "Checking" : user ? "Signed in" : "Sign in required"}</span>
        </div>

        {error ? <div role="alert" className="rounded-lg border border-red-900 bg-red-950/50 p-4 text-sm text-red-200">Session status could not be checked. Refresh the page to try again.</div> : loading ? <div role="status" className="h-12 animate-pulse rounded-lg bg-zinc-800" /> : user ? <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"><p className="text-sm font-medium text-zinc-100">{user.name || "Workspace member"}</p><p className="mt-1 text-sm text-zinc-400">{user.email || "Signed-in account"}</p></div> : <p className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm leading-6 text-zinc-400">Sign in securely to access your assigned organizations and projects.</p>}

        <div className="mt-6 grid gap-3">
          {user ? <a href="/dashboard" className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#ff9900] px-4 text-sm font-semibold text-[#16191f] transition hover:bg-[#ec7211]">Open workspace <ArrowRight size={16} /></a> : <a href="/api/auth/login" className="inline-flex h-11 items-center justify-center rounded-md bg-[#ff9900] px-4 text-sm font-semibold text-[#16191f] transition hover:bg-[#ec7211]">Sign in</a>}
          {user ? <a href="/api/auth/logout" className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-700 px-4 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800">Sign out</a> : <a href="/api/auth/login?screen=forgotPassword" className="text-center text-sm font-medium text-blue-400 hover:underline">Forgot your password?</a>}
        </div>
      </section>
  </main>;
}
