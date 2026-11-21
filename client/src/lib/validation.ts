/**
 * Form checks that mirror the server's rules (server/src/routes/order.routes.ts and booking.routes.ts),
 * so people see problems next to the field before anything is sent. The server still checks everything.
 * Both sides are tested against the same cases in tests/fixtures/address-cases.json.
 */

export const MESSAGES = {
  fullName: "Enter the full name",
  fullNameLong: "Name is too long (80 characters max)",
  phone: "Enter a valid phone number",
  addressLine: "Enter the full address (house no., street, area)",
  addressLineLong: "Address is too long (300 characters max)",
  city: "Enter the city",
  state: "Enter the state",
  pincode: "Pincode must be 6 digits",
  notesLong: "Notes are too long (1000 characters max)",
} as const;

export const PHONE_RE = /^[0-9+\- ]{7,15}$/;
export const PINCODE_RE = /^\d{6}$/;

type Rule = (value: string) => string | null;

const between = (min: number, max: number, short: string, long: string): Rule => (v) => {
  const n = v.trim().length;
  if (n < min) return short;
  if (n > max) return long;
  return null;
};

export const rules = {
  fullName: between(2, 80, MESSAGES.fullName, MESSAGES.fullNameLong),
  phone: (v: string) => (PHONE_RE.test(v.trim()) ? null : MESSAGES.phone),
  addressLine: between(5, 300, MESSAGES.addressLine, MESSAGES.addressLineLong),
  city: between(2, 60, MESSAGES.city, MESSAGES.city),
  state: between(2, 60, MESSAGES.state, MESSAGES.state),
  pincode: (v: string) => (PINCODE_RE.test(v.trim()) ? null : MESSAGES.pincode),
  notes: (v: string) => (v.trim().length > 1000 ? MESSAGES.notesLong : null),
} satisfies Record<string, Rule>;

export type FieldName = keyof typeof rules;
export type FieldErrors = Partial<Record<FieldName, string>>;

/** Check the given fields of a form. Returns only the fields that have a problem. */
export function validate(form: Partial<Record<FieldName, string>>, fields: readonly FieldName[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const f of fields) {
    const problem = rules[f](form[f] ?? "");
    if (problem) errors[f] = problem;
  }
  return errors;
}

export const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0;

/** Fields on the service booking form, in the order they appear. */
export const BOOKING_FIELDS = ["fullName", "phone", "addressLine", "city", "pincode", "notes"] as const;
/** Fields on the checkout delivery address form, in the order they appear. */
export const ADDRESS_FIELDS = ["fullName", "phone", "addressLine", "city", "state", "pincode"] as const;
