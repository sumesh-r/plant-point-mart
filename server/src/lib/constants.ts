export const ROLES = ["CUSTOMER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ORDER_STATUSES = [
  "PLACED",
  "CONFIRMED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const SLOT_STATUSES = ["AVAILABLE", "BOOKED", "BLOCKED"] as const;

/** Flat shipping fee in rupees; free above FREE_SHIPPING_ABOVE. */
export const SHIPPING_FEE = 49;
export const FREE_SHIPPING_ABOVE = 499;
