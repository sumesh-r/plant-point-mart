import { describe, expect, it } from "vitest";
import fixture from "../../../tests/fixtures/address-cases.json";
import { addressSchema, bookingSchema, MESSAGES } from "../../src/lib/validation";

type Case = { name: string; field: string; value?: string; repeat?: number; valid: boolean };
const valueOf = (c: Case) => c.value ?? "x".repeat(c.repeat ?? 0);

const bookingBase = { serviceId: "1", slotId: "2", ...fixture.valid };
const addressBase = { ...fixture.valid } as Record<string, string>;
delete addressBase.notes;

describe("shared address cases (same file the website is tested against)", () => {
  for (const c of fixture.cases as Case[]) {
    it(`${c.field}: ${c.name} → ${c.valid ? "accepted" : "rejected"}`, () => {
      const schema = c.field === "notes" ? bookingSchema : c.field === "state" ? addressSchema : bookingSchema;
      const base = schema === addressSchema ? addressBase : bookingBase;
      const result = schema.safeParse({ ...base, [c.field]: valueOf(c) });
      expect(result.success).toBe(c.valid);
      if (!c.valid && !result.success) {
        expect(result.error.issues[0].path).toEqual([c.field]);
      }
    });
  }
});

describe("addressSchema", () => {
  it("accepts a complete address and trims spaces", () => {
    const r = addressSchema.parse({ ...addressBase, fullName: "  Priya Raman  ", city: " Coimbatore " });
    expect(r.fullName).toBe("Priya Raman");
    expect(r.city).toBe("Coimbatore");
  });

  it("explains a short address in plain words", () => {
    const r = addressSchema.safeParse({ ...addressBase, addressLine: "test" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].message).toBe(MESSAGES.addressLine);
  });

  it("reports every missing field, not just the first", () => {
    const r = addressSchema.safeParse({});
    expect(r.success).toBe(false);
    const fields = !r.success ? r.error.issues.map((i) => i.path[0]) : [];
    expect(fields).toEqual(expect.arrayContaining(["fullName", "phone", "addressLine", "city", "state", "pincode"]));
  });
});

describe("bookingSchema", () => {
  it("turns form-data ids (strings) into numbers", () => {
    const r = bookingSchema.parse(bookingBase);
    expect(r.serviceId).toBe(1);
    expect(r.slotId).toBe(2);
  });

  it("notes are optional", () => {
    const { notes: _n, ...rest } = bookingBase;
    expect(bookingSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects a missing or zero slot", () => {
    expect(bookingSchema.safeParse({ ...bookingBase, slotId: "0" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...bookingBase, slotId: "" }).success).toBe(false);
  });

  it("does not need a state (bookings are local visits)", () => {
    expect(bookingSchema.safeParse(bookingBase).success).toBe(true);
  });
});
