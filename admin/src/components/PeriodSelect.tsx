"use client";

import { date, daysBefore, today } from "@/lib/format";

/** A period as the API takes it: Philippine calendar days, both inclusive; empty = open. */
export interface Period {
  preset: string;
  from: string;
  to: string;
}

const PRESETS: { value: string; label: string; days: number }[] = [
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "365", label: "Last 12 months", days: 365 },
];

export function periodFor(preset: string): Period {
  const p = PRESETS.find((x) => x.value === preset);
  if (!p) return { preset, from: "", to: "" };
  const to = today();
  return { preset, from: daysBefore(to, p.days - 1), to };
}

/** "Sep 10, 2026 – Oct 9, 2026", "From …", "Until …" or "All time" (printouts). */
export function periodText(period: Pick<Period, "from" | "to">): string {
  const day = (d: string) => date(`${d}T12:00:00+08:00`);
  if (period.from && period.to) return `${day(period.from)} – ${day(period.to)}`;
  if (period.from) return `From ${day(period.from)}`;
  if (period.to) return `Until ${day(period.to)}`;
  return "All time";
}

/**
 * The prototype's period dropdown, plus "Custom range…" with two date fields.
 * `allTime` adds the prototype's "All time" option (the sessions list).
 */
export function PeriodSelect({
  value,
  onChange,
  allTime = false,
  className = "",
}: {
  value: Period;
  onChange: (period: Period) => void;
  allTime?: boolean;
  className?: string;
}) {
  return (
    <>
      <select
        className={`input ${className}`}
        value={value.preset}
        aria-label="Period"
        onChange={(e) => {
          const preset = e.target.value;
          onChange(preset === "custom" ? { preset, from: value.from || daysBefore(today(), 29), to: value.to || today() } : periodFor(preset));
        }}
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
        {allTime && <option value="all">All time</option>}
        <option value="custom">Custom range…</option>
      </select>
      {value.preset === "custom" && (
        <span className="flex items-center gap-1.5">
          <input
            type="date"
            className={`input ${className}`}
            value={value.from}
            max={value.to || undefined}
            aria-label="From"
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
          />
          <span className="muted small">to</span>
          <input
            type="date"
            className={`input ${className}`}
            value={value.to}
            min={value.from || undefined}
            max={today()}
            aria-label="To"
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
          />
        </span>
      )}
    </>
  );
}
