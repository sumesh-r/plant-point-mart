import { z } from "zod";
import { badRequest } from "./errors";

/**
 * Validate input with a Zod schema. On failure throws a 400 whose message is the first problem in plain
 * words (e.g. "Enter the full address") and whose details list every problem by field, so the website can
 * show each one under its input: { fields: { addressLine: "Enter the full address", pincode: "…" } }.
 */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      if (key && !(key in fields)) fields[key] = issue.message;
    }
    throw badRequest(result.error.issues[0]?.message ?? "Invalid input", { fields });
  }
  return result.data;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Short human-friendly reference, e.g. PPM-7K3QX9 */
export function makeReference(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${s}`;
}

export const idParam = z.coerce.number().int().positive();
