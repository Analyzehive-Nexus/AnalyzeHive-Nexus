"use client";

import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import { CurrencyProvider } from "@/lib/currency";
import { FilterProvider } from "@/lib/filters";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Background grid. On the light theme this is a faint neutral rule rather than
// a glowing overlay - just enough texture to stop large empty areas from
// reading as a blank page, and masked out before it reaches the content.
const backgroundGridStyle = {
  backgroundImage: `
    linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)
  `,
  backgroundSize: "48px 48px",
  maskImage:
    "radial-gradient(circle at top, rgba(0,0,0,1) 25%, rgba(0,0,0,0) 70%)",
  WebkitMaskImage:
    "radial-gradient(circle at top, rgba(0,0,0,1) 25%, rgba(0,0,0,0) 70%)",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isAuthPage =
    pathname === "/register" ||
    pathname === "/login" ||
    pathname === "/auth/callback" ||
    pathname === "/auth/verify-email";

  // Refresh the cached user against the server once per shell mount, so the
  // Sidebar and Profile reflect the real record rather than whatever was
  // cached at login. setUser() notifies useCurrentUser() subscribers; a
  // failure is non-fatal and just leaves the cached copy in place.
  useEffect(() => {
    if (isAuthPage) return;
    let cancelled = false;
    api
      .getCurrentUser()
      .then((fresh) => {
        if (!cancelled) api.setUser(fresh);
      })
      .catch(() => {
        /* offline or expired session - requireAuth handles the real gating */
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthPage]);

  if (isAuthPage) {
    return (
      <div className="h-screen w-full bg-canvas relative overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    // Providers wrap only the authenticated shell: the auth pages have no
    // session, so fetching currency/region there would just 401.
    <CurrencyProvider>
     <FilterProvider>
    <div className="h-screen w-full flex bg-canvas relative overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden w-full relative">
        
        {/* GLOBAL BACKGROUND: Grid + Glow */}
        <div className="pointer-events-none absolute inset-0 z-0">
          {/* The Grid Pattern */}
          <div
            className="absolute inset-0"
            style={backgroundGridStyle} 
          />
          {/* Ambient wash - a barely-there emerald tint at the top of the
              canvas, replacing the dark theme's neon glow. */}
          <div className="absolute -top-[420px] left-1/2 -translate-x-1/2 w-[1100px] h-[900px] rounded-full bg-accent/[0.04] blur-[160px]" />
        </div>

        {/* Top Navigation - z-20 so its dropdowns (e.g. notifications) render above page content */}
        <div className="relative z-20">
          <TopNav onMenuClick={() => setIsSidebarOpen(true)} />
        </div>

        {/* Page content. Padding and measure live here, once, so every page
            lines up instead of each inventing its own container. Pages render
            their sections directly and must not re-add their own padding or
            max-width. */}
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </div>
      </main>
    </div>
     </FilterProvider>
    </CurrencyProvider>
  );
}
