"use client";

import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { api } from "@/lib/api";

interface Notification {
  id: number;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export default function TopNav({ onMenuClick }: { onMenuClick?: () => void }) {
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
    <div className="sticky top-0 z-40 w-full h-14 bg-[#0b0f14]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 md:px-6">
      {/* LEFT: Breadcrumb / Mobile Toggle */}
      <div className="flex items-center gap-3 md:gap-4 text-sm text-[#9aa4b2]">

        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1 text-white hover:bg-white/10 rounded transition"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span>Dashboard</span>
        <span className="opacity-40">›</span>
        <span className="text-white font-medium">Command Center</span>
      </div>

      {/* RIGHT: Status */}
      <div className="flex items-center gap-4 md:gap-6 text-xs text-[#9aa4b2]">
        {/* GPU Status - Hidden on small mobile */}
        <div className="hidden sm:flex items-center gap-2 text-[#7cff4e]">
          <span className="w-2 h-2 rounded-full bg-[#7cff4e] animate-pulse" />
          <span className="hidden md:inline">NVIDIA GPU Cluster: Active</span>
          <span className="md:hidden">GPU: ON</span>
        </div>

        {/* Sync - Hidden on Mobile */}
        <div className="hidden md:flex items-center gap-1">
          <span className="text-[#9aa4b2]">Last Sync:</span>
          <span className="text-white">Salesforce (1m ago)</span>
          <span className="opacity-40">•</span>
          <span className="text-white">SAP (3m ago)</span>
        </div>

        {/* Notifications */}
        <div className="relative" ref={panelRef}>
          <button className="relative" onClick={() => setOpen((o) => !o)}>
            <span className="text-lg">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-3 w-80 max-h-96 overflow-y-auto rounded-xl bg-[#0f141b] border border-white/10 shadow-2xl z-50">
              <div className="p-3 border-b border-white/5 text-xs font-semibold text-[#e6eaf0]">
                Notifications
              </div>
              {notifications.length === 0 ? (
                <p className="p-4 text-xs text-[#6b7280]">No notifications.</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full text-left p-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition ${
                      n.read ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-[#e6eaf0]">{n.title}</p>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#7cff4e]" />}
                    </div>
                    <p className="text-[11px] text-[#9aa4b2] mt-1">{n.message}</p>
                    <p className="text-[10px] text-[#64748b] mt-1">{n.time}</p>
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
