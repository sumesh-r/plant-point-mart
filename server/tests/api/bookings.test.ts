import { beforeEach, describe, expect, it } from "vitest";
import { createService, createSlot, createUser, PNG, prisma, request, app, resetDb, signedIn } from "../helpers";
import { MESSAGES } from "../../src/lib/validation";

beforeEach(resetDb);

const details = { fullName: "Priya Raman", phone: "9876543210", addressLine: "12, Gandhi Nagar, near bus stand", city: "Coimbatore", pincode: "641046" };

async function setup() {
  const customer = await createUser();
  const agent = await signedIn(customer);
  const service = await createService();
  const slot = await createSlot({ hoursFromNow: 48 });
  return { customer, agent, service, slot };
}

/** Same multipart form the booking page sends. */
function book(agent: ReturnType<typeof request.agent>, body: Record<string, string | number>, images: Buffer[] = []) {
  let req = agent.post("/api/bookings");
  for (const [k, v] of Object.entries(body)) req = req.field(k, String(v));
  images.forEach((img, i) => (req = req.attach("images", img, { filename: `plant-${i}.png`, contentType: "image/png" })));
  return req;
}

describe("booking validation (the reported bug)", () => {
  it("a short address is rejected with a clear message on the right field, and the slot stays free", async () => {
    const { agent, service, slot } = await setup();
    const res = await book(agent, { serviceId: service.id, slotId: slot.id, ...details, addressLine: "test" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(MESSAGES.addressLine);
    expect(res.body.details.fields).toEqual({ addressLine: MESSAGES.addressLine });
    // Nothing was booked: the same slot can still be used once the address is fixed.
    expect((await prisma.serviceSlot.findUniqueOrThrow({ where: { id: slot.id } })).status).toBe("AVAILABLE");
    expect(await prisma.booking.count()).toBe(0);
  });

  it("after fixing the address, the same slot books fine", async () => {
    const { agent, service, slot } = await setup();
    await book(agent, { serviceId: service.id, slotId: slot.id, ...details, addressLine: "test" }).expect(400);

    const res = await book(agent, { serviceId: service.id, slotId: slot.id, ...details, addressLine: "test road, a long and complete address" });
    expect(res.status).toBe(201);
    expect(res.body.booking.slotId).toBe(slot.id);
  });

  it("reports every bad field at once", async () => {
    const { agent, service, slot } = await setup();
    const res = await book(agent, { serviceId: service.id, slotId: slot.id, fullName: "A", phone: "12", addressLine: "x", city: "C", pincode: "12" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details.fields).sort()).toEqual(["addressLine", "city", "fullName", "phone", "pincode"]);
  });

  it("rejects photos that aren't images and doesn't keep any files", async () => {
    const { agent, service, slot } = await setup();
    const res = await agent
      .post("/api/bookings")
      .field("serviceId", String(service.id))
      .field("slotId", String(slot.id))
      .field("fullName", details.fullName)
      .attach("images", Buffer.from("not an image"), { filename: "notes.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/JPG, PNG, WEBP or GIF/);
  });
});

describe("booking a slot", () => {
  it("books a free slot: booking is PENDING, slot becomes BOOKED, price is copied", async () => {
    const { agent, customer, service, slot } = await setup();
    const res = await book(agent, { serviceId: service.id, slotId: slot.id, ...details, notes: "10 plants" });

    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({ status: "PENDING", userId: customer.id, price: service.price, notes: "10 plants" });
    expect(res.body.booking.bookingNumber).toMatch(/^SRV-/);
    expect(res.body.booking.history).toHaveLength(1);
    expect((await prisma.serviceSlot.findUniqueOrThrow({ where: { id: slot.id } })).status).toBe("BOOKED");
  });

  it("keeps up to 4 plant photos", async () => {
    const { agent, service, slot } = await setup();
    const res = await book(agent, { serviceId: service.id, slotId: slot.id, ...details }, [PNG, PNG]);
    expect(res.status).toBe(201);
    expect(res.body.booking.images).toHaveLength(2);
    expect(res.body.booking.images[0]).toMatchObject({ uploadedBy: "CUSTOMER" });
  });

  it("the same slot can't be booked twice", async () => {
    const { agent, service, slot } = await setup();
    await book(agent, { serviceId: service.id, slotId: slot.id, ...details }).expect(201);

    const other = await signedIn(await createUser());
    const res = await book(other, { serviceId: service.id, slotId: slot.id, ...details });
    expect(res.status).toBe(409);
    expect(await prisma.booking.count()).toBe(1);
  });

  it("two people booking the same slot at the same moment: only one wins", async () => {
    const { service, slot } = await setup();
    const agents = await Promise.all([1, 2, 3, 4].map(async () => signedIn(await createUser())));
    const results = await Promise.all(agents.map((a) => book(a, { serviceId: service.id, slotId: slot.id, ...details })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409]);
    expect(await prisma.booking.count()).toBe(1);
  });

  it("rejects a slot in the past", async () => {
    const { agent, service } = await setup();
    const past = await createSlot({ hoursFromNow: -2 });
    expect((await book(agent, { serviceId: service.id, slotId: past.id, ...details })).status).toBe(409);
  });

  it("rejects a blocked slot", async () => {
    const { agent, service } = await setup();
    const blocked = await createSlot({ status: "BLOCKED" });
    expect((await book(agent, { serviceId: service.id, slotId: blocked.id, ...details })).status).toBe(409);
  });

  it("a slot opened only for another service can't be used", async () => {
    const { agent, service } = await setup();
    const other = await createService();
    const slotForOther = await createSlot({ serviceId: other.id });
    expect((await book(agent, { serviceId: service.id, slotId: slotForOther.id, ...details })).status).toBe(409);
    expect((await book(agent, { serviceId: other.id, slotId: slotForOther.id, ...details })).status).toBe(201);
  });

  it("a hidden service can't be booked", async () => {
    const { agent, slot } = await setup();
    const hidden = await createService({ isActive: false });
    expect((await book(agent, { serviceId: hidden.id, slotId: slot.id, ...details })).status).toBe(404);
  });

  it("guests must sign in first", async () => {
    const { service, slot } = await setup();
    const res = await book(request.agent(app), { serviceId: service.id, slotId: slot.id, ...details });
    expect(res.status).toBe(401);
  });
});

describe("free slots shown to customers", () => {
  it("lists only future, free slots for that service (or any service)", async () => {
    const service = await createService();
    const other = await createService();
    const free = await createSlot({ hoursFromNow: 24 });
    const mine = await createSlot({ hoursFromNow: 30, serviceId: service.id });
    await createSlot({ hoursFromNow: 26, serviceId: other.id });
    await createSlot({ hoursFromNow: 28, status: "BOOKED" });
    await createSlot({ hoursFromNow: 32, status: "BLOCKED" });
    await createSlot({ hoursFromNow: -5 });

    const from = new Date(Date.now() - 7 * 864e5).toISOString();
    const to = new Date(Date.now() + 7 * 864e5).toISOString();
    const res = await request(app).get(`/api/services/${service.slug}/slots`).query({ from, to });
    expect(res.status).toBe(200);
    expect(res.body.slots.map((s: { id: number }) => s.id)).toEqual([free.id, mine.id]);
  });
});

describe("my bookings", () => {
  it("customers only see their own", async () => {
    const { agent, service, slot } = await setup();
    const created = (await book(agent, { serviceId: service.id, slotId: slot.id, ...details })).body.booking;

    const stranger = await signedIn(await createUser());
    expect((await stranger.get("/api/bookings")).body.bookings).toHaveLength(0);
    expect((await stranger.get(`/api/bookings/${created.bookingNumber}`)).status).toBe(404);
    expect((await agent.get(`/api/bookings/${created.bookingNumber}`)).status).toBe(200);
  });

  it("cancelling frees the slot for others", async () => {
    const { agent, service, slot } = await setup();
    const created = (await book(agent, { serviceId: service.id, slotId: slot.id, ...details })).body.booking;

    const res = await agent.post(`/api/bookings/${created.bookingNumber}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe("CANCELLED");
    expect((await prisma.serviceSlot.findUniqueOrThrow({ where: { id: slot.id } })).status).toBe("AVAILABLE");

    const other = await signedIn(await createUser());
    expect((await book(other, { serviceId: service.id, slotId: slot.id, ...details })).status).toBe(201);
  });

  it("can't cancel once the visit is in progress or done", async () => {
    const { agent, service, slot } = await setup();
    const created = (await book(agent, { serviceId: service.id, slotId: slot.id, ...details })).body.booking;
    await prisma.booking.update({ where: { id: created.id }, data: { status: "IN_PROGRESS" } });
    expect((await agent.post(`/api/bookings/${created.bookingNumber}/cancel`)).status).toBe(400);
  });
});
