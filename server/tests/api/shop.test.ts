import { beforeEach, describe, expect, it } from "vitest";
import { app, createCategory, createProduct, createUser, prisma, request, resetDb, signedIn, validAddress } from "../helpers";
import { FREE_SHIPPING_ABOVE, SHIPPING_FEE } from "../../src/lib/constants";

beforeEach(resetDb);

describe("catalog (public, no sign-in)", () => {
  it("lists active plants only, with filters and search", async () => {
    const indoor = await createCategory("Indoor");
    const outdoor = await createCategory("Outdoor");
    await createProduct({ name: "Peace Lily", price: 449, categoryId: indoor.id });
    await createProduct({ name: "Snake Plant", price: 399, categoryId: indoor.id, stock: 0 });
    await createProduct({ name: "Hibiscus", price: 150, categoryId: outdoor.id });
    await createProduct({ name: "Hidden Fern", categoryId: indoor.id, isActive: false });

    const all = await request(app).get("/api/products");
    expect(all.status).toBe(200);
    expect(all.body.products.map((p: { name: string }) => p.name).sort()).toEqual(["Hibiscus", "Peace Lily", "Snake Plant"]);

    const byCat = await request(app).get("/api/products").query({ category: indoor.slug });
    expect(byCat.body.products).toHaveLength(2);

    const search = await request(app).get("/api/products").query({ q: "lily" });
    expect(search.body.products.map((p: { name: string }) => p.name)).toEqual(["Peace Lily"]);

    const cheap = await request(app).get("/api/products").query({ maxPrice: 200 });
    expect(cheap.body.products.map((p: { name: string }) => p.name)).toEqual(["Hibiscus"]);

    const inStock = await request(app).get("/api/products").query({ inStock: true });
    expect(inStock.body.products.map((p: { name: string }) => p.name)).not.toContain("Snake Plant");

    const priceAsc = await request(app).get("/api/products").query({ sort: "price_asc" });
    const prices = priceAsc.body.products.map((p: { price: number }) => p.price);
    expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b));
  });

  it("plant page by slug; hidden or unknown plants are 404", async () => {
    const p = await createProduct({ name: "Areca Palm" });
    const hidden = await createProduct({ isActive: false });
    expect((await request(app).get(`/api/products/${p.slug}`)).body.product.name).toBe("Areca Palm");
    expect((await request(app).get(`/api/products/${hidden.slug}`)).status).toBe(404);
    expect((await request(app).get("/api/products/does-not-exist")).status).toBe(404);
  });

  it("unknown API paths answer 404 JSON", async () => {
    const res = await request(app).get("/api/nothing-here");
    expect(res.status).toBe(404);
    expect(res.body.message).toBeDefined();
  });
});

describe("cart", () => {
  it("needs sign-in", async () => {
    expect((await request(app).get("/api/cart")).status).toBe(401);
    expect((await request(app).post("/api/cart").send({ productId: 1 })).status).toBe(401);
  });

  it("adds, merges, updates and removes items with correct totals", async () => {
    const agent = await signedIn(await createUser());
    const p = await createProduct({ price: 150, stock: 10 });

    let cart = (await agent.post("/api/cart").send({ productId: p.id, quantity: 1 })).body;
    cart = (await agent.post("/api/cart").send({ productId: p.id, quantity: 2 })).body;
    expect(cart.items).toHaveLength(1);
    expect(cart.count).toBe(3);
    expect(cart.subtotal).toBe(450);

    cart = (await agent.patch(`/api/cart/${p.id}`).send({ quantity: 5 })).body;
    expect(cart.count).toBe(5);

    cart = (await agent.delete(`/api/cart/${p.id}`)).body;
    expect(cart.count).toBe(0);
    expect(cart.shippingFee).toBe(0);
  });

  it(`charges ₹${SHIPPING_FEE} delivery below ₹${FREE_SHIPPING_ABOVE} and nothing at or above it`, async () => {
    const agent = await signedIn(await createUser());
    const cheap = await createProduct({ price: FREE_SHIPPING_ABOVE - 1, stock: 5 });
    let cart = (await agent.post("/api/cart").send({ productId: cheap.id })).body;
    expect(cart.shippingFee).toBe(SHIPPING_FEE);
    expect(cart.total).toBe(FREE_SHIPPING_ABOVE - 1 + SHIPPING_FEE);

    const one = await createProduct({ price: 1, stock: 5 });
    cart = (await agent.post("/api/cart").send({ productId: one.id })).body;
    expect(cart.subtotal).toBe(FREE_SHIPPING_ABOVE);
    expect(cart.shippingFee).toBe(0);
  });

  it("won't add more than is in stock", async () => {
    const agent = await signedIn(await createUser());
    const p = await createProduct({ stock: 2 });
    expect((await agent.post("/api/cart").send({ productId: p.id, quantity: 3 })).body.message).toMatch(/only 2 left/i);
    await agent.post("/api/cart").send({ productId: p.id, quantity: 2 }).expect(201);
    expect((await agent.post("/api/cart").send({ productId: p.id, quantity: 1 })).status).toBe(400);
    expect((await agent.patch(`/api/cart/${p.id}`).send({ quantity: 3 })).status).toBe(400);
  });

  it("rejects sold-out, hidden or unknown plants and silly quantities", async () => {
    const agent = await signedIn(await createUser());
    const soldOut = await createProduct({ stock: 0 });
    const hidden = await createProduct({ isActive: false });
    expect((await agent.post("/api/cart").send({ productId: soldOut.id })).body.message).toMatch(/out of stock/i);
    expect((await agent.post("/api/cart").send({ productId: hidden.id })).status).toBe(404);
    expect((await agent.post("/api/cart").send({ productId: 99999 })).status).toBe(404);
    const p = await createProduct();
    expect((await agent.post("/api/cart").send({ productId: p.id, quantity: 0 })).status).toBe(400);
    expect((await agent.post("/api/cart").send({ productId: p.id, quantity: 51 })).status).toBe(400);
  });
});

