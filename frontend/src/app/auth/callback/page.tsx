"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { safeRedirect } from "@/lib/safeRedirect";
import { useHydrated } from "@/lib/useHydrated";

/**
 * Landing point for the Google sign-in round trip.
 *
 * The backend puts the session token in the URL *fragment*, not the query
 * string: fragments are never transmitted to a server, so the token stays out
 * of access logs, proxy logs, and the Referer header. That also means it is
 * only readable here, on the client.
 */
function CallbackContent() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [verifyFailed, setVerifyFailed] = useState(false);

  // The fragment is client-only, so it cannot be read until after hydration.
  const { token, redirect } = useMemo(() => {
    if (!hydrated) return { token: null, redirect: "/" };
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return { token: params.get("token"), redirect: safeRedirect(params.get("redirect")) };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !token) return;

    api.setToken(token);
    // Strip the token from the address bar so it does not sit in history.
    window.history.replaceState(null, "", window.location.pathname);

    let cancelled = false;
    api
      .getCurrentUser()
      .then((user) => {
        if (cancelled) return;
        api.setUser(user);
        router.replace(redirect);
      })
      .catch(() => {
        if (cancelled) return;
        api.clearToken();
        setVerifyFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, token, redirect, router]);

  // Derived during render rather than pushed from the effect - the missing
  // token case is a plain function of the URL, not something to schedule.
  const error = !hydrated
    ? null
    : !token
      ? "No sign-in token was returned. Please try again."
      : verifyFailed
        ? "That sign-in could not be verified. Please try again."
        : null;

  if (error) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-canvas px-6">
        <div className="max-w-sm text-center">
          <p className="text-sm text-danger mb-4">{error}</p>
          <button
            onClick={() => router.replace("/login")}
            className="text-xs px-4 py-2 rounded-md border border-line text-muted hover:text-fg hover:bg-elevated transition"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-canvas">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-subtle tracking-widest uppercase">Completing sign in</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-canvas">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
