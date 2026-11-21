import { Router } from "express";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/errors";
import { makeReference, parse } from "../lib/utils";
import { bookingSchema } from "../lib/validation";
import { fileUrl, removeUpload, upload } from "../middleware/upload";

const router = Router();

export const bookingInclude = {
  service: true,
  slot: true,
  images: { orderBy: { createdAt: "asc" as const } },
  history: { orderBy: { createdAt: "asc" as const } },
};

/** Book a slot. Accepts multipart form data with optional `images` (photos of the plants). */
router.post("/", upload.array("images", 4), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  try {
    const data = parse(bookingSchema, req.body);
    const service = await prisma.service.findFirst({ where: { id: data.serviceId, isActive: true } });
    if (!service) throw notFound("Service not found");

    const booking = await prisma.$transaction(async (tx) => {
      // Claim the slot atomically: only succeeds if it is still free and in the future.
      const claimed = await tx.serviceSlot.updateMany({
        where: {
          id: data.slotId,
          status: "AVAILABLE",
          startsAt: { gt: new Date() },
          OR: [{ serviceId: null }, { serviceId: service.id }],
        },
        data: { status: "BOOKED" },
      });
      if (claimed.count === 0) {
        throw conflict("Sorry, that slot was just taken. Please pick another time.");
      }
      return tx.booking.create({
        data: {
          bookingNumber: makeReference("SRV"),
          userId: req.user!.id,
          serviceId: service.id,
          slotId: data.slotId,
          price: service.price,
          fullName: data.fullName,
          phone: data.phone,
          addressLine: data.addressLine,
          city: data.city,
          pincode: data.pincode,
          notes: data.notes || null,
          images: { create: files.map((f) => ({ url: fileUrl(f.filename), uploadedBy: "CUSTOMER" })) },
          history: { create: { status: "PENDING", note: "Booking requested" } },
        },
        include: bookingInclude,
      });
    });
    res.status(201).json({ booking });
  } catch (err) {
    files.forEach((f) => removeUpload(fileUrl(f.filename)));
    throw err;
  }
});

router.get("/", async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { userId: req.user!.id },
    include: bookingInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json({ bookings });
});

router.get("/:bookingNumber", async (req, res) => {
  const booking = await prisma.booking.findFirst({
    where: { bookingNumber: req.params.bookingNumber, userId: req.user!.id },
    include: bookingInclude,
  });
  if (!booking) throw notFound("Booking not found");
  res.json({ booking });
});

router.post("/:bookingNumber/cancel", async (req, res) => {
  const booking = await prisma.booking.findFirst({
    where: { bookingNumber: req.params.bookingNumber, userId: req.user!.id },
  });
  if (!booking) throw notFound("Booking not found");
  if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
    throw badRequest("This booking can no longer be cancelled");
  }
  const updated = await prisma.$transaction(async (tx) => {
    await tx.serviceSlot.updateMany({
      where: { id: booking.slotId, status: "BOOKED", startsAt: { gt: new Date() } },
      data: { status: "AVAILABLE" },
    });
    return tx.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", history: { create: { status: "CANCELLED", note: "Cancelled by customer" } } },
      include: bookingInclude,
    });
  });
  res.json({ booking: updated });
});

export default router;
