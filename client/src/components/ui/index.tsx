import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import { Loader2, X } from "lucide-react";
import { cloneElement, isValidElement, useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import type { Tone } from "../../lib/format";

/* ------------------------------- Button ------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-forest-700 text-white hover:bg-forest-800 active:bg-forest-900 shadow-sm",
  secondary: "bg-forest-50 text-forest-800 hover:bg-forest-100",
  outline: "border border-sand-200 bg-white text-forest-900 hover:border-forest-300 hover:bg-forest-50",
  ghost: "text-forest-800 hover:bg-forest-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  // twMerge so a passed className (e.g. "hidden", "text-red-600") overrides the defaults.
  return twMerge(clsx(
    "inline-flex items-center justify-center font-semibold transition select-none whitespace-nowrap",
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-forest-500/25",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  ));
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({ variant, size, loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

/* -------------------------------- Badge ------------------------------- */

const tones: Record<Tone, string> = {
  gray: "bg-sand-100 text-forest-900/70 ring-sand-200",
  green: "bg-forest-50 text-forest-700 ring-forest-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
};

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------- Modal ------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-forest-950/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        className={clsx(
          // Phones: a bottom sheet (dvh so the browser's address bar doesn't hide the end of it).
          "relative w-full max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-white shadow-lift animate-scale-in sm:max-h-[92vh] sm:rounded-2xl",
          size === "sm" && "sm:max-w-sm",
          size === "md" && "sm:max-w-md",
          size === "lg" && "sm:max-w-2xl",
        )}
      >
        {/* Sticky so the close button stays reachable on long panels. */}
        <div className="sticky top-0 z-20 flex items-start justify-between gap-4 bg-white px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
          {title ? <h2 className="min-w-0 text-lg font-semibold sm:text-xl">{title}</h2> : <span />}
          <button
            onClick={onClose}
            className="-mr-1.5 shrink-0 rounded-lg p-2 text-forest-900/50 transition hover:bg-sand-100 hover:text-forest-900"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="px-4 pb-6 pt-1 sm:px-6" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Feedback ------------------------------ */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("animate-spin text-forest-600", className ?? "size-6")} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="size-8" />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-xl bg-sand-100", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-sand-300 bg-white/60 px-6 py-14 text-center">
      {icon && <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-forest-50 text-forest-600">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-forest-950/60">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <p className="font-medium text-red-800">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* -------------------------------- Form -------------------------------- */

type ControlProps = { id?: string; className?: string; "aria-invalid"?: boolean; "aria-describedby"?: string };

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const autoId = useId();
  // Connect the label, hint and error to a single input/select/textarea child (screen readers, tests).
  const control =
    isValidElement<ControlProps>(children) && typeof children.type === "string" && ["input", "select", "textarea"].includes(children.type)
      ? children
      : null;
  const id = control?.props.id ?? `f${autoId.replace(/:/g, "")}`;
  const messageId = `${id}-msg`;
  const content = control
    ? cloneElement(control, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? messageId : undefined,
        className: clsx(control.props.className, error && "border-red-400 focus:border-red-500 focus:ring-red-500/15"),
      })
    : children;
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={control ? id : undefined}>
          {label}
        </label>
      )}
      {content}
      {error ? (
        <p id={messageId} role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1 text-xs text-forest-950/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function QuantityStepper({
  value,
  onChange,
  max,
  disabled,
  size = "md",
}: {
  value: number;
  onChange: (n: number) => void;
  max: number;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const btn = clsx(
    "flex items-center justify-center font-semibold text-forest-800 transition hover:bg-forest-50 disabled:opacity-30",
    size === "sm" ? "size-8" : "size-10",
  );
  return (
    <div className="inline-flex items-center rounded-xl border border-sand-200 bg-white">
      <button className={btn} disabled={disabled || value <= 1} onClick={() => onChange(value - 1)} aria-label="Decrease">
        −
      </button>
      <span className={clsx("min-w-8 text-center font-semibold tabular-nums", size === "sm" ? "text-sm" : "")}>{value}</span>
      <button className={btn} disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label="Increase">
        +
      </button>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-forest-950/60">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
