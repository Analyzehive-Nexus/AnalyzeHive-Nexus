"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange, Check, ChevronDown, Globe2, Coins } from "lucide-react";
import { DATE_RANGES, useFilters } from "@/lib/filters";
import { useCurrency } from "@/lib/currency";

/**
 * The workspace-level controls: date range, region and display currency.
 *
 * These live in the header rather than on each page because they apply to the
 * whole workspace - a per-page copy would let two screens disagree about what
 * period is on screen.
 */

function Menu({
  icon: Icon,
  label,
  children,
  active,
}: {
  icon: typeof Globe2;
  label: string;
  children: (close: () => void) => React.ReactNode;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
          active
            ? "border-accent-line bg-accent-tint text-accent"
            : "border-line-strong bg-surface text-muted hover:text-fg"
        }`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
        <ChevronDown className="h-3 w-3 opacity-60" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 min-w-44 overflow-hidden rounded-lg border border-line bg-surface shadow-overlay">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function Item({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition ${
        selected ? "bg-accent-tint text-accent" : "text-muted hover:bg-elevated hover:text-fg"
      }`}
    >
      {children}
      {selected && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}
    </button>
  );
}

export default function WorkspaceControls() {
  const { range, setRange, region, setRegion, regions, rangeLabel, regionLabel } = useFilters();
  const { currencies, selected, setCurrency } = useCurrency();

  return (
    <div className="flex items-center gap-2">
      <Menu icon={CalendarRange} label={rangeLabel} active={range !== "30d"}>
        {(close) =>
          DATE_RANGES.map((r) => (
            <Item key={r.id} selected={r.id === range} onClick={() => { setRange(r.id); close(); }}>
              {r.label}
            </Item>
          ))
        }
      </Menu>

      <Menu icon={Globe2} label={regionLabel} active={region !== "all"}>
        {(close) => (
          <>
            <Item selected={region === "all"} onClick={() => { setRegion("all"); close(); }}>
              All regions
            </Item>
            {regions.map((r) => (
              <Item key={r.id} selected={r.id === region} onClick={() => { setRegion(r.id); close(); }}>
                {r.name}
              </Item>
            ))}
          </>
        )}
      </Menu>

      <Menu icon={Coins} label={selected?.code ?? "INR"} active={(selected?.code ?? "INR") !== "INR"}>
        {(close) =>
          currencies.map((c) => (
            <Item key={c.code} selected={c.code === selected?.code} onClick={() => { setCurrency(c.code); close(); }}>
              <span>
                <span className="font-medium">{c.symbol} {c.code}</span>
                <span className="ml-2 text-subtle">{c.name}</span>
              </span>
            </Item>
          ))
        }
      </Menu>
    </div>
  );
}
