"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

/**
 * Display-currency support.
 *
 * Every amount crossing the API is INTEGER MINOR UNITS OF INR (paise) - that
 * is the one canonical representation, and it is what the schema stores. This
 * context converts to the viewer's chosen currency at the point of display
 * only. Nothing downstream of `format()` should ever be summed or compared,
 * and no component should format money by hand.
 */

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  minorUnits: number;
  locale: string;
  /** Target minor units per 1 INR paise. */
  rateFromInr: number;
  asOf: string | null;
}

interface CurrencyState {
  currencies: Currency[];
  selected: Currency | null;
  setCurrency: (code: string) => void;
  /** INR paise -> a formatted string in the selected currency. */
  format: (valueMinor: number | null | undefined, opts?: { compact?: boolean }) => string;
  ready: boolean;
}

const INR_FALLBACK: Currency = {
  code: "INR", symbol: "₹", name: "Indian Rupee",
  minorUnits: 100, locale: "en-IN", rateFromInr: 1, asOf: null,
};

const CurrencyContext = createContext<CurrencyState | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currencies, setCurrencies] = useState<Currency[]>([INR_FALLBACK]);
  const [code, setCode] = useState("INR");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ selected: string; currencies: Currency[] }>("/api/currency")
      .then((data) => {
        if (cancelled) return;
        setCurrencies(data.currencies.length ? data.currencies : [INR_FALLBACK]);
        setCode(data.selected || "INR");
      })
      .catch(() => {
        /* Unauthenticated or offline - INR fallback keeps amounts readable. */
      })
      .finally(() => !cancelled && setReady(true));
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(
    () => currencies.find((c) => c.code === code) ?? currencies[0] ?? INR_FALLBACK,
    [currencies, code]
  );

  const setCurrency = useCallback((next: string) => {
    setCode(next); // optimistic; the preference is a display setting, not data
    api.put("/api/currency/preference", { code: next }).catch(() => {});
  }, []);

  const format = useCallback(
    (valueMinor: number | null | undefined, opts?: { compact?: boolean }) => {
      // Nothing is formatted until the rate table has loaded. Two reasons:
      // the rate is not known before then, and Node's ICU disagrees with the
      // browser's on compact currency output ("₹0.00" vs "₹0"), which is a
      // hydration mismatch on every money value rendered during SSR.
      if (!ready) return "—";
      if (valueMinor === null || valueMinor === undefined || Number.isNaN(valueMinor)) return "—";
      const major = (valueMinor * selected.rateFromInr) / selected.minorUnits;
      return new Intl.NumberFormat(selected.locale, {
        style: "currency",
        currency: selected.code,
        // Compact gives "₹10.1Cr" in en-IN and "$1.1M" in en-US, which is what
        // a KPI tile wants; the long form is for tables.
        notation: opts?.compact ? "compact" : "standard",
        maximumFractionDigits: opts?.compact ? 2 : 0,
      }).format(major);
    },
    [selected, ready]
  );

  const value = useMemo(
    () => ({ currencies, selected, setCurrency, format, ready }),
    [currencies, selected, setCurrency, format, ready]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyState {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Rendering money outside the provider would silently show INR while the
    // rest of the page showed something else, which is worse than throwing.
    throw new Error("useCurrency must be used inside <CurrencyProvider>");
  }
  return ctx;
}
