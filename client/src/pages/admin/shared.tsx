import clsx from "clsx";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

export function Table({ children, mobile }: { children: ReactNode; /** hide below md when a MobileList is shown instead */ mobile?: boolean }) {
  return (
    <div className={clsx("card overflow-hidden", mobile === false && "hidden md:block")}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={clsx("whitespace-nowrap border-b border-sand-200 bg-sand-100/60 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-forest-950/50", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={clsx("border-b border-sand-100 px-4 py-3 align-middle", className)}>{children}</td>;
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-forest-950/40" />
      <input className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Search…"} />
    </div>
  );
}

export function FilterTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | "";
  onChange: (v: T | "") => void;
  options: { value: T | ""; label: string }[];
}) {
  return (
    // One scrollable row on phones, wraps on larger screens.
    <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-soft sm:flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition sm:py-1.5",
            value === o.value ? "bg-forest-700 text-white" : "text-forest-900/70 hover:bg-forest-50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatCard({ label, value, icon, hint, tone = "forest" }: { label: string; value: ReactNode; icon: ReactNode; hint?: ReactNode; tone?: "forest" | "clay" | "sky" | "violet" }) {
  const tones = {
    forest: "bg-forest-50 text-forest-700",
    clay: "bg-orange-50 text-clay-600",
    sky: "bg-sky-50 text-sky-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug text-forest-950/55 sm:text-sm">{label}</p>
        <span className={clsx("flex size-8 shrink-0 items-center justify-center rounded-xl sm:size-9", tones[tone])}>{icon}</span>
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight sm:mt-3 sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-forest-950/50 sm:text-xs">{hint}</p>}
    </div>
  );
}

/** Phone layout for admin lists: a stack of tappable cards (tables are shown from md up). */
export function MobileList({ children }: { children: ReactNode }) {
  return <ul className="space-y-3 md:hidden">{children}</ul>;
}

export function MobileCard({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  return (
    <li>
      <div
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={(e) => onClick && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick())}
        className="card block p-4 transition active:scale-[0.99] active:bg-sand-100/40"
      >
        {children}
      </div>
    </li>
  );
}
