"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { safeRedirect } from "@/lib/safeRedirect";

/**
 * Landing point for the email+password verification link
 * (backend/src/routes/auth.ts's POST /api/auth/password/request). The token
 * proves the visitor controls this mailbox; setting a password here consumes
 * it and activates the account in one step, the same "first success
 * activates the invite" convention /auth/callback uses for Google.
 */
function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const redirect = safeRedirect(searchParams.get("redirect"));

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This link is missing its verification token.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await api.completePasswordSetup(token, password);
      setDone(true);
      setTimeout(() => router.push(redirect), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete verification.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm p-8 bg-surface border border-line rounded-2xl shadow-overlay">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-tint border border-accent-line mb-6">
            <KeyRound className="w-7 h-7 text-accent" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-fg mb-2">Verify your email</h1>
          <p className="text-sm text-subtle">Set a password to activate your account.</p>
        </div>

        {!token && (
          <div className="flex items-center gap-3 rounded-xl border border-danger-line bg-danger-tint p-4">
            <AlertCircle className="w-5 h-5 text-danger shrink-0" aria-hidden="true" />
            <p className="text-sm text-danger">This link is missing its verification token.</p>
          </div>
        )}

        {token && done && (
          <div className="flex items-center gap-3 rounded-xl border border-ok-line bg-ok-tint p-4">
            <CheckCircle2 className="w-5 h-5 text-ok shrink-0" aria-hidden="true" />
            <p className="text-sm text-ok">Verified — signing you in…</p>
          </div>
        )}

        {token && !done && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-subtle mb-1.5" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-fg focus:border-accent focus:outline-none"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="block text-xs text-subtle mb-1.5" htmlFor="confirm-password">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-fg focus:border-accent focus:outline-none"
                placeholder="Repeat password"
              />
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
            >
              {busy ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                "Set password and sign in"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-canvas">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
