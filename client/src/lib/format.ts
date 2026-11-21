import { format } from "date-fns";
import type { BookingStatus, OrderStatus } from "./types";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const money = (n: number) => inr.format(n);
export const fmtDate = (d: string | Date) => format(new Date(d), "d MMM yyyy");
export const fmtDateTime = (d: string | Date) => format(new Date(d), "d MMM yyyy, h:mm a");
export const fmtTime = (d: string | Date) => format(new Date(d), "h:mm a");
export const fmtSlot = (start: string | Date, end: string | Date) =>
  `${format(new Date(start), "EEE, d MMM")} · ${fmtTime(start)} – ${fmtTime(end)}`;

export const fmtDuration = (mins: number) => {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr${h > 1 ? "s" : ""}`;
};

export const imageUrl = (url: string | null | undefined) => url || "/placeholder-plant.svg";

export const ORDER_FLOW: OrderStatus[] = ["PLACED", "CONFIRMED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
export const BOOKING_FLOW: BookingStatus[] = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"];

export const orderStatusLabel: Record<OrderStatus, string> = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const bookingStatusLabel: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export type Tone = "gray" | "green" | "amber" | "blue" | "red" | "violet";

export const orderStatusTone: Record<OrderStatus, Tone> = {
  PLACED: "amber",
  CONFIRMED: "blue",
  SHIPPED: "violet",
  OUT_FOR_DELIVERY: "violet",
  DELIVERED: "green",
  CANCELLED: "red",
};

export const bookingStatusTone: Record<BookingStatus, Tone> = {
  PENDING: "amber",
  CONFIRMED: "blue",
  IN_PROGRESS: "violet",
  COMPLETED: "green",
  CANCELLED: "red",
};
