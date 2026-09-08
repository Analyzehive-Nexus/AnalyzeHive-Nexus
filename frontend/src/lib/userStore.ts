"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { AppUser } from "@/lib/api";

const STORAGE_KEY = "user";

// Same-tab subscribers. The browser's `storage` event only fires in *other*
// tabs, so a write from this tab has to notify locally or the UI goes stale.
const listeners = new Set<() => void>();

/** Call after any write to the cached user so subscribers re-read it. */
export function notifyUserChanged(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Snapshot the raw string, never a parsed object: useSyncExternalStore compares
// snapshots with Object.is, so returning a fresh object each call would spin
// forever. Parsing happens in useMemo below, keyed off the stable string.
const getSnapshot = () => localStorage.getItem(STORAGE_KEY);
const getServerSnapshot = () => null;

/**
 * The signed-in user, or null before hydration / when logged out.
 *
 * This is the single source of truth for displayed identity. Nothing should
 * hardcode a name, role, or email - the Sidebar and the Profile page showed
 * two different invented people before this existed.
 */
export function useCurrentUser(): AppUser | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AppUser;
    } catch {
      return null; // corrupt cache should not crash the shell
    }
  }, [raw]);
}

/** "Test Agent" -> "TA". Falls back to a neutral glyph rather than empty space. */
export function initialsOf(name: string | undefined | null): string {
  if (!name) return "--";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "--";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Authorization role -> display label.
 *
 * Note this is the *permission* role ("admin"), not a job title. The Profile
 * page previously showed "Senior Supply Chain Architect" here, which is a
 * different concept the backend has no field for yet.
 */
export function formatRole(role: string | undefined | null): string {
  if (!role) return "—";
  const labels: Record<string, string> = {
    admin: "Administrator",
    manager: "Manager",
    employee: "Employee",
  };
  return labels[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}
