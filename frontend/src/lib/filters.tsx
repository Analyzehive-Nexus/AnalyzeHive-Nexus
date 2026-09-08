"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { api } from "@/lib/api";

/**
 * The global date-range and region filter that the whole workspace reads.
 *
 * Kept in one place so a page cannot disagree with the header about what
 * period is on screen. Persisted per browser only - it is a view preference,
 * not data, and it must never widen what the caller's region scope allows
 * (the API enforces that; this only ever narrows).
 */

export const DATE_RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "qtd", label: "Quarter to date" },
] as const;

export type RangeId = (typeof DATE_RANGES)[number]["id"];

export interface Region { id: string; name: string }

interface FilterState {
  range: RangeId;
  setRange: (r: RangeId) => void;
  region: string; // 'all' or a region id
  setRegion: (r: string) => void;
  regions: Region[];
  rangeLabel: string;
  regionLabel: string;
}

const STORAGE_KEY = "nexus.filters";
const DEFAULTS: Persisted = { range: "30d", region: "all" };

interface Persisted { range: RangeId; region: string }

/**
 * localStorage is external state, so it is read through useSyncExternalStore
 * rather than an effect. That gives a stable server snapshot (the defaults),
 * a client snapshot read at the right moment, and no setState-in-effect.
 */
const storage = {
  listeners: new Set<() => void>(),
  cache: null as string | null,
  snapshot: DEFAULTS,

  subscribe(fn: () => void) {
    storage.listeners.add(fn);
    // `storage` events fire when another tab writes, keeping views in step.
    window.addEventListener("storage", fn);
    return () => {
      storage.listeners.delete(fn);
      window.removeEventListener("storage", fn);
    };
  },

  /** Must return a cached object; a fresh one each call is an infinite loop. */
  getSnapshot(): Persisted {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* private mode or blocked storage - fall through to defaults */
    }
    if (raw !== storage.cache) {
      storage.cache = raw;
      let next = DEFAULTS;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<Persisted>;
          next = {
            range: DATE_RANGES.some((r) => r.id === parsed.range)
              ? (parsed.range as RangeId)
              : DEFAULTS.range,
            region: typeof parsed.region === "string" ? parsed.region : DEFAULTS.region,
          };
        } catch {
          next = DEFAULTS;
        }
      }
      storage.snapshot = next;
    }
    return storage.snapshot;
  },

  getServerSnapshot(): Persisted {
    return DEFAULTS;
  },

  write(next: Persisted) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* non-fatal - the value still lives in this session's snapshot */
    }
    storage.cache = null; // force a re-read on the next snapshot
    storage.snapshot = next;
    storage.listeners.forEach((fn) => fn());
  },
};

const FilterContext = createContext<FilterState | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const persisted = useSyncExternalStore(
    storage.subscribe,
    storage.getSnapshot,
    storage.getServerSnapshot
  );
  const { range, region } = persisted;
  const [regions, setRegions] = useState<Region[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ regions: Region[] }>("/api/command-center/regions")
      .then((d) => !cancelled && setRegions(d.regions))
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const value = useMemo<FilterState>(() => ({
    range,
    setRange: (r) => storage.write({ range: r, region }),
    region,
    setRegion: (r) => storage.write({ range, region: r }),
    regions,
    rangeLabel: DATE_RANGES.find((r) => r.id === range)?.label ?? "30 days",
    regionLabel: region === "all"
      ? "All regions"
      : regions.find((r) => r.id === region)?.name ?? region,
  }), [range, region, regions]);

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters(): FilterState {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used inside <FilterProvider>");
  return ctx;
}

/** Query string shared by every filtered endpoint. */
export function useFilterQuery(): string {
  const { range, region } = useFilters();
  return useCallback(() => `range=${range}&region=${region}`, [range, region])();
}
