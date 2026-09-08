"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Hexagon,
  AlertCircle
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
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-tint border border-accent-line mb-6 relative group">
            <Hexagon className="w-7 h-7 text-accent group-hover:rotate-180 transition-transform duration-700" />
            
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg mb-2">Sign in to AnalyzeHive Nexus</h1>
          <p className="text-sm text-subtle">Use your work Google account to continue</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-danger-tint border border-danger-line flex items-center gap-3 animate-fade-in-up">
            <AlertCircle className="w-5 h-5 text-danger shrink-0" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Sign in - Google only, and invite-only: an account has to be
            onboarded by an admin before this will succeed. */}
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
              <ArrowRight className="w-4 h-4 text-faint group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>

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
