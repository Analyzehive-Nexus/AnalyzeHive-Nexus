"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, FileSignature, Key, LogOut, MapPin, ScrollText, ShieldCheck, User,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useCurrentUser, formatRole, initialsOf } from "@/lib/userStore";

/**
 * Profile and governance.
 *
 * A regulated-industry account is described by its designation, the permissions
 * its role actually carries, the signature credential attributable to it, and
 * what it has signed. That replaced the gamified "Missions / Rank: Elite"
 * placeholders, which had no backing data at all.
 */

interface ActivityEntry {
  id: number; action: string; occurredAt: string | null; type: string;
}

interface Governance {
  designation: string | null;
  department: string | null;
  grade: number | null;
  homeRegion: string | null;
  permissions: { id: string; description: string; requiresSignature: boolean }[];
  credential: { id: string; issuedAt: string | null; expiresAt: string | null; status: string } | null;
  signoffs: {
    id: number; recordType: string; recordId: string; meaning: string;
    signedAt: string | null; credentialId: string; payloadHash: string;
  }[];
  scopes: { type: string; id: string }[];
}

const MEANING_STYLE: Record<string, string> = {
  approved: "border-ok-line bg-ok-tint text-ok",
  reviewed: "border-info-line bg-info-tint text-info",
  authored: "border-line bg-elevated text-muted",
  responsibility: "border-warn-line bg-warn-tint text-warn",
};

