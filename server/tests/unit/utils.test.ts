import { describe, expect, it } from "vitest";
import { z } from "zod";
import { HttpError } from "../../src/lib/errors";
import { idParam, makeReference, parse, slugify } from "../../src/lib/utils";

describe("slugify", () => {
  it.each([
    ["Money Plant (Golden Pothos)", "money-plant-golden-pothos"],
    ["  Succulents & Cacti  ", "succulents-cacti"],
    ["ZZ Plant", "zz-plant"],
    ["---Already--slugged---", "already-slugged"],
    ["Tulsi / Holy Basil 2", "tulsi-holy-basil-2"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("makeReference", () => {
  it("uses the prefix and 6 easy-to-read characters", () => {
    for (let i = 0; i < 50; i++) {
      const ref = makeReference("SRV");
      expect(ref).toMatch(/^SRV-[A-HJ-NP-Z2-9]{6}$/); // no 0/O/1/I
    }
  });

  it("is practically unique", () => {
    const refs = new Set(Array.from({ length: 500 }, () => makeReference("PPM")));
    expect(refs.size).toBe(500);
  });
});

describe("parse", () => {
  const schema = z.object({ name: z.string().min(2, "Name is too short"), age: z.number().min(18, "Too young") });

  it("returns the parsed data when valid", () => {
    expect(parse(schema, { name: "Al", age: 20 })).toEqual({ name: "Al", age: 20 });
  });

  it("throws a 400 with the first problem as a plain message (no field names)", () => {
    try {
      parse(schema, { name: "A", age: 10 });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      const err = e as HttpError;
      expect(err.status).toBe(400);
      expect(err.message).toBe("Name is too short");
    }
  });

  it("lists every problem by field so the website can show each under its input", () => {
    try {
      parse(schema, { name: "A", age: 10 });
      expect.unreachable();
    } catch (e) {
      expect((e as HttpError).details).toEqual({ fields: { name: "Name is too short", age: "Too young" } });
    }
  });
});

describe("idParam", () => {
  it.each([["12", 12], ["1", 1]])("accepts %s", (v, n) => expect(idParam.parse(v)).toBe(n));
  it.each(["0", "-3", "abc", "1.5", ""])("rejects %s", (v) => expect(idParam.safeParse(v).success).toBe(false));
});
