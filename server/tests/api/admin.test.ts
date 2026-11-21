import { beforeEach, describe, expect, it } from "vitest";
import { app, createProduct, createService, createSlot, createUser, PNG, prisma, request, resetDb, signedIn, validAddress } from "../helpers";

beforeEach(resetDb);

const asAdmin = async () => signedIn(await createUser({ role: "ADMIN" }));
const inHours = (h: number) => new Date(Date.now() + h * 3600e3).toISOString();

describe("admin access", () => {
  it("guests get 401 and customers get 403 on every admin area", async () => {
    const customer = await signedIn(await createUser());
    for (const path of ["/api/admin/stats", "/api/admin/orders", "/api/admin/customers", "/api/admin/bookings", "/api/admin/services"]) {
      expect((await request(app).get(path)).status, path).toBe(401);
      expect((await customer.get(path)).status, path).toBe(403);
    }
  });

  it("an admin demoted to customer loses access on the next request", async () => {
    const adminUser = await createUser({ role: "ADMIN" });
    const agent = await signedIn(adminUser);
    expect((await agent.get("/api/admin/stats")).status).toBe(200);
    await prisma.user.update({ where: { id: adminUser.id }, data: { role: "CUSTOMER" } });
    expect((await agent.get("/api/admin/stats")).status).toBe(403);
  });
});

describe("free slots", () => {
  it("creates slots, skips duplicates and lists them", async () => {
    const admin = await asAdmin();
    const slots = [{ startsAt: inHours(24), endsAt: inHours(26) }, { startsAt: inHours(27), endsAt: inHours(29) }];
    const first = await admin.post("/api/admin/slots").send({ slots });
    expect(first.body).toEqual({ created: 2, skipped: 0 });
    const again = await admin.post("/api/admin/slots").send({ slots });
    expect(again.body).toEqual({ created: 0, skipped: 2 });

    const list = await admin.get("/api/admin/slots").query({ from: inHours(0), to: inHours(48) });
    expect(list.body.slots).toHaveLength(2);
  });

  it("rejects past slots, end before start, empty lists and unknown services", async () => {
    const admin = await asAdmin();
    expect((await admin.post("/api/admin/slots").send({ slots: [{ startsAt: inHours(-3), endsAt: inHours(-1) }] })).status).toBe(400);
    expect((await admin.post("/api/admin/slots").send({ slots: [{ startsAt: inHours(5), endsAt: inHours(4) }] })).status).toBe(400);
    expect((await admin.post("/api/admin/slots").send({ slots: [] })).status).toBe(400);
    expect((await admin.post("/api/admin/slots").send({ serviceId: 9999, slots: [{ startsAt: inHours(5), endsAt: inHours(6) }] })).status).toBe(404);
  });

  it("block / unblock; booked slots can't be blocked or deleted", async () => {
    const admin = await asAdmin();
    const slot = await createSlot();
    expect((await admin.patch(`/api/admin/slots/${slot.id}`).send({ status: "BLOCKED" })).body.slot.status).toBe("BLOCKED");
    expect((await admin.patch(`/api/admin/slots/${slot.id}`).send({ status: "AVAILABLE" })).body.slot.status).toBe("AVAILABLE");

    const booked = await createSlot({ status: "BOOKED" });
    expect((await admin.patch(`/api/admin/slots/${booked.id}`).send({ status: "BLOCKED" })).status).toBe(409);
    expect((await admin.delete(`/api/admin/slots/${booked.id}`)).status).toBe(409);
  });

  it("clearing a day removes only free, never-booked slots", async () => {
    const admin = await asAdmin();
    await createSlot({ hoursFromNow: 24 });
    await createSlot({ hoursFromNow: 25, status: "BLOCKED" });
    const booked = await createSlot({ hoursFromNow: 26, status: "BOOKED" });
    const res = await admin.post("/api/admin/slots/clear").send({ from: inHours(0), to: inHours(48) });
    expect(res.body.deleted).toBe(2);
    expect(await prisma.serviceSlot.findUnique({ where: { id: booked.id } })).not.toBeNull();
  });
});

