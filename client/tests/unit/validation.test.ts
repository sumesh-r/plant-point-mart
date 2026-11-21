import { describe, expect, it } from "vitest";
import fixture from "../../../tests/fixtures/address-cases.json";
import { ADDRESS_FIELDS, BOOKING_FIELDS, hasErrors, MESSAGES, rules, validate, type FieldName } from "../../src/lib/validation";

type Case = { name: string; field: FieldName; value?: string; repeat?: number; valid: boolean };
const valueOf = (c: Case) => c.value ?? "x".repeat(c.repeat ?? 0);

describe("shared address cases (same file the server is tested against)", () => {
  for (const c of fixture.cases as Case[]) {
    it(`${c.field}: ${c.name} → ${c.valid ? "accepted" : "rejected"}`, () => {
      expect(rules[c.field](valueOf(c)) === null).toBe(c.valid);
    });
  }
});

describe("validate", () => {
  it("a complete booking form has no problems", () => {
    expect(validate(fixture.valid, BOOKING_FIELDS)).toEqual({});
    expect(hasErrors(validate(fixture.valid, BOOKING_FIELDS))).toBe(false);
  });

  it('the reported case: address "test" is flagged on the address field only', () => {
    const errors = validate({ ...fixture.valid, addressLine: "test" }, BOOKING_FIELDS);
    expect(errors).toEqual({ addressLine: MESSAGES.addressLine });
  });

  it("an empty form flags every required field (notes are optional)", () => {
    const errors = validate({}, BOOKING_FIELDS);
    expect(Object.keys(errors).sort()).toEqual(["addressLine", "city", "fullName", "phone", "pincode"]);
  });

  it("checkout also needs the state", () => {
    const { state: _s, ...noState } = fixture.valid;
    expect(validate(noState, ADDRESS_FIELDS)).toEqual({ state: MESSAGES.state });
  });

  it("only checks the fields it is asked to", () => {
    expect(validate({ addressLine: "x" }, ["pincode"])).toEqual({ pincode: MESSAGES.pincode });
  });
});

describe("messages match the server", () => {
  it("uses the same wording so people see the same text either way", async () => {
    // Read the server's messages without importing server code into the browser bundle.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(path.resolve(__dirname, "../../../server/src/lib/validation.ts"), "utf8");
    for (const [key, text] of Object.entries(MESSAGES)) {
      expect(src, `server message for ${key}`).toContain(`${key}: "${text}"`);
    }
  });
});
