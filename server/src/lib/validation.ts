import { z } from "zod";

/**
 * Contact and address rules shared by checkout and service booking.
 * The website mirrors these in client/src/lib/validation.ts (same limits, same messages);
 * both are tested against tests/fixtures/address-cases.json.
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

export const fields = {
  fullName: z.string().trim().min(2, MESSAGES.fullName).max(80, MESSAGES.fullNameLong),
  phone: z.string().trim().regex(/^[0-9+\- ]{7,15}$/, MESSAGES.phone),
  addressLine: z.string().trim().min(5, MESSAGES.addressLine).max(300, MESSAGES.addressLineLong),
  city: z.string().trim().min(2, MESSAGES.city).max(60, MESSAGES.city),
  state: z.string().trim().min(2, MESSAGES.state).max(60, MESSAGES.state),
  pincode: z.string().trim().regex(/^\d{6}$/, MESSAGES.pincode),
  notes: z.string().trim().max(1000, MESSAGES.notesLong).optional(),
};

/** Delivery address for an order. */
export const addressSchema = z.object({
  fullName: fields.fullName,
  phone: fields.phone,
  addressLine: fields.addressLine,
  city: fields.city,
  state: fields.state,
  pincode: fields.pincode,
});

/** A service booking request (multipart form, so ids arrive as strings). */
export const bookingSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  slotId: z.coerce.number().int().positive({ message: "Choose a time slot" }),
  fullName: fields.fullName,
  phone: fields.phone,
  addressLine: fields.addressLine,
  city: fields.city,
  pincode: fields.pincode,
  notes: fields.notes,
});
