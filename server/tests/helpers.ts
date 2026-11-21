import bcrypt from "bcryptjs";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";

export { app, prisma, request };

/** Empty every table (children first so foreign keys don't complain). */
export async function resetDb() {
  await prisma.$transaction([
    prisma.bookingImage.deleteMany(),
    prisma.bookingStatusHistory.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.serviceSlot.deleteMany(),
    prisma.service.deleteMany(),
    prisma.orderStatusHistory.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

let seq = 0;
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export async function createUser(opts: { role?: "CUSTOMER" | "ADMIN"; email?: string; password?: string; name?: string } = {}) {
  const password = opts.password ?? "secret123";
  const user = await prisma.user.create({
    data: {
      name: opts.name ?? "Test User",
      email: opts.email ?? `user-${uid()}@example.com`,
      password: await bcrypt.hash(password, 4),
      role: opts.role ?? "CUSTOMER",
      phone: "9876543210",
    },
  });
  return { ...user, plainPassword: password };
}

/** A supertest agent that keeps the login cookie, like a browser. */
export async function signedIn(user: { email: string; plainPassword: string }) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email: user.email, password: user.plainPassword });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export async function createCategory(name = `Plants ${uid()}`) {
  return prisma.category.create({ data: { name, slug: `cat-${uid()}` } });
}

export async function createProduct(opts: { price?: number; stock?: number; isActive?: boolean; categoryId?: number; name?: string } = {}) {
  const categoryId = opts.categoryId ?? (await createCategory()).id;
  return prisma.product.create({
    data: {
      name: opts.name ?? `Plant ${uid()}`,
      slug: `plant-${uid()}`,
      description: "A lovely plant",
      price: opts.price ?? 200,
      stock: opts.stock ?? 10,
      isActive: opts.isActive ?? true,
      categoryId,
    },
  });
}

export async function createService(opts: { price?: number; isActive?: boolean } = {}) {
  return prisma.service.create({
    data: {
      name: `Care visit ${uid()}`,
      slug: `service-${uid()}`,
      shortDescription: "We look after your plants",
      description: "A gardener visits your home",
      price: opts.price ?? 399,
      durationMinutes: 60,
      isActive: opts.isActive ?? true,
    },
  });
}

const HOUR = 60 * 60 * 1000;

/** A slot starting `hoursFromNow` hours from now (negative = in the past). */
export async function createSlot(opts: { hoursFromNow?: number; serviceId?: number | null; status?: "AVAILABLE" | "BOOKED" | "BLOCKED" } = {}) {
  const startsAt = new Date(Date.now() + (opts.hoursFromNow ?? 48) * HOUR);
  return prisma.serviceSlot.create({
    data: { startsAt, endsAt: new Date(startsAt.getTime() + 2 * HOUR), serviceId: opts.serviceId ?? null, status: opts.status ?? "AVAILABLE" },
  });
}

export const validAddress = {
  fullName: "Priya Raman",
  phone: "9876543210",
  addressLine: "12, Gandhi Nagar, near bus stand",
  city: "Coimbatore",
  state: "Tamil Nadu",
  pincode: "641046",
};

/** A tiny valid PNG (1×1 pixel) for upload tests. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
