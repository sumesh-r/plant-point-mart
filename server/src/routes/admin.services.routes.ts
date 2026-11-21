import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/errors";
import { idParam, parse, slugify } from "../lib/utils";
import { BOOKING_STATUSES } from "../lib/constants";
import { fileUrl, removeUpload, upload } from "../middleware/upload";
import { bookingInclude } from "./booking.routes";

const router = Router();

/* ------------------------------ Services ------------------------------ */

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  shortDescription: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(5000),
  price: z.coerce.number().int().positive("Price must be greater than 0"),
  durationMinutes: z.coerce.number().int().min(15).max(600),
  isActive: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .default(true)
    .transform((v) => v === true || v === "true"),
});

async function uniqueServiceSlug(name: string, excludeId?: number) {
  const base = slugify(name) || "service";
  let slug = base;
  for (let i = 2; ; i++) {
    const clash = await prisma.service.findFirst({ where: { slug, ...(excludeId && { id: { not: excludeId } }) } });
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
}

router.get("/services", async (_req, res) => {
  const services = await prisma.service.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { bookings: true } } },
  });
  res.json({ services });
});

router.post("/services", upload.single("image"), async (req, res) => {
  try {
    const data = parse(serviceSchema, req.body);
    const service = await prisma.service.create({
      data: { ...data, slug: await uniqueServiceSlug(data.name), image: req.file ? fileUrl(req.file.filename) : null },
    });
    res.status(201).json({ service });
  } catch (e) {
    if (req.file) removeUpload(fileUrl(req.file.filename));
    throw e;
  }
});

router.patch("/services/:id", upload.single("image"), async (req, res) => {
  try {
    const id = parse(idParam, req.params.id);
    const data = parse(serviceSchema, req.body);
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) throw notFound("Service not found");
    const service = await prisma.service.update({
      where: { id },
      data: { ...data, slug: await uniqueServiceSlug(data.name, id), ...(req.file && { image: fileUrl(req.file.filename) }) },
    });
    if (req.file) removeUpload(existing.image);
    res.json({ service });
  } catch (e) {
    if (req.file) removeUpload(fileUrl(req.file.filename));
    throw e;
  }
});

router.delete("/services/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const bookings = await prisma.booking.count({ where: { serviceId: id } });
  if (bookings > 0) {
    throw badRequest("This service has bookings. Hide it instead (turn off 'Visible to customers').");
  }
  const service = await prisma.service.delete({ where: { id } });
  removeUpload(service.image);
  res.json({ ok: true });
});

/* -------------------------------- Slots ------------------------------- */

router.get("/slots", async (req, res) => {
  const { from, to } = parse(z.object({ from: z.coerce.date(), to: z.coerce.date() }), req.query);
  const slots = await prisma.serviceSlot.findMany({
    where: { startsAt: { gte: from, lt: to } },
    orderBy: { startsAt: "asc" },
    include: {
      service: { select: { id: true, name: true } },
      bookings: {
        where: { status: { not: "CANCELLED" } },
        select: { id: true, bookingNumber: true, status: true, fullName: true, service: { select: { name: true } } },
      },
    },
  });
  res.json({ slots });
});

const createSlotsSchema = z.object({
  serviceId: z.number().int().positive().nullable().default(null),
  slots: z
    .array(z.object({ startsAt: z.coerce.date(), endsAt: z.coerce.date() }))
    .min(1, "Add at least one slot")
    .max(500, "Too many slots at once (max 500)"),
});

/**
 * Create free slots. The admin UI builds the exact start/end times in the
 * browser's timezone (single slot or a repeating pattern) and sends them here.
 * Slots that already exist at the same start time are skipped.
 */
router.post("/slots", async (req, res) => {
  const { serviceId, slots } = parse(createSlotsSchema, req.body);
  const now = new Date();
  for (const s of slots) {
    if (s.endsAt <= s.startsAt) throw badRequest("Slot end time must be after the start time");
    if (s.startsAt <= now) throw badRequest("Slots must be in the future");
  }
  if (serviceId && !(await prisma.service.findUnique({ where: { id: serviceId } }))) {
    throw notFound("Service not found");
  }
  const existing = await prisma.serviceSlot.findMany({
    where: { serviceId, startsAt: { in: slots.map((s) => s.startsAt) } },
    select: { startsAt: true },
  });
  const taken = new Set(existing.map((e) => e.startsAt.getTime()));
  const fresh = slots.filter((s) => !taken.has(s.startsAt.getTime()));
  if (fresh.length) {
    await prisma.serviceSlot.createMany({ data: fresh.map((s) => ({ ...s, serviceId })) });
  }
  res.status(201).json({ created: fresh.length, skipped: slots.length - fresh.length });
});

