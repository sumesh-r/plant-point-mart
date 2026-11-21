import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notFound } from "../lib/errors";
import { parse } from "../lib/utils";

const router = Router();

router.get("/", async (_req, res) => {
  const services = await prisma.service.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
  res.json({ services });
});

router.get("/:slug", async (req, res) => {
  const service = await prisma.service.findFirst({ where: { slug: req.params.slug, isActive: true } });
  if (!service) throw notFound("Service not found");
  res.json({ service });
});

const rangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

/**
 * Available slots for a service in [from, to). A slot with no service attached
 * is a general slot usable for any service.
 */
router.get("/:slug/slots", async (req, res) => {
  const { from, to } = parse(rangeSchema, req.query);
  const service = await prisma.service.findFirst({ where: { slug: req.params.slug, isActive: true } });
  if (!service) throw notFound("Service not found");
  const now = new Date();
  const slots = await prisma.serviceSlot.findMany({
    where: {
      status: "AVAILABLE",
      startsAt: { gte: from > now ? from : now, lt: to },
      OR: [{ serviceId: null }, { serviceId: service.id }],
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, endsAt: true },
  });
  res.json({ slots });
});

export default router;
