import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/errors";
import { idParam, parse, slugify } from "../lib/utils";
import { ORDER_STATUSES } from "../lib/constants";
import { fileUrl, removeUpload, upload } from "../middleware/upload";
import { productInclude } from "./catalog.routes";
import { orderInclude } from "./order.routes";

const router = Router();

/* ----------------------------- Dashboard ----------------------------- */

router.get("/stats", async (_req, res) => {
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [
    productCount,
    customerCount,
    orderCount,
    pendingOrders,
    revenue,
    bookingCount,
    pendingBookings,
    freeSlotsThisWeek,
    lowStock,
    recentOrders,
    upcomingBookings,
  ] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: ["PLACED", "CONFIRMED"] } } }),
    prisma.order.aggregate({ _sum: { total: true }, where: { status: "DELIVERED" } }),
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.serviceSlot.count({ where: { status: "AVAILABLE", startsAt: { gte: now, lt: weekAhead } } }),
    prisma.product.findMany({
      where: { isActive: true, stock: { lt: 5 } },
      orderBy: { stock: "asc" },
      take: 6,
      include: { images: { take: 1, orderBy: { sortOrder: "asc" } } },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { name: true } }, _count: { select: { items: true } } },
    }),
    prisma.booking.findMany({
      where: { status: { in: ["PENDING", "CONFIRMED"] }, slot: { startsAt: { gte: now } } },
      orderBy: { slot: { startsAt: "asc" } },
      take: 6,
      include: { service: { select: { name: true } }, slot: true },
    }),
  ]);
  res.json({
    productCount,
    customerCount,
    orderCount,
    pendingOrders,
    revenue: revenue._sum.total ?? 0,
    bookingCount,
    pendingBookings,
    freeSlotsThisWeek,
    lowStock,
    recentOrders,
    upcomingBookings,
  });
});

/* ----------------------------- Categories ----------------------------- */

const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
});

router.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { products: true } } },
  });
  res.json({ categories });
});

router.post("/categories", upload.single("image"), async (req, res) => {
  const data = parse(categorySchema, req.body);
  const category = await prisma.category.create({
    data: { ...data, slug: slugify(data.name), image: req.file ? fileUrl(req.file.filename) : null },
  });
  res.status(201).json({ category });
});

router.patch("/categories/:id", upload.single("image"), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const data = parse(categorySchema, req.body);
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw notFound("Category not found");
  const category = await prisma.category.update({
    where: { id },
    data: { ...data, slug: slugify(data.name), ...(req.file && { image: fileUrl(req.file.filename) }) },
  });
  if (req.file) removeUpload(existing.image);
  res.json({ category });
});

router.delete("/categories/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) throw badRequest(`Move or delete the ${count} plant(s) in this category first`);
  const category = await prisma.category.delete({ where: { id } });
  removeUpload(category.image);
  res.json({ ok: true });
});

/* ------------------------------ Products ------------------------------ */

const optionalText = z.string().trim().max(120).optional().transform((v) => v || null);

const productSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  description: z.string().trim().min(10, "Description should be at least 10 characters").max(5000),
  price: z.coerce.number().int().positive("Price must be greater than 0"),
  mrp: z.coerce.number().int().positive().optional().nullable(),
  stock: z.coerce.number().int().min(0),
  categoryId: z.coerce.number().int().positive("Pick a category"),
  careLevel: optionalText,
  light: optionalText,
  water: optionalText,
  isActive: z.boolean().default(true),
});

async function uniqueProductSlug(name: string, excludeId?: number) {
  const base = slugify(name) || "plant";
  let slug = base;
  for (let i = 2; ; i++) {
    const clash = await prisma.product.findFirst({ where: { slug, ...(excludeId && { id: { not: excludeId } }) } });
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
}

router.get("/products", async (req, res) => {
  const { q, category } = parse(z.object({ q: z.string().optional(), category: z.coerce.number().optional() }), req.query);
  const where: Prisma.ProductWhereInput = {};
  if (q) where.name = { contains: q };
  if (category) where.categoryId = category;
  const products = await prisma.product.findMany({ where, include: productInclude, orderBy: { createdAt: "desc" } });
  res.json({ products });
});

router.get("/products/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const product = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!product) throw notFound("Plant not found");
  res.json({ product });
});

router.post("/products", async (req, res) => {
  const data = parse(productSchema, req.body);
  const product = await prisma.product.create({
    data: { ...data, slug: await uniqueProductSlug(data.name) },
    include: productInclude,
  });
  res.status(201).json({ product });
});

router.patch("/products/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const data = parse(productSchema, req.body);
  const product = await prisma.product.update({
    where: { id },
    data: { ...data, slug: await uniqueProductSlug(data.name, id) },
    include: productInclude,
  });
  res.json({ product });
});

router.delete("/products/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const product = await prisma.product.delete({ where: { id }, include: { images: true } });
  product.images.forEach((img) => removeUpload(img.url));
  res.json({ ok: true });
});

router.post("/products/:id/images", upload.array("images", 8), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw badRequest("Choose at least one image");
  const product = await prisma.product.findUnique({ where: { id }, include: { images: true } });
  if (!product) {
    files.forEach((f) => removeUpload(fileUrl(f.filename)));
    throw notFound("Plant not found");
  }
  const start = product.images.reduce((m, i) => Math.max(m, i.sortOrder + 1), 0);
  await prisma.productImage.createMany({
    data: files.map((f, i) => ({ productId: id, url: fileUrl(f.filename), sortOrder: start + i })),
  });
  res.status(201).json({ product: await prisma.product.findUnique({ where: { id }, include: productInclude }) });
});