router.patch("/slots/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { status } = parse(z.object({ status: z.enum(["AVAILABLE", "BLOCKED"]) }), req.body);
  const slot = await prisma.serviceSlot.findUnique({ where: { id } });
  if (!slot) throw notFound("Slot not found");
  if (slot.status === "BOOKED") throw conflict("This slot is booked. Cancel the booking first.");
  res.json({ slot: await prisma.serviceSlot.update({ where: { id }, data: { status } }) });
});

router.delete("/slots/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const slot = await prisma.serviceSlot.findUnique({ where: { id }, include: { _count: { select: { bookings: true } } } });
  if (!slot) throw notFound("Slot not found");
  if (slot.status === "BOOKED") throw conflict("This slot is booked. Cancel the booking first.");
  if (slot._count.bookings > 0) {
    // Keep history of cancelled bookings intact: block the slot instead of deleting it.
    await prisma.serviceSlot.update({ where: { id }, data: { status: "BLOCKED" } });
    return res.json({ ok: true, blocked: true });
  }
  await prisma.serviceSlot.delete({ where: { id } });
  res.json({ ok: true });
});

/** Remove all free (unbooked) slots in a range, e.g. clear a whole day. */
router.post("/slots/clear", async (req, res) => {
  const { from, to } = parse(z.object({ from: z.coerce.date(), to: z.coerce.date() }), req.body);
  const result = await prisma.serviceSlot.deleteMany({
    where: { startsAt: { gte: from, lt: to }, status: { in: ["AVAILABLE", "BLOCKED"] }, bookings: { none: {} } },
  });
  res.json({ deleted: result.count });
});

/* ------------------------------ Bookings ------------------------------ */

const adminBookingInclude = {
  ...bookingInclude,
  user: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.BookingInclude;

router.get("/bookings", async (req, res) => {
  const { status, q, serviceId } = parse(
    z.object({
      status: z.enum(BOOKING_STATUSES).optional(),
      q: z.string().optional(),
      serviceId: z.coerce.number().int().positive().optional(),
    }),
    req.query,
  );
  const where: Prisma.BookingWhereInput = {};
  if (status) where.status = status;
  if (serviceId) where.serviceId = serviceId;
  if (q) where.OR = [{ bookingNumber: { contains: q.toUpperCase() } }, { fullName: { contains: q } }, { phone: { contains: q } }];
  const bookings = await prisma.booking.findMany({
    where,
    include: adminBookingInclude,
    orderBy: { slot: { startsAt: "desc" } },
  });
  res.json({ bookings });
});

router.get("/bookings/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const booking = await prisma.booking.findUnique({ where: { id }, include: adminBookingInclude });
  if (!booking) throw notFound("Booking not found");
  res.json({ booking });
});

router.patch("/bookings/:id", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const data = parse(
    z.object({
      status: z.enum(BOOKING_STATUSES).optional(),
      note: z.string().trim().max(300).optional(),
      adminNotes: z.string().trim().max(2000).optional(),
    }),
    req.body,
  );
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw notFound("Booking not found");
  if (data.status && booking.status === "CANCELLED") throw conflict("A cancelled booking can't be changed");

  const statusChanged = data.status && data.status !== booking.status;
  const updated = await prisma.$transaction(async (tx) => {
    if (statusChanged && data.status === "CANCELLED") {
      // Free the slot again if it's still in the future
      await tx.serviceSlot.updateMany({
        where: { id: booking.slotId, status: "BOOKED", startsAt: { gt: new Date() } },
        data: { status: "AVAILABLE" },
      });
    }
    return tx.booking.update({
      where: { id },
      data: {
        ...(statusChanged && {
          status: data.status,
          history: { create: { status: data.status!, note: data.note || null } },
        }),
        ...(data.adminNotes !== undefined && { adminNotes: data.adminNotes || null }),
      },
      include: adminBookingInclude,
    });
  });
  res.json({ booking: updated });
});

router.post("/bookings/:id/images", upload.array("images", 8), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw badRequest("Choose at least one image");
  const caption = typeof req.body.caption === "string" ? req.body.caption.trim().slice(0, 200) || null : null;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    files.forEach((f) => removeUpload(fileUrl(f.filename)));
    throw notFound("Booking not found");
  }
  await prisma.bookingImage.createMany({
    data: files.map((f) => ({ bookingId: id, url: fileUrl(f.filename), uploadedBy: "ADMIN", caption })),
  });
  res.status(201).json({ booking: await prisma.booking.findUnique({ where: { id }, include: adminBookingInclude }) });
});

router.delete("/bookings/:id/images/:imageId", async (req, res) => {
  const id = parse(idParam, req.params.id);
  const imageId = parse(idParam, req.params.imageId);
  const image = await prisma.bookingImage.findFirst({ where: { id: imageId, bookingId: id } });
  if (!image) throw notFound("Image not found");
  await prisma.bookingImage.delete({ where: { id: imageId } });
  removeUpload(image.url);
  res.json({ booking: await prisma.booking.findUnique({ where: { id }, include: adminBookingInclude }) });
});

export default router;
