"use client"; // Indicates this file is a Client Component in Next.js

// Import the Link component for client-side navigation between pages
import Link from "next/link";
import Image from "next/image";
// Import the usePathname hook to get the current URL path
// Import the usePathname hook to get the current URL path
import { usePathname, useRouter } from "next/navigation";
import { memo } from "react";
import {
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentUser, initialsOf, formatRole } from "@/lib/userStore";
import { NAV_ITEMS } from "@/lib/nav";

// Define the Sidebar component.
// Define the Sidebar component props
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
  // Get the current pathname to maintain active state highlighting
  const pathname = usePathname();
  const router = useRouter();
  // Identity comes from the session, never from a literal in this file.
  const user = useCurrentUser();

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error("Logout error:", error);
      // Clear tokens anyway
      api.clearToken();
    }
    router.push("/login");
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Main Aside Container */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-72 h-full bg-surface border-r border-line flex flex-col transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >

        {/* ---------------- LOGO HEADER ---------------- */}
        <div className="flex flex-col gap-2 px-6 py-8">
          <Image
            src="/analyzehive-nexus-logo.png"
            alt="AnalyzeHive Nexus"
            width={1620}
            height={232}
            priority
            className="h-8 w-auto"
          />
          <span className="text-[11px] tracking-wide text-subtle">
            Operations platform
          </span>
        </div>

        {/* ---------------- NAVIGATION ---------------- */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-4">
          <div className="px-3 mb-2 text-[11px] uppercase tracking-widest text-subtle font-bold">
            Platform
          </div>

          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin").map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => onClose()} // Close sidebar on mobile nav click
                className={`
                  group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                    ? "text-accent bg-accent-tint border border-accent-line"
                    : "text-muted hover:text-fg hover:bg-sunken border border-transparent"
                  }
                `}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-accent rounded-r-full" />
                )}

                <Icon
                  className={`w-[18px] h-[18px] transition-colors ${isActive ? "text-accent" : "text-subtle group-hover:text-fg"
                    }`}
                  strokeWidth={2}
                />

                <span className="flex-1">{item.name}</span>

                <ChevronRight className={`w-3 h-3 text-subtle opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 ${isActive ? 'opacity-100 translate-x-0 text-accent' : ''}`} />
              </Link>
            );
          })}
        </nav>

        {/* ---------------- FOOTER PROFILE ---------------- */}
        <div className="p-4 border-t border-line">
          <Link
            href="/profile"
            onClick={onClose}
            className="flex items-center gap-3 p-3 rounded-xl bg-elevated border border-line hover:bg-sunken transition cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-accent to-accent-hover p-[1.5px]">
              <div className="w-full h-full rounded-full bg-surface flex items-center justify-center">
                <span className="text-xs font-bold text-accent">{initialsOf(user?.name)}</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-fg truncate group-hover:text-accent transition">
                {user?.name ?? "Loading\u2026"}
              </div>
              <div className="text-xs text-subtle truncate">
                {user ? formatRole(user.role) : "\u2014"}
              </div>
            </div>

            <Settings className="w-4 h-4 text-subtle group-hover:rotate-45 transition duration-300" />
          </Link>

          <button
            onClick={handleLogout}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2 text-xs font-medium text-subtle hover:text-danger transition-colors"
          >
            <LogOut className="w-3 h-3" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// Export wrapped in memo to prevent unnecessary re-renders during parent updates
export default memo(Sidebar);
