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

  // Renders inline in the TopNav. It used to float over the page content as a
  // fixed pill, which covered whatever sat in the bottom-right corner.
  return (
    <div
      className="hidden items-center gap-2 sm:flex"
      title="Server time, resynced from the backend every 30s"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
      <span className="hidden text-subtle md:inline">Server time</span>
      <span className="font-mono tabular-nums text-fg">
        {time ? `${time.toUTCString().slice(17, 25)} UTC` : "--:--:-- UTC"}
      </span>
    </div>
  );
}
