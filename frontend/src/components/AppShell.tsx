"use client";

import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import ServerTime from "@/components/ServerTime";
import { usePathname } from "next/navigation";
import { useState } from "react";

// Background grid style configuration
const backgroundGridStyle = {
  backgroundImage: `
    linear-gradient(rgba(124,255,78,0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(124,255,78,0.035) 1px, transparent 1px)
  `,
  backgroundSize: "48px 48px",
  maskImage:
    "radial-gradient(circle at top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 75%)",
  WebkitMaskImage:
    "radial-gradient(circle at top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 75%)",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isAuthPage = pathname === "/register" || pathname === "/login";

  if (isAuthPage) {
    return (
      <div className="h-screen w-full bg-[#0b0f14] relative overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-[#0b0f14] relative overflow-hidden">
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
          {/* Ambient Green Glow Effect */}
          <div className="absolute -top-[320px] left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-[#7cff4e]/10 blur-[180px]" />
        </div>

        {/* Top Navigation - z-20 so its dropdowns (e.g. notifications) render above page content */}
        <div className="relative z-20">
          <TopNav onMenuClick={() => setIsSidebarOpen(true)} />
        </div>

        {/* Page Content - z-10 to sit above background */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 relative z-10">
            {children}
        </div>
      </main>

      {/* Floating Server Time */}
      <ServerTime />
    </div>
  );
}
