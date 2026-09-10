"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, Trash2, UserPlus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { useCurrentUser, formatRole } from "@/lib/userStore";

/**
 * User administration.
 *
 * The backend has always had a full admin API (`/api/admin/users` - invite,
 * list, patch role/status, revoke) but no page ever called it: onboarding
 * someone meant a curl command. This is that missing UI.
 */

const ROLES = ["admin", "manager", "employee"] as const;
type Role = (typeof ROLES)[number];
type Status = "invited" | "active" | "suspended";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: Status;
  region_id: string | null;
  avatar_url: string | null;
  invited_by: string | null;
  invited_at: string | null;
  last_login_at: string | null;
}

interface Region { id: string; name: string }

const STATUS_STYLE: Record<Status, string> = {
  invited: "border-info-line bg-info-tint text-info",
  active: "border-ok-line bg-ok-tint text-ok",
  suspended: "border-danger-line bg-danger-tint text-danger",
};

export default function AdminPage() {
  const user = useCurrentUser();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("employee");
  const [inviteRegion, setInviteRegion] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Split so the mount effect only kicks off the request rather than setting
  // state synchronously in the effect body (a cascading render - `loading`
  // already starts true, same convention as system-status's ServiceGrid).
  const fetchAdmin = useCallback(
    () =>
      Promise.all([
        api.get<{ users: UserRow[] }>("/api/admin/users"),
        api.get<{ regions: Region[] }>("/api/command-center/regions"),
      ])
        .then(([u, r]) => {
          setUsers(u.users);
          setRegions(r.regions);
          setLoadError(null);
        })
        .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load users"))
        .finally(() => setLoading(false)),
    []
  );

  const refresh = () => {
    setLoading(true);
    void fetchAdmin();
  };

  useEffect(() => {
    if (user?.role === "admin") void fetchAdmin();
  }, [user?.role, fetchAdmin]);

  if (user && user.role !== "admin") {
    return (
      <div className="space-y-8 text-muted">
        <PageHeader />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface p-12 text-center shadow-card">
          <Lock className="h-6 w-6 text-subtle" aria-hidden="true" />
          <p className="text-sm text-fg">Administrator access required.</p>
          <p className="max-w-sm text-xs text-subtle">
            This account has the {formatRole(user.role)} role, which cannot manage other users.
          </p>
        </div>
      </div>
    );
  }

  const patchUser = async (id: string, body: Partial<{ role: Role; status: Status; regionId: string }>) => {
    setRowError(null);
    setBusyId(id);
    try {
      const updated = await api.patch<UserRow>(`/api/admin/users/${id}`, body);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not update that user");
    } finally {
      setBusyId(null);
    }
  };

  const revokeInvite = async (id: string) => {
    setRowError(null);
    setBusyId(id);
    try {
      await api.delete(`/api/admin/users/${id}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not remove that invite");
    } finally {
      setBusyId(null);
    }
  };

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteBusy(true);
    try {
      await api.post("/api/admin/users", {
        email: inviteEmail.trim(),
        name: inviteName.trim() || undefined,
        role: inviteRole,
        regionId: inviteRegion || undefined,
      });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("employee");
      setInviteRegion("");
      refresh();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Could not onboard that user");
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <div className="space-y-6 text-muted">
      <PageHeader
        actions={
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Invite user
          </button>
        }
      />

      <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
        {rowError && (
          <p role="alert" aria-live="assertive" className="mb-4 text-xs text-danger">
            {rowError}
          </p>
        )}
        {loadError && <p className="text-sm text-danger">{loadError}</p>}
        {!loadError && loading && <p className="text-sm text-subtle">Loading users…</p>}
        {!loadError && !loading && (
          <div className="max-h-[70vh] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 z-10 bg-surface text-xs text-subtle">
                <tr className="border-b border-line">
                  <th className="py-2 text-left font-medium">User</th>
                  <th className="py-2 text-left font-medium">Role</th>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Region</th>
                  <th className="py-2 text-left font-medium">Last sign-in</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === user?.id;
                  const rowBusy = busyId === u.id;
                  return (
                    <tr key={u.id} className="border-b border-line last:border-0">
                      <td className="py-2.5">
                        <span className="block text-fg">
                          {u.name} {isSelf && <span className="text-subtle">(you)</span>}
                        </span>
                        <span className="block text-xs text-subtle">{u.email}</span>
                      </td>
                      <td className="py-2.5">
                        <select
                          value={u.role}
                          disabled={isSelf || rowBusy}
                          onChange={(e) => patchUser(u.id, { role: e.target.value as Role })}
                          className="rounded-md border border-line-strong bg-surface px-2 py-1 text-xs text-fg disabled:opacity-50"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{formatRole(r)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${STATUS_STYLE[u.status]}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <select
                          value={u.region_id ?? ""}
                          disabled={rowBusy}
                          onChange={(e) => patchUser(u.id, { regionId: e.target.value })}
                          className="rounded-md border border-line-strong bg-surface px-2 py-1 text-xs text-fg disabled:opacity-50"
                        >
                          <option value="">All regions</option>
                          {regions.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 text-xs text-subtle">{formatRelative(u.last_login_at)}</td>
                      <td className="py-2.5 text-right">
                        {u.status === "invited" && (
                          <button
                            onClick={() => revokeInvite(u.id)}
                            disabled={rowBusy}
                            className="inline-flex items-center gap-1 rounded-md border border-line-strong px-2 py-1 text-xs text-danger transition hover:border-danger-line hover:bg-danger-tint disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" /> Revoke
                          </button>
                        )}
                        {u.status === "active" && !isSelf && (
                          <button
                            onClick={() => patchUser(u.id, { status: "suspended" })}
                            disabled={rowBusy}
                            className="rounded-md border border-line-strong px-2 py-1 text-xs text-danger transition hover:border-danger-line hover:bg-danger-tint disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        )}
                        {u.status === "suspended" && (
                          <button
                            onClick={() => patchUser(u.id, { status: "active" })}
                            disabled={rowBusy}
                            className="rounded-md border border-line-strong px-2 py-1 text-xs text-ok transition hover:border-ok-line hover:bg-ok-tint disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-subtle">
                      No users onboarded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="max-w-prose text-xs text-subtle">
        Onboarding is invite-only. A new account can sign in with Google or, once it sets one, a
        password — the row above just admits them to the door; they still have to prove who they
        are. Invited rows with no sign-in yet can be revoked; anyone who has already signed in is
        suspended instead, so their audit trail survives.
      </p>

      {inviteOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            onClick={() => !inviteBusy && setInviteOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-overlay"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-4 text-sm font-semibold text-fg">Invite a user</h3>
              <form onSubmit={submitInvite} className="space-y-3" noValidate>
                <div>
                  <label className="mb-1.5 block text-xs text-subtle" htmlFor="invite-email">Email</label>
                  <input
                    id="invite-email"
                    type="email"
                    required
                    autoFocus
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                    placeholder="person@company.com"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-subtle" htmlFor="invite-name">Name (optional)</label>
                  <input
                    id="invite-name"
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                    placeholder="Replaced by their Google name on first sign-in"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs text-subtle" htmlFor="invite-role">Role</label>
                    <select
                      id="invite-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as Role)}
                      className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{formatRole(r)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-subtle" htmlFor="invite-region">Region</label>
                    <select
                      id="invite-region"
                      value={inviteRegion}
                      onChange={(e) => setInviteRegion(e.target.value)}
                      className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                    >
                      <option value="">All regions</option>
                      {regions.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {inviteError && (
                  <p role="alert" aria-live="assertive" className="text-xs text-danger">
                    {inviteError}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={inviteBusy}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
                  >
                    {inviteBusy ? "Inviting…" : "Send invite"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteOpen(false)}
                    disabled={inviteBusy}
                    className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-elevated"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