router.post("/products/:id/images/:imageId/primary", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const imageId = parse(idParam, req.params.imageId);
  const images = await prisma.productImage.findMany({ where: { productId: id }, orderBy: { sortOrder: "asc" } });
  if (!images.some((i) => i.id === imageId)) throw notFound("Image not found");
  const ordered = [images.find((i) => i.id === imageId)!, ...images.filter((i) => i.id !== imageId)];
  await prisma.$transaction(ordered.map((img, idx) => prisma.productImage.update({ where: { id: img.id }, data: { sortOrder: idx } })));
  res.json({ product: await prisma.product.findUnique({ where: { id }, include: productInclude }) });
});

router.delete("/products/:id/images/:imageId", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const imageId = parse(idParam, req.params.imageId);
  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId: id } });
  if (!image) throw notFound("Image not found");
  await prisma.productImage.delete({ where: { id: imageId } });
  removeUpload(image.url);
  res.json({ product: await prisma.product.findUnique({ where: { id }, include: productInclude }) });
});

/* ------------------------------- Orders ------------------------------- */

router.get("/orders", async (req, res) => {
  const { status, q } = parse(z.object({ status: z.enum(ORDER_STATUSES).optional(), q: z.string().optional() }), req.query);
  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status;
  if (q) where.OR = [{ orderNumber: { contains: q.toUpperCase() } }, { fullName: { contains: q } }, { phone: { contains: q } }];
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { ...orderInclude, user: { select: { id: true, name: true, email: true } } },
  });
  res.json({ orders });
});

router.get("/orders/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const order = await prisma.order.findUnique({
    where: { id },
    include: { ...orderInclude, user: { select: { id: true, name: true, email: true, phone: true } } },
  });
  if (!order) throw notFound("Order not found");
  res.json({ order });
});

router.patch("/orders/:id/status", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { status, note } = parse(
    z.object({ status: z.enum(ORDER_STATUSES), note: z.string().trim().max(300).optional() }),
    req.body,
  );
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) throw notFound("Order not found");
  if (order.status === "CANCELLED") throw conflict("A cancelled order can't be changed");
  // Delivered means the cash was collected; reopening it would put stock back / undo the payment.
  if (order.status === "DELIVERED") throw conflict("A delivered order can't be changed");
  if (order.status === status) throw badRequest("Order already has this status");

  const updated = await prisma.$transaction(async (tx) => {
    if (status === "CANCELLED") {
      for (const item of order.items) {
        if (item.productId) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        }
      }
    }
    return tx.order.update({
      where: { id },
      data: {
        status,
        // Cash is collected on delivery
        ...(status === "DELIVERED" && { paymentStatus: "PAID" }),
        history: { create: { status, note: note || null } },
      },
      include: { ...orderInclude, user: { select: { id: true, name: true, email: true, phone: true } } },
    });
  });
  res.json({ order: updated });
});

/* ------------------------------ Customers ----------------------------- */

const customerAdminFields = { isBlocked: true, mustChangePassword: true } as const;

router.get("/customers", async (req, res) => {
  const { q } = parse(z.object({ q: z.string().optional() }), req.query);
  const where: Prisma.UserWhereInput = { role: "CUSTOMER" };
  if (q) where.OR = [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }];
  const customers = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      ...customerAdminFields,
      _count: { select: { orders: true, bookings: true } },
    },
  });
  res.json({ customers });
});

router.get("/customers/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const customer = await prisma.user.findFirst({
    where: { id, role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      ...customerAdminFields,
      orders: { orderBy: { createdAt: "desc" }, include: { _count: { select: { items: true } } } },
      bookings: { orderBy: { createdAt: "desc" }, include: { service: { select: { name: true } }, slot: true } },
    },
  });
  if (!customer) throw notFound("Customer not found");
  res.json({ customer });
});

async function findCustomer(id: number) {
  const customer = await prisma.user.findFirst({ where: { id, role: "CUSTOMER" } });
  if (!customer) throw notFound("Customer not found");
  return customer;
}

// Block or unblock. Blocking signs the customer out everywhere and stops them signing in.
router.patch("/customers/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { isBlocked } = parse(z.object({ isBlocked: z.boolean() }), req.body);
  await findCustomer(id);
  const customer = await prisma.user.update({
    where: { id },
    data: { isBlocked, ...(isBlocked ? { sessionVersion: { increment: 1 } } : {}) },
    select: { id: true, ...customerAdminFields },
  });
  res.json({ customer });
});

/** Easy to read out over the phone: no 0/O, 1/l/I. */
function temporaryPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string, n: number) => Array.from({ length: n }, () => set[randomInt(set.length)]).join("");
  return `${pick(letters, 4)}${pick(digits, 4)}`;
}

// For a customer who forgot their password: sets a temporary one that the admin shares with them.
// They're asked to choose their own password the next time they sign in.
router.post("/customers/:id/reset-password", async (req, res) => {
  const id = parse(idParam, req.params.id);
  await findCustomer(id);
  const password = temporaryPassword();
  await prisma.user.update({
    where: { id },
    data: { password: await bcrypt.hash(password, 10), mustChangePassword: true, sessionVersion: { increment: 1 } },
  });
  res.json({ temporaryPassword: password });
});

// Only accounts with no orders or bookings can be deleted, so sales and service history stay intact.
router.delete("/customers/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  await findCustomer(id);
  const [orders, bookings] = await Promise.all([prisma.order.count({ where: { userId: id } }), prisma.booking.count({ where: { userId: id } })]);
  if (orders || bookings) {
    throw conflict("This customer has orders or bookings, so their account can't be deleted. Block it instead.");
  }
  await prisma.user.delete({ where: { id } }); // cart items are removed with it
  res.json({ ok: true });
});

export default router;
