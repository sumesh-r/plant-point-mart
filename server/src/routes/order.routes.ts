import { Router } from "express";
import { prisma } from "../lib/prisma";
import { addressSchema } from "../lib/validation";
import { badRequest, conflict, notFound } from "../lib/errors";
import { makeReference, parse } from "../lib/utils";
import { getCart } from "./cart.routes";

const router = Router();

export const orderInclude = {
  items: true,
  history: { orderBy: { createdAt: "asc" as const } },
};

/** Place an order from the current cart. Payment is Cash on Delivery only. */
router.post("/", async (req, res) => {
  const address = parse(addressSchema, req.body);
  const userId = req.user!.id;
  const cart = await getCart(userId);
  if (cart.items.length === 0) throw badRequest("Your cart is empty");

  const order = await prisma.$transaction(async (tx) => {
    for (const item of cart.items) {
      // Atomic stock check-and-decrement: fails if someone else bought the last ones.
      const updated = await tx.product.updateMany({
        where: { id: item.productId, isActive: true, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (updated.count === 0) {
        throw conflict(`"${item.product.name}" doesn't have enough stock any more. Please update your cart.`);
      }
    }
    const created = await tx.order.create({
      data: {
        orderNumber: makeReference("PPM"),
        userId,
        paymentMethod: "COD",
        subtotal: cart.subtotal,
        shippingFee: cart.shippingFee,
        total: cart.total,
        ...address,
        items: {
          create: cart.items.map((i) => ({
            productId: i.productId,
            name: i.product.name,
            image: i.product.images[0]?.url ?? null,
            price: i.product.price,
            quantity: i.quantity,
          })),
        },
        history: { create: { status: "PLACED", note: "Order placed (Cash on Delivery)" } },
      },
      include: orderInclude,
    });
    await tx.cartItem.deleteMany({ where: { userId } });
    return created;
  });

  res.status(201).json({ order });
});

router.get("/", async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.id },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json({ orders });
});

router.get("/:orderNumber", async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { orderNumber: req.params.orderNumber, userId: req.user!.id },
    include: orderInclude,
  });
  if (!order) throw notFound("Order not found");
  res.json({ order });
});

/** Customers may cancel until the order has shipped. Stock is restored. */
router.post("/:orderNumber/cancel", async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { orderNumber: req.params.orderNumber, userId: req.user!.id },
    include: { items: true },
  });
  if (!order) throw notFound("Order not found");
  if (!["PLACED", "CONFIRMED"].includes(order.status)) {
    throw badRequest("This order can no longer be cancelled");
  }
  const updated = await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (item.productId) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
    }
    return tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", history: { create: { status: "CANCELLED", note: "Cancelled by customer" } } },
      include: orderInclude,
    });
  });
  res.json({ order: updated });
});

export default router;
