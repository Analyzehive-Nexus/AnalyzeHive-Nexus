"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  AlertCircle,
  KeyRound,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
import { safeRedirect } from "@/lib/safeRedirect";
import { useHydrated } from "@/lib/useHydrated";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Never hand a raw query-string value to router.push - see safeRedirect.
  const callbackUrl = safeRedirect(searchParams.get('callbackUrl'));

  const [isLoading, setIsLoading] = useState(false);
  // The backend redirects here with ?error=<reason> when sign-in is refused.
  const OAUTH_ERRORS: Record<string, string> = {
    not_invited:
      "That Google account has not been onboarded. Ask an administrator to add you.",
    account_suspended: "That account has been suspended.",
    google_denied: "Sign-in was cancelled.",
    google_rejected: "Google could not verify that account.",
    expired_state: "That sign-in link expired. Please try again.",
    oauth_not_configured: "Google sign-in is not configured on this server.",
    signin_unavailable: "Sign-in is temporarily unavailable. Please try again.",
    signin_failed: "Sign-in failed. Please try again.",
    invalid_callback: "Sign-in failed. Please try again.",
  };
  const oauthError = searchParams.get("error");
  const error = oauthError
    ? OAUTH_ERRORS[oauthError] ?? "Sign-in failed. Please try again."
    : null;
  const mounted = useHydrated();

  // Google and email+password sit on the same screen now (a toggle that hid
  // one behind the other was extra friction for no reason) - the only
  // separate screen left is "activate invite / reset password", which is a
  // genuinely different flow. See backend/src/routes/auth.ts.
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [requestResult, setRequestResult] = useState<{ detail: string; devUrl?: string } | null>(null);

  useEffect(() => {
    // Check if already logged in
    const token = api.getToken();
    if (token) {
      api.verifyToken()
        .then(() => router.push(callbackUrl))
        .catch(() => api.clearToken());
    }
  }, [router, callbackUrl]);

  const backgroundGridStyle = {
    backgroundImage: `
      linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)
    `,
    backgroundSize: "48px 48px",
    maskImage:
      "radial-gradient(circle at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 80%)",
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    // Full-page navigation, not fetch: the OAuth round trip has to happen in
    // the address bar so Google can show its own account chooser.
    const target = new URL("/api/auth/google", API_URL);
    target.searchParams.set("redirect", callbackUrl);
    window.location.href = target.toString();
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormBusy(true);
    try {
      await api.login(email, password);
      router.push(callbackUrl);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setFormBusy(false);
    }
  };

  const handleRequestVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormBusy(true);
    setRequestResult(null);
    try {
      const res = await api.requestPasswordVerification(email);
      setRequestResult({ detail: res.detail, devUrl: res.devVerificationUrl });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not send that link. Please try again.");
    } finally {
      setFormBusy(false);
    }
  };

  const openRequestForm = () => {
    setShowRequestForm(true);
    setFormError(null);
    setRequestResult(null);
  };
  const closeRequestForm = () => {
    setShowRequestForm(false);
    setFormError(null);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative bg-canvas overflow-hidden perspective-container text-muted">

      {/* ================= BACKGROUND EFFECTS ================= */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0" style={backgroundGridStyle} />
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] rounded-full bg-accent/[0.06] blur-[150px]" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-info/[0.05] blur-[130px]" />
      </div>

      {/* ================= LOGIN CARD ================= */}
      <div className="relative z-10 w-full max-w-sm p-8 bg-surface border border-line rounded-2xl shadow-overlay animate-fade-in-up delay-0 card-3d-hover">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-6 flex justify-center">
            <Image
              src="/analyzehive-nexus-logo.png"
              alt="AnalyzeHive Nexus"
              width={1620}
              height={232}
              priority
              className="h-9 w-auto"
            />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg mb-2">
            {showRequestForm ? "Activate your account" : "Sign in to AnalyzeHive Nexus"}
          </h1>
          <p className="text-sm text-subtle">
            {showRequestForm
              ? "Verify the email your administrator invited and set a password."
              : "Use your Google account, or sign in with email and password."}
          </p>
        </div>

        {/* Error Message - OAuth redirect errors, shown regardless of view */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-6 p-4 rounded-xl bg-danger-tint border border-danger-line flex items-center gap-3 animate-fade-in-up"
          >
            <AlertCircle className="w-5 h-5 text-danger shrink-0" aria-hidden="true" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Sign in - invite-only either way: an account has to be onboarded
            by an admin before either method below will succeed. Keyed so the
            fade replays when switching between sign-in and activation. */}
        <div key={showRequestForm ? "request" : "signin"} className="animate-fade-in-up">
          {!showRequestForm ? (
            <>
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full bg-surface hover:bg-elevated text-fg font-semibold py-4 rounded-xl border border-line-strong shadow-card hover:shadow-raised transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-line-strong border-t-accent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.62v3h3.86c2.26-2.09 3.58-5.17 3.58-8.86z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
                      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
                    </svg>
                    Continue with Google
                    <ArrowRight className="w-4 h-4 text-faint group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                  </>
                )}
              </button>

              <div className="my-6 flex items-center gap-3" role="separator">
                <div className="h-px flex-1 bg-line" />
                <span className="text-xs text-subtle">or continue with email</span>
                <div className="h-px flex-1 bg-line" />
              </div>

              <form onSubmit={handlePasswordLogin} className="space-y-4" noValidate>
                <div>
                  <label className="block text-xs text-subtle mb-1.5" htmlFor="login-email">Email</label>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-fg transition-colors focus:border-accent focus:outline-none"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-subtle mb-1.5" htmlFor="login-password">Password</label>
                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 pr-10 text-sm text-fg transition-colors focus:border-accent focus:outline-none"
                      placeholder="••••••••"
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
                </div>
                {formError && (
                  <p role="alert" aria-live="assertive" className="text-xs text-danger animate-fade-in-up">
                    {formError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={formBusy}
                  className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                >
                  {formBusy ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" aria-hidden="true" /> Sign in
                    </>
                  )}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={openRequestForm}
                    className="text-xs text-accent transition hover:text-accent-hover"
                  >
                    Forgot password, or activating an invite?
                  </button>
                </div>
              </form>
            </>
          ) : (
            <form onSubmit={handleRequestVerification} className="space-y-4" noValidate>
              <p className="text-xs text-subtle -mt-2 mb-2">
                Enter the email your administrator invited. If it&apos;s eligible, we&apos;ll send a
                link to verify it and set a password.
              </p>
              <div>
                <label className="block text-xs text-subtle mb-1.5" htmlFor="request-email">Email</label>
                <input
                  id="request-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-fg transition-colors focus:border-accent focus:outline-none"
                  placeholder="you@company.com"
                />
              </div>
              {formError && (
                <p role="alert" aria-live="assertive" className="text-xs text-danger animate-fade-in-up">
                  {formError}
                </p>
              )}
              {requestResult && (
                <div
                  role="status"
                  aria-live="polite"
                  className="animate-fade-in-up rounded-lg border border-ok-line bg-ok-tint p-3 text-xs text-fg"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" aria-hidden="true" />
                    <p>{requestResult.detail}</p>
                  </div>
                  {requestResult.devUrl && (
                    <>
                      <p className="mt-2 text-subtle">
                        No email provider is configured yet, so here&apos;s the link directly (dev only):
                      </p>
                      <a
                        href={requestResult.devUrl}
                        className="mt-1 block break-all text-accent hover:text-accent-hover"
                      >
                        {requestResult.devUrl}
                      </a>
                    </>
                  )}
                </div>
              )}
              <button
                type="submit"
                disabled={formBusy}
                className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
              >
                {formBusy ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Mail className="w-4 h-4" aria-hidden="true" /> Send verification link
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={closeRequestForm}
                className="flex w-full items-center justify-center gap-1.5 text-center text-xs text-muted transition hover:text-fg"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Back to sign in
              </button>
            </form>
          )}
        </div>

        {/* Footer - Contact Admin */}
        <div className="mt-10 text-center">
          <p className="text-xs text-subtle">
            Need access? <span className="text-fg font-medium">Contact your administrator</span>
          </p>
        </div>

      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-8 text-center w-full z-10 flex flex-col gap-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-accent-line" />
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-accent-line" />
        </div>
        <p className="text-xs text-subtle">Access is granted by invitation only</p>
      </div>

    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center bg-canvas">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