export default function ProfilePage() {
  const router = useRouter();
  const user = useCurrentUser();

  const [gov, setGov] = useState<Governance | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<Governance>("/api/governance/me")
      .then((d) => !cancelled && setGov(d)).catch(() => {});
    api.get<{ activity: ActivityEntry[] }>("/api/profile/activity?limit=6")
      .then((d) => !cancelled && setActivity(d.activity)).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await api.logout(); } finally { router.push("/login"); }
  };

  return (
    <div className="space-y-8 text-muted">
      <PageHeader />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ------------------------------------------------- identity */}
        <section className="space-y-6 lg:col-span-1">
          <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-tint text-base font-semibold text-accent">
                {user ? initialsOf(user.name) : <User className="h-6 w-6" aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-fg">{user?.name ?? "Loading…"}</h2>
                <p className="truncate text-sm text-subtle">{user?.email ?? "—"}</p>
              </div>
            </div>

            <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-subtle">Designation</dt>
                <dd className="text-right text-fg">{gov?.designation ?? "—"}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-subtle">Department</dt>
                <dd className="text-right text-fg">{gov?.department ?? "—"}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-subtle">System role</dt>
                <dd>
                  <span className="rounded-md border border-accent-line bg-accent-tint px-2 py-0.5 text-xs font-medium text-accent">
                    {user ? formatRole(user.role) : "—"}
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-subtle">Sign-in method</dt>
                <dd className="text-fg">Google</dd>
              </div>
            </dl>
          </div>

          {/* ------------------------------------- assigned scope */}
          <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
              <MapPin className="h-4 w-4 text-subtle" aria-hidden="true" /> Assigned scope
            </h3>
            <p className="mb-4 text-xs text-subtle">
              Warehouses and territories this account may act on
            </p>
            <div className="flex flex-wrap gap-2">
              {(gov?.scopes ?? []).map((s) => (
                <span
                  key={`${s.type}-${s.id}`}
                  className="rounded-md border border-line bg-elevated px-2 py-1 text-xs text-muted"
                >
                  <span className="text-subtle capitalize">{s.type}:</span> {s.id}
                </span>
              ))}
              {gov?.scopes.length === 0 && (
                <p className="text-sm text-subtle">No scope restriction — full estate access.</p>
              )}
            </div>
          </div>

          {/* ------------------------------------- signature credential */}
          <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
              <FileSignature className="h-4 w-4 text-subtle" aria-hidden="true" />
              Digital signature credential
            </h3>
            <p className="mb-4 text-xs text-subtle">
              21 CFR Part 11 §11.100 — unique to this individual, never reassigned
            </p>
            {gov?.credential ? (
              <dl className="space-y-2 rounded-lg border border-line bg-elevated p-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-subtle">Credential ID</dt>
                  <dd className="font-mono text-xs text-fg">{gov.credential.id}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-subtle">Status</dt>
                  <dd>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs capitalize ${
                        gov.credential.status === "active"
                          ? "border-ok-line bg-ok-tint text-ok"
                          : "border-danger-line bg-danger-tint text-danger"
                      }`}
                    >
                      {gov.credential.status}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-subtle">Expires</dt>
                  <dd className="text-xs text-fg">{formatDateTime(gov.credential.expiresAt)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-subtle">
                No signature credential issued. This account cannot apply Part 11 signatures.
              </p>
            )}
          </div>
        </section>

        {/* ------------------------------------------------ right column */}
        <section className="space-y-6 lg:col-span-2">
          {/* ---------------------------------------- permissions (RBAC) */}
          <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
              <ShieldCheck className="h-4 w-4 text-subtle" aria-hidden="true" />
              Role-based access
            </h3>
            <p className="mb-4 text-xs text-subtle">
              Granted by the <span className="font-medium">{user ? formatRole(user.role) : "—"}</span> role.
              Actions marked <span className="font-medium">signature required</span> cannot be
              completed without applying the credential above.
            </p>
            <ul className="grid max-h-96 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {(gov?.permissions ?? []).map((p) => (
                <li key={p.id} className="rounded-lg border border-line bg-elevated p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[11px] text-fg">{p.id}</span>
                    {p.requiresSignature && (
                      <span className="shrink-0 rounded-full border border-warn-line bg-warn-tint px-1.5 py-0.5 text-[9px] font-medium uppercase text-warn">
                        Signature
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-subtle">{p.description}</p>
                </li>
              ))}
              {gov?.permissions.length === 0 && (
                <li className="text-sm text-subtle">No permissions granted.</li>
              )}
            </ul>
          </div>

          {/* ---------------------------------------- Part 11 sign-offs */}
          <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
              <ScrollText className="h-4 w-4 text-subtle" aria-hidden="true" />
              21 CFR Part 11 sign-off history
            </h3>
            <p className="mb-4 text-xs text-subtle">
              §11.50 — each entry records the signer, the moment, and the meaning of the signature.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-subtle">
                  <tr className="border-b border-line">
                    <th className="py-2 text-left font-medium">Record</th>
                    <th className="py-2 text-left font-medium">Meaning</th>
                    <th className="py-2 text-left font-medium">Credential</th>
                    <th className="py-2 text-right font-medium">Signed</th>
                  </tr>
                </thead>
                <tbody>
                  {(gov?.signoffs ?? []).map((s) => (
                    <tr key={s.id} className="border-b border-line last:border-0">
                      <td className="py-2.5">
                        <span className="block text-xs capitalize text-fg">
                          {s.recordType.replace(/_/g, " ")}
                        </span>
                        <span className="block font-mono text-[10px] text-subtle">{s.recordId}</span>
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${
                            MEANING_STYLE[s.meaning] ?? MEANING_STYLE.authored
                          }`}
                        >
                          {s.meaning}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-[10px] text-subtle">
                        {s.credentialId}
                        {/* The hash is what makes a later mutation detectable. */}
                        <span className="block opacity-70">#{s.payloadHash.slice(0, 12)}</span>
                      </td>
                      <td className="py-2.5 text-right text-xs text-subtle">
                        {formatDateTime(s.signedAt)}
                      </td>
                    </tr>
                  ))}
                  {gov?.signoffs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-sm text-subtle">
                        No signatures applied by this account yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---------------------------------------- recent activity */}
          <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg">
              <Clock className="h-4 w-4 text-subtle" aria-hidden="true" /> Recent activity
            </h3>
            {activity.length === 0 ? (
              <p className="text-sm text-subtle">No activity recorded yet.</p>
            ) : (
              <ul className="space-y-4">
                {activity.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-start gap-3 border-b border-line pb-4 last:border-0 last:pb-0"
                  >
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        log.type === "success" ? "bg-ok" : log.type === "warning" ? "bg-warn" : "bg-info"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-fg">{log.action}</p>
                      <p className="mt-0.5 text-xs text-subtle">{formatRelative(log.occurredAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---------------------------------------- security + sign out */}
          <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-elevated p-2 text-subtle">
                  <Key className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-fg">Security</h3>
                  <p className="mt-1 max-w-prose text-sm text-subtle">
                    This account signs in with Google. Passwords, two-factor authentication and
                    account recovery are managed there.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href="https://myaccount.google.com/security"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-elevated"
                >
                  Manage in Google
                </a>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex items-center gap-2 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-danger transition hover:border-danger-line hover:bg-danger-tint disabled:opacity-50"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  {loggingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
