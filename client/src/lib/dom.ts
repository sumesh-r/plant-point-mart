/** Smoothly bring a section into view (used after validation errors, especially on phones). */
export function scrollToId(id: string) {
  setTimeout(() => document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 50);
}

/** Focus the first field with a problem, in the order the fields appear on the page. */
export function focusFirstError(errors: Record<string, string | undefined>) {
  const names = Object.keys(errors).filter((k) => errors[k]);
  if (!names.length) return;
  const selector = names.map((n) => `[name="${CSS.escape(n)}"]`).join(",");
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.scrollIntoView?.({ behavior: "smooth", block: "center" });
  el.focus({ preventScroll: true });
}
