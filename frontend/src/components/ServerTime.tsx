"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

const RESYNC_INTERVAL_MS = 30_000;

export default function ServerTime() {
  // Starts null so server-rendered and first client-rendered markup match exactly;
  // new Date() differs by however many ms passed between SSR and hydration, which
  // trips React's hydration mismatch check. The real value is set client-only below.
  const [time, setTime] = useState<Date | null>(null);
  const offsetRef = useRef(0); // serverTime - clientTime, in ms

  useEffect(() => {
    let cancelled = false;

    const resync = async () => {
      try {
        const { time: serverTime } = await api.get<{ time: string }>("/api/health");
        if (!cancelled) {
          offsetRef.current = new Date(serverTime).getTime() - Date.now();
        }
      } catch {
        // Backend unreachable - keep ticking off the last known offset (or 0).
      }
    };

    resync();
    const resyncTimer = setInterval(resync, RESYNC_INTERVAL_MS);

    const tickTimer = setInterval(() => {
      setTime(new Date(Date.now() + offsetRef.current));
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(resyncTimer);
      clearInterval(tickTimer);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-[#0f141b] border border-white/10 text-xs text-[#9aa4b2] backdrop-blur-md hover:text-[#e6eaf0] transition">
      <span className="w-2 h-2 rounded-full bg-[#7cff4e] animate-pulse" />
      Server Time
      <span className="font-mono text-[#e6eaf0]">
        {time ? `${time.toUTCString().slice(17, 25)} UTC` : "--:--:-- UTC"}
      </span>
    </div>
  );
}
