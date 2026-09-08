"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, Menu } from "lucide-react";
import { api } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { breadcrumbFor } from "@/lib/nav";
import ServerTime from "@/components/ServerTime";
import WorkspaceControls from "@/components/WorkspaceControls";

interface Notification {
  id: number;
  title: string;
  message: string;
  createdAt: string | null;
  read: boolean;
}

export default function TopNav({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const trail = breadcrumbFor(pathname);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    api
      .get<{ notifications: Notification[] }>("/api/notifications")
      .then((data) => setNotifications(data.notifications))
      .catch(() => setNotifications([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const markRead = async (id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.post(`/api/notifications/${id}/read`);
    } catch {
      // best-effort; UI already updated optimistically
    }
  };

  return (
    <div className="sticky top-0 z-40 w-full h-14 bg-surface/95 backdrop-blur-md border-b border-line flex items-center justify-between px-4 md:px-6">
      {/* LEFT: Mobile toggle + breadcrumb driven by the route map */}
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="lg:hidden -ml-1 mr-1 rounded p-1 text-muted transition hover:bg-sunken hover:text-fg"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
          {trail.map((crumb, i) => {
            const isLast = i === trail.length - 1;
            return (
              <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
                )}
                {isLast ? (
                  <span className="truncate font-medium text-fg" aria-current="page">
                    {crumb.name}
                  </span>
                ) : (
                  <Link href={crumb.href} className="truncate text-subtle transition hover:text-fg">
                    {crumb.name}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
      </div>

      {/* RIGHT: Real status only. The former "GPU Cluster: Active" and
          "Last Sync: Salesforce/SAP" lines were hardcoded literals, not
          telemetry - they are gone rather than left to imply a live feed. */}
      <div className="flex items-center gap-3 text-xs text-muted md:gap-4">
        <WorkspaceControls />
        <ServerTime />

        {/* Notifications */}
        <div className="relative" ref={panelRef}>
          <button
            className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:bg-sunken hover:text-fg"
            aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-3 w-80 max-h-96 overflow-y-auto rounded-xl bg-surface border border-line shadow-overlay z-50">
              <div className="p-3 border-b border-line text-xs font-semibold text-fg">
                Notifications
              </div>
              {notifications.length === 0 ? (
                <p className="p-4 text-xs text-subtle">No notifications.</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full text-left p-3 border-b border-line last:border-0 hover:bg-elevated transition ${
                      n.read ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-fg">{n.title}</p>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                    </div>
                    <p className="text-[11px] text-muted mt-1">{n.message}</p>
                    <p className="text-[10px] text-subtle mt-1">{formatRelative(n.createdAt)}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