describe("orders (cash on delivery)", () => {
  async function cartWith(stock = 10, quantity = 2, price = 300) {
    const agent = await signedIn(await createUser());
    const product = await createProduct({ stock, price });
    await agent.post("/api/cart").send({ productId: product.id, quantity }).expect(201);
    return { agent, product };
  }

  it("places an order: COD, stock goes down, cart is emptied, prices are snapshotted", async () => {
    const { agent, product } = await cartWith(10, 2, 300);
    const res = await agent.post("/api/orders").send(validAddress);
    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({ status: "PLACED", paymentMethod: "COD", paymentStatus: "PENDING", subtotal: 600, shippingFee: 0, total: 600 });
    expect(res.body.order.items[0]).toMatchObject({ productId: product.id, price: 300, quantity: 2 });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(8);
    expect((await agent.get("/api/cart")).body.count).toBe(0);

    // A later price change doesn't touch the order.
    await prisma.product.update({ where: { id: product.id }, data: { price: 999 } });
    const order = (await agent.get(`/api/orders/${res.body.order.orderNumber}`)).body.order;
    expect(order.items[0].price).toBe(300);
  });

  it("checks the address field by field and doesn't place anything", async () => {
    const { agent, product } = await cartWith();
    const res = await agent.post("/api/orders").send({ ...validAddress, addressLine: "test", pincode: "123" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details.fields).sort()).toEqual(["addressLine", "pincode"]);
    expect(await prisma.order.count()).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(10);
  });

  it("won't place an empty cart", async () => {
    const agent = await signedIn(await createUser());
    expect((await agent.post("/api/orders").send(validAddress)).body.message).toMatch(/cart is empty/i);
  });

  it("if stock ran out meanwhile, nothing is ordered and nothing is deducted", async () => {
    const { agent, product } = await cartWith(5, 3);
    const other = await createProduct({ stock: 5 });
    await agent.post("/api/cart").send({ productId: other.id, quantity: 1 });
    await prisma.product.update({ where: { id: product.id }, data: { stock: 2 } }); // someone else bought some

    const res = await agent.post("/api/orders").send(validAddress);
    expect(res.status).toBe(409);
    expect(await prisma.order.count()).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: other.id } })).stock).toBe(5);
  });

  it("customers can cancel before shipping, which restores stock", async () => {
    const { agent, product } = await cartWith(10, 2);
    const order = (await agent.post("/api/orders").send(validAddress)).body.order;
    const res = await agent.post(`/api/orders/${order.orderNumber}/cancel`);
    expect(res.body.order.status).toBe("CANCELLED");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(10);
    expect((await agent.post(`/api/orders/${order.orderNumber}/cancel`)).status).toBe(400);
  });

  it("can't cancel once shipped", async () => {
    const { agent } = await cartWith();
    const order = (await agent.post("/api/orders").send(validAddress)).body.order;
    await prisma.order.update({ where: { id: order.id }, data: { status: "SHIPPED" } });
    expect((await agent.post(`/api/orders/${order.orderNumber}/cancel`)).status).toBe(400);
  });

  it("customers only see their own orders", async () => {
    const { agent } = await cartWith();
    const order = (await agent.post("/api/orders").send(validAddress)).body.order;
    const stranger = await signedIn(await createUser());
    expect((await stranger.get(`/api/orders/${order.orderNumber}`)).status).toBe(404);
    expect((await stranger.post(`/api/orders/${order.orderNumber}/cancel`)).status).toBe(404);
    expect((await stranger.get("/api/orders")).body.orders).toHaveLength(0);
  });
});
