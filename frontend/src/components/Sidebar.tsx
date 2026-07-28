"use client"; // Indicates this file is a Client Component in Next.js

// Import the Link component for client-side navigation between pages
import Link from "next/link";
// Import the usePathname hook to get the current URL path
// Import the usePathname hook to get the current URL path
import { usePathname, useRouter } from "next/navigation";
import { memo } from "react";
// Import icons from 'lucide-react' for a professional, consistent look
import {
  LayoutDashboard,
  Users,
  Box,
  Radar,
  Settings,
  LogOut,
  ChevronRight,
  Hexagon,
  Radio,
  UploadCloud,
  Activity,
  User
} from "lucide-react";
import { api } from "@/lib/api";

// Define the navigation items array with Lucide icons.
// Static definitions prevent re-creation on every render.
const navItems = [
  {
    name: "Dashboard", // The display name
    href: "/", // The target URL
    icon: LayoutDashboard, // The Lucide React component for the icon
  },
  {
    name: "Commercial Truth",
    href: "/commercial-truth",
    icon: Users,
  },
  {
    name: "Supply Chain Physics",
    href: "/supply-chain-physics",
    icon: Box,
  },
  {
    name: "Market Radar",
    href: "/market-radar",
    icon: Radar,
  },
  {
    name: "Live Operations",
    href: "/live-operations",
    icon: Radio,
  },
  {
    name: "Data Connection",
    href: "/data-connection",
    icon: UploadCloud,
  },
  {
    name: "System Status",
    href: "/system-status",
    icon: Activity,
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User,
  },
];

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
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Main Aside Container */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-72 h-full bg-[#0b0f14] border-r border-[#1e293b] flex flex-col transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >

        {/* ---------------- LOGO HEADER ---------------- */}
        <div className="flex items-center gap-3 px-6 py-8">
          <div className="relative group">
            <div className="absolute inset-0 bg-[#7cff4e] blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300" />
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1e293b] to-[#0f141b] border border-[#7cff4e]/20 flex items-center justify-center shadow-lg">
              <Hexagon className="w-5 h-5 text-[#7cff4e] fill-[#7cff4e]/10" />
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-white font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Analyzehive
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[#64748b] font-medium">
              Ent-OS v2.4
            </span>
          </div>
        </div>

        {/* ---------------- NAVIGATION ---------------- */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-4">
          <div className="px-3 mb-2 text-[11px] uppercase tracking-widest text-[#475569] font-bold">
            Platform
          </div>

          {navItems.map((item) => {
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
                    ? "text-[#7cff4e] bg-[#7cff4e]/5 border border-[#7cff4e]/10"
                    : "text-[#94a3b8] hover:text-white hover:bg-[#1e293b]/50 border border-transparent"
                  }
                `}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#7cff4e] rounded-r-full shadow-[0_0_12px_rgba(124,255,78,0.5)]" />
                )}

                <Icon
                  className={`w-[18px] h-[18px] transition-colors ${isActive ? "text-[#7cff4e]" : "text-[#64748b] group-hover:text-white"
                    }`}
                  strokeWidth={2}
                />

                <span className="flex-1">{item.name}</span>

                <ChevronRight className={`w-3 h-3 text-[#475569] opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 ${isActive ? 'opacity-100 translate-x-0 text-[#7cff4e]/50' : ''}`} />
              </Link>
            );
          })}
        </nav>

        {/* ---------------- FOOTER PROFILE ---------------- */}
        <div className="p-4 border-t border-[#1e293b]">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1e293b]/30 border border-[#334155]/30 hover:bg-[#1e293b]/50 transition cursor-pointer group">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#7cff4e] to-[#22c55e] p-[1px]">
              <div className="w-full h-full rounded-full bg-[#0b0f14] flex items-center justify-center">
                <span className="text-xs font-bold text-[#7cff4e]">AS</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate group-hover:text-[#7cff4e] transition">A. Sharma</div>
              <div className="text-xs text-[#64748b] truncate">Admin Control</div>
            </div>

            <Settings className="w-4 h-4 text-[#64748b] group-hover:rotate-45 transition duration-300" />
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2 text-xs font-medium text-[#64748b] hover:text-[#ef4444] transition-colors"
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