describe("booking status (service team)", () => {
  async function aBooking() {
    const customer = await signedIn(await createUser());
    const service = await createService();
    const slot = await createSlot();
    const res = await customer
      .post("/api/bookings")
      .field("serviceId", String(service.id))
      .field("slotId", String(slot.id))
      .field("fullName", "Priya Raman")
      .field("phone", "9876543210")
      .field("addressLine", "12, Gandhi Nagar, near bus stand")
      .field("city", "Coimbatore")
      .field("pincode", "641046");
    expect(res.status).toBe(201);
    return { booking: res.body.booking, slot, customer };
  }

  it("moves through the flow and records each step with its note", async () => {
    const admin = await asAdmin();
    const { booking, customer } = await aBooking();
    for (const status of ["CONFIRMED", "IN_PROGRESS", "COMPLETED"]) {
      const res = await admin.patch(`/api/admin/bookings/${booking.id}`).send({ status, note: `now ${status}` });
      expect(res.body.booking.status).toBe(status);
    }
    const seen = (await customer.get(`/api/bookings/${booking.bookingNumber}`)).body.booking;
    expect(seen.history.map((h: { status: string }) => h.status)).toEqual(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"]);
    expect(seen.history[1].note).toBe("now CONFIRMED");
  });

  it("saves a work report the customer can see", async () => {
    const admin = await asAdmin();
    const { booking, customer } = await aBooking();
    await admin.patch(`/api/admin/bookings/${booking.id}`).send({ adminNotes: "Repotted 4 plants" }).expect(200);
    expect((await customer.get(`/api/bookings/${booking.bookingNumber}`)).body.booking.adminNotes).toBe("Repotted 4 plants");
  });

  it("cancelling frees the slot; a cancelled booking can't be reopened", async () => {
    const admin = await asAdmin();
    const { booking, slot } = await aBooking();
    await admin.patch(`/api/admin/bookings/${booking.id}`).send({ status: "CANCELLED" }).expect(200);
    expect((await prisma.serviceSlot.findUniqueOrThrow({ where: { id: slot.id } })).status).toBe("AVAILABLE");
    expect((await admin.patch(`/api/admin/bookings/${booking.id}`).send({ status: "CONFIRMED" })).status).toBe(409);
  });

  it("uploads and deletes team photos", async () => {
    const admin = await asAdmin();
    const { booking } = await aBooking();
    const up = await admin.post(`/api/admin/bookings/${booking.id}/images`).field("caption", "After").attach("images", PNG, { filename: "after.png", contentType: "image/png" });
    expect(up.status).toBe(201);
    const img = up.body.booking.images.find((i: { uploadedBy: string }) => i.uploadedBy === "ADMIN");
    expect(img.caption).toBe("After");
    const del = await admin.delete(`/api/admin/bookings/${booking.id}/images/${img.id}`);
    expect(del.body.booking.images.find((i: { id: number }) => i.id === img.id)).toBeUndefined();
  });
});

describe("order status (admin)", () => {
  async function anOrder(stock = 10, qty = 2) {
    const customer = await signedIn(await createUser());
    const product = await createProduct({ stock, price: 300 });
    await customer.post("/api/cart").send({ productId: product.id, quantity: qty });
    const order = (await customer.post("/api/orders").send(validAddress)).body.order;
    return { order, product };
  }

  it("delivering marks the cash as collected", async () => {
    const admin = await asAdmin();
    const { order } = await anOrder();
    const res = await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: "DELIVERED" });
    expect(res.body.order).toMatchObject({ status: "DELIVERED", paymentStatus: "PAID" });
  });

  it("cancelling restores stock; cancelled orders can't change", async () => {
    const admin = await asAdmin();
    const { order, product } = await anOrder(10, 3);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(7);
    await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: "CANCELLED" }).expect(200);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(10);
    expect((await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: "PLACED" })).status).toBe(409);
  });

  it("a delivered order can't be cancelled or reopened (stock and payment stay correct)", async () => {
    const admin = await asAdmin();
    const { order, product } = await anOrder(10, 2);
    await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: "DELIVERED" }).expect(200);
    expect((await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: "CANCELLED" })).status).toBe(409);
    expect((await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: "SHIPPED" })).status).toBe(409);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(8);
  });

  it("setting the same status twice is rejected", async () => {
    const admin = await asAdmin();
    const { order } = await anOrder();
    expect((await admin.patch(`/api/admin/orders/${order.id}/status`).send({ status: "PLACED" })).status).toBe(400);
  });
});

describe("customers (admin)", () => {
  it("blocking signs the customer out and stops sign-in; unblocking restores it", async () => {
    const admin = await asAdmin();
    const user = await createUser({ email: "blockme@example.com", password: "pass123" });
    const session = await signedIn(user);

    await admin.patch(`/api/admin/customers/${user.id}`).send({ isBlocked: true }).expect(200);
    expect((await session.get("/api/cart")).status).toBe(401);
    const login = await request(app).post("/api/auth/login").send({ email: "blockme@example.com", password: "pass123" });
    expect(login.status).toBe(403);
    expect(login.body.message).toMatch(/blocked/i);

    await admin.patch(`/api/admin/customers/${user.id}`).send({ isBlocked: false }).expect(200);
    expect((await request(app).post("/api/auth/login").send({ email: "blockme@example.com", password: "pass123" })).status).toBe(200);
  });

  it("only customers without orders or bookings can be deleted", async () => {
    const admin = await asAdmin();
    const fresh = await createUser();
    expect((await admin.delete(`/api/admin/customers/${fresh.id}`)).status).toBe(200);

    const buyer = await createUser();
    const agent = await signedIn(buyer);
    const p = await createProduct();
    await agent.post("/api/cart").send({ productId: p.id });
    await agent.post("/api/orders").send(validAddress).expect(201);
    const res = await admin.delete(`/api/admin/customers/${buyer.id}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/block it instead/i);
  });

  it("admins can't be blocked, reset or deleted through the customers API", async () => {
    const admin = await asAdmin();
    const otherAdmin = await createUser({ role: "ADMIN" });
    expect((await admin.patch(`/api/admin/customers/${otherAdmin.id}`).send({ isBlocked: true })).status).toBe(404);
    expect((await admin.post(`/api/admin/customers/${otherAdmin.id}/reset-password`)).status).toBe(404);
    expect((await admin.delete(`/api/admin/customers/${otherAdmin.id}`)).status).toBe(404);
  });

  it("the customer list never includes password hashes", async () => {
    const admin = await asAdmin();
    await createUser();
    const res = await admin.get("/api/admin/customers");
    for (const c of res.body.customers) expect(c).not.toHaveProperty("password");
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/); // no bcrypt hash anywhere
  });
});
