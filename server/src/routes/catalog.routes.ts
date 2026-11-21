import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { notFound } from "../lib/errors";
import { parse } from "../lib/utils";

const router = Router();

export const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ProductInclude;

router.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  });
  res.json({
    categories: categories.map(({ _count, ...c }) => ({ ...c, productCount: _count.products })),
  });
});

const listSchema = z.object({
  q: z.string().trim().optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  inStock: z.enum(["true", "false"]).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "name"]).default("newest"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

router.get("/products", async (req, res) => {
  const f = parse(listSchema, req.query);
  const price: Prisma.IntFilter = {};
  if (f.minPrice !== undefined) price.gte = f.minPrice;
  if (f.maxPrice !== undefined) price.lte = f.maxPrice;

  const where: Prisma.ProductWhereInput = { isActive: true };
  if (f.category) where.category = { slug: f.category };
  if (f.q) {
    where.OR = [
      { name: { contains: f.q } },
      { description: { contains: f.q } },
      { category: { name: { contains: f.q } } },
    ];
  }
  if (Object.keys(price).length) where.price = price;
  if (f.inStock === "true") where.stock = { gt: 0 };

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    f.sort === "price_asc"
      ? { price: "asc" }
      : f.sort === "price_desc"
        ? { price: "desc" }
        : f.sort === "name"
          ? { name: "asc" }
          : { createdAt: "desc" };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      include: productInclude,
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
    }),
  ]);
  res.json({
    products,
    total,
    page: f.page,
    pageSize: f.pageSize,
    totalPages: Math.max(1, Math.ceil(total / f.pageSize)),
  });
});

router.get("/products/:slug", async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { slug: req.params.slug, isActive: true },
    include: productInclude,
  });
  if (!product) throw notFound("Plant not found");
  const related = await prisma.product.findMany({
    where: { categoryId: product.categoryId, isActive: true, id: { not: product.id } },
    include: productInclude,
    take: 4,
    orderBy: { createdAt: "desc" },
  });
  res.json({ product, related });
});

export default router;
