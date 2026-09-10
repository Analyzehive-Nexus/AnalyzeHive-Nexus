"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, AlertCircle, CheckCircle2, Eye, EyeOff, Check } from "lucide-react";
import { api } from "@/lib/api";
import { safeRedirect } from "@/lib/safeRedirect";

const MIN_PASSWORD_LENGTH = 8;

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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const longEnough = password.length >= MIN_PASSWORD_LENGTH;
  const matches = confirm.length > 0 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This link is missing its verification token.");
      return;
    }
    if (!longEnough) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (!matches) {
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
      <div className="w-full max-w-sm p-8 bg-surface border border-line rounded-2xl shadow-overlay animate-fade-in-up">
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
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-xl border border-ok-line bg-ok-tint p-4 animate-fade-in-up"
          >
            <CheckCircle2 className="w-5 h-5 text-ok shrink-0" aria-hidden="true" />
            <p className="text-sm text-ok">Verified — signing you in…</p>
          </div>
        )}

        {token && !done && (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-xs text-subtle mb-1.5" htmlFor="new-password">
                New password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  name="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 pr-10 text-sm text-fg transition-colors focus:border-accent focus:outline-none"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle transition-colors hover:text-fg"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {password.length > 0 && (
                <p className={`mt-1.5 flex items-center gap-1 text-[11px] transition-colors ${longEnough ? "text-ok" : "text-subtle"}`}>
                  <Check className={`h-3 w-3 ${longEnough ? "opacity-100" : "opacity-30"}`} aria-hidden="true" />
                  At least {MIN_PASSWORD_LENGTH} characters
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-subtle mb-1.5" htmlFor="confirm-password">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 pr-10 text-sm text-fg transition-colors focus:border-accent focus:outline-none"
                  placeholder="Repeat password"
                />
                {confirm.length > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {matches ? (
                      <Check className="h-4 w-4 text-ok" aria-hidden="true" />
                    ) : (
                      <span className="block h-1.5 w-1.5 rounded-full bg-danger" aria-hidden="true" />
                    )}
                  </span>
                )}
              </div>
            </div>
            {error && (
              <p role="alert" aria-live="assertive" className="text-xs text-danger animate-fade-in-up">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
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
