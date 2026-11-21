import { describe, expect, it, vi } from "vitest";
import { api, ApiError, errorMessage, qs, SESSION_ENDED } from "../../src/lib/api";

/** Resolves with the error a request failed with (and fails the test if it succeeded). */
const fails = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error("expected the request to fail");
    },
    (e: unknown) => e as ApiError,
  );

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("api client", () => {
  it("returns the JSON body on success and sends JSON with cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.post("/things", { a: 1 })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/things");
    expect(init).toMatchObject({ method: "POST", credentials: "include", body: '{"a":1}', headers: { "Content-Type": "application/json" } });
  });

  it("sends FormData as-is (no JSON header) for photo uploads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(201, {}));
    vi.stubGlobal("fetch", fetchMock);
    const fd = new FormData();
    fd.set("x", "1");
    await api.post("/bookings", fd);
    expect(fetchMock.mock.calls[0][1].body).toBe(fd);
    expect(fetchMock.mock.calls[0][1].headers).toBeUndefined();
  });

  it("keeps the server's field errors on ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(400, { message: "Enter the full address", details: { fields: { addressLine: "Enter the full address" } } })));
    const err = await fails(api.post("/bookings", {}));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe("Enter the full address");
    expect(err.fields).toEqual({ addressLine: "Enter the full address" });
  });

  it("errors without field details have an empty fields map", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(409, { message: "Sorry, that slot was just taken." })));
    const err = await fails(api.get("/x"));
    expect(err.fields).toEqual({});
  });

  it("explains when the server can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err = await fails(api.get("/x"));
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/can't reach the server/i);
  });

  it("a 401 outside /auth announces that the session ended", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(401, { message: "Please sign in" })));
    const heard = vi.fn();
    window.addEventListener(SESSION_ENDED, heard);
    await api.get("/cart").catch(() => {});
    await api.post("/auth/login", {}).catch(() => {}); // a wrong password is not "signed out"
    window.removeEventListener(SESSION_ENDED, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe("qs", () => {
  it("skips empty values and encodes the rest", () => {
    expect(qs({ q: "peace lily", page: 2, inStock: true, category: "", x: undefined, y: null })).toBe("?q=peace+lily&page=2&inStock=true");
    expect(qs({ a: "" })).toBe("");
  });
});

describe("errorMessage", () => {
  it("reads Error messages and has a fallback", () => {
    expect(errorMessage(new Error("Boom"))).toBe("Boom");
    expect(errorMessage("weird")).toBe("Something went wrong");
  });
});
