import clsx from "clsx";
import { Check, X } from "lucide-react";
import { fmtDateTime } from "../lib/format";
import type { StatusHistory } from "../lib/types";

/**
 * Vertical tracking timeline. Shows each step of `flow`, marking the steps
 * reached (with timestamps from history) and the current one.
 */
export function StatusTimeline<S extends string>({
  flow,
  current,
  history,
  labels,
  cancelled,
}: {
  flow: S[];
  current: S;
  history: StatusHistory<S>[];
  labels: Record<S, string>;
  cancelled?: S;
}) {
  const isCancelled = current === cancelled;
  const reachedIdx = isCancelled
    ? Math.max(-1, ...history.filter((h) => h.status !== cancelled).map((h) => flow.indexOf(h.status)))
    : flow.indexOf(current);
  const steps: S[] = isCancelled ? [...flow.slice(0, reachedIdx + 1), cancelled!] : flow;

  return (
    <ol className="relative">
      {steps.map((step, i) => {
        const entry = [...history].reverse().find((h) => h.status === step);
        const done = isCancelled ? true : i <= reachedIdx;
        const isCurrent = step === current;
        const isCancelStep = step === cancelled;
        return (
          <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
            {i < steps.length - 1 && (
              <span
                className={clsx(
                  "absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-0.5",
                  done && i < reachedIdx + (isCancelled ? 1 : 0) ? "bg-forest-500" : "bg-sand-200",
                )}
              />
            )}
            <span
              className={clsx(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition",
                isCancelStep
                  ? "border-red-500 bg-red-500 text-white"
                  : done
                    ? "border-forest-600 bg-forest-600 text-white"
                    : "border-sand-300 bg-white",
                isCurrent && !isCancelStep && "ring-4 ring-forest-500/20",
              )}
            >
              {isCancelStep ? <X className="size-3.5" strokeWidth={3} /> : done && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <div className="pt-0.5">
              <p className={clsx("text-sm font-semibold", !done && "text-forest-950/40")}>{labels[step]}</p>
              {entry && <p className="text-xs text-forest-950/50">{fmtDateTime(entry.createdAt)}</p>}
              {entry?.note && <p className="mt-0.5 text-xs text-forest-950/70">{entry.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
