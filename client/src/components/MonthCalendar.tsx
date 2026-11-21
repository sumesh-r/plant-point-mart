import clsx from "clsx";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export const dayKey = (d: Date | string) => format(new Date(d), "yyyy-MM-dd");

/**
 * Month grid calendar. `marks` maps yyyy-MM-dd → small label/count shown on the day.
 * Days without marks are disabled unless `allowUnmarked` is set (admin view).
 */
export function MonthCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  marks,
  minDate,
  allowUnmarked,
  renderMark,
  loading,
}: {
  month: Date;
  onMonthChange: (m: Date) => void;
  selected: Date | null;
  onSelect: (d: Date) => void;
  marks: Map<string, number>;
  minDate?: Date;
  allowUnmarked?: boolean;
  renderMark?: (count: number, day: Date) => ReactNode;
  loading?: boolean;
}) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const min = minDate ? startOfDay(minDate) : null;
  const canGoBack = !min || isBefore(min, startOfMonth(month));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          disabled={!canGoBack}
          className="rounded-lg p-2 transition hover:bg-sand-100 disabled:opacity-30"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="font-display text-lg font-semibold">{format(month, "MMMM yyyy")}</p>
        <button type="button" onClick={() => onMonthChange(addMonths(month, 1))} className="rounded-lg p-2 transition hover:bg-sand-100" aria-label="Next month">
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-forest-950/40">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="pb-2">{d}</div>
        ))}
      </div>
      <div className={clsx("grid grid-cols-7 gap-1", loading && "opacity-50")}>
        {days.map((d) => {
          const inMonth = isSameMonth(d, month);
          const count = marks.get(dayKey(d)) ?? 0;
          const past = min ? isBefore(d, min) : false;
          const disabled = !inMonth || past || (!allowUnmarked && count === 0);
          const isSel = selected && isSameDay(d, selected);
          return (
            <button
              type="button"
              key={d.toISOString()}
              disabled={disabled}
              onClick={() => onSelect(d)}
              className={clsx(
                "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-medium transition",
                !inMonth && "invisible",
                isSel
                  ? "bg-forest-700 text-white shadow-sm"
                  : count > 0 && !past
                    ? "bg-forest-50 text-forest-900 hover:bg-forest-100"
                    : disabled
                      ? "text-forest-950/25"
                      : "text-forest-900 hover:bg-sand-100",
                isToday(d) && !isSel && "ring-1 ring-inset ring-forest-400",
              )}
            >
              {format(d, "d")}
              {count > 0 && !past && (
                <span className={clsx("mt-0.5 text-[10px] leading-none", isSel ? "text-forest-100" : "text-forest-600")}>
                  {renderMark ? renderMark(count, d) : `${count} free`}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
