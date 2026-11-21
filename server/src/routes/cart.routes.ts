import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, notFound } from "../lib/errors";
import { idParam, parse } from "../lib/utils";
import { FREE_SHIPPING_ABOVE, SHIPPING_FEE } from "../lib/constants";
import { productInclude } from "./catalog.routes";

const router = Router();

export async function getCart(userId: number) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: { include: productInclude } },
    orderBy: { id: "asc" },
  });
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const shippingFee = items.length === 0 || subtotal >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE;
  return {
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    freeShippingAbove: FREE_SHIPPING_ABOVE,
  };
}

router.get("/", async (req, res) => {
  res.json(await getCart(req.user!.id));
});

const addSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(50).default(1),
});

router.post("/", async (req, res) => {
  const { productId, quantity } = parse(addSchema, req.body);
  const userId = req.user!.id;
  const product = await prisma.product.findFirst({ where: { id: productId, isActive: true } });
  if (!product) throw notFound("Plant not found");
  const existing = await prisma.cartItem.findUnique({ where: { userId_productId: { userId, productId } } });
  const newQty = (existing?.quantity ?? 0) + quantity;
  if (newQty > product.stock) {
    throw badRequest(product.stock === 0 ? "This plant is out of stock" : `Only ${product.stock} left in stock`);
  }
  await prisma.cartItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, quantity },
    update: { quantity: newQty },
  });
  res.status(201).json(await getCart(userId));
});

router.patch("/:productId", async (req, res) => {
  const productId = parse(idParam, req.params.productId);
  const { quantity } = parse(z.object({ quantity: z.number().int().min(1).max(50) }), req.body);
  const userId = req.user!.id;
  const item = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
    include: { product: true },
  });
  if (!item) throw notFound("Item is not in your cart");
  if (quantity > item.product.stock) throw badRequest(`Only ${item.product.stock} left in stock`);
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  res.json(await getCart(userId));
});

router.delete("/:productId", async (req, res) => {
  const productId = parse(idParam, req.params.productId);
  await prisma.cartItem.deleteMany({ where: { userId: req.user!.id, productId } });
  res.json(await getCart(req.user!.id));
});

router.delete("/", async (req, res) => {
  await prisma.cartItem.deleteMany({ where: { userId: req.user!.id } });
  res.json(await getCart(req.user!.id));
});

export default router;
