import { describe, expect, it } from "vitest";
import { BOOKING_FLOW, bookingStatusLabel, fmtDuration, fmtSlot, fmtTime, imageUrl, money, ORDER_FLOW, orderStatusLabel } from "../../src/lib/format";

describe("money", () => {
  it.each([
    [0, "₹0"],
    [49, "₹49"],
    [1499, "₹1,499"],
    [150000, "₹1,50,000"], // Indian digit grouping
  ])("%i → %s", (n, s) => expect(money(n)).toBe(s));
});

describe("fmtDuration", () => {
  it.each([
    [30, "30 min"],
    [60, "1 hr"],
    [90, "1 hr 30 min"],
    [180, "3 hrs"],
  ])("%i minutes → %s", (m, s) => expect(fmtDuration(m)).toBe(s));
});

describe("times", () => {
  it("shows 12-hour times", () => {
    expect(fmtTime(new Date(2026, 10, 24, 9, 0))).toBe("9:00 AM");
    expect(fmtTime(new Date(2026, 10, 24, 16, 30))).toBe("4:30 PM");
  });

  it("shows a slot as day · start – end", () => {
    const s = fmtSlot(new Date(2026, 10, 24, 11, 0), new Date(2026, 10, 24, 13, 0));
    expect(s).toContain("11:00 AM");
    expect(s).toContain("1:00 PM");
    expect(s).toMatch(/24 Nov/);
  });
});

describe("imageUrl", () => {
  it("falls back to the placeholder when there's no image", () => {
    expect(imageUrl(null)).toBe("/placeholder-plant.svg");
    expect(imageUrl(undefined)).toBe("/placeholder-plant.svg");
    expect(imageUrl("")).toBe("/placeholder-plant.svg");
    expect(imageUrl("/uploads/a.png")).toBe("/uploads/a.png");
  });
});

describe("status labels", () => {
  it("every step in the flows has a label", () => {
    for (const s of [...ORDER_FLOW, "CANCELLED" as const]) expect(orderStatusLabel[s]).toBeTruthy();
    for (const s of [...BOOKING_FLOW, "CANCELLED" as const]) expect(bookingStatusLabel[s]).toBeTruthy();
  });
});
