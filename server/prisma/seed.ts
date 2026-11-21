/**
 * Seed data for Plant Point Mart.
 *
 * Demo accounts (also listed in README):
 *   Admin:    admin@plantpointmart.com / admin123
 *   Customer: customer@example.com     / customer123
 *
 * Product/service images are generated SVG illustrations written to /uploads so
 * the demo works offline. Replace them with real photos from the admin panel.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const UPLOAD_DIR = path.resolve(__dirname, "../uploads");

type Art = "leafy" | "tall" | "succulent" | "cactus" | "flower" | "herb" | "pot" | "tool" | "soil" | "hanging";

const palettes = [
  { bg: "#EAF3E6", pot: "#C9734B", leaf: "#3F7D4E", leaf2: "#5FA36E" },
  { bg: "#F4EFE6", pot: "#E8E1D5", leaf: "#2F6B45", leaf2: "#7DB38A" },
  { bg: "#E7F0EF", pot: "#3E4C59", leaf: "#2E7D6B", leaf2: "#6CC0A5" },
  { bg: "#F6ECE9", pot: "#B85C4B", leaf: "#5A8F3E", leaf2: "#A3C76D" },
  { bg: "#EEF0E5", pot: "#D9C7A8", leaf: "#4C7A34", leaf2: "#8FBF6A" },
  { bg: "#F1EAF3", pot: "#7B6A8F", leaf: "#3D7350", leaf2: "#86B98F" },
];

function plantSvg(art: Art, p: (typeof palettes)[number], flower = "#E86A92"): string {
  const pot = `<path d="M150 300 h100 l-12 70 h-76 z" fill="${p.pot}"/><rect x="142" y="290" width="116" height="18" rx="5" fill="${p.pot}" opacity=".85"/>`;
  const shadow = `<ellipse cx="200" cy="375" rx="70" ry="9" fill="#000" opacity=".07"/>`;
  const leaf = (x: number, y: number, rot: number, s = 1, c = p.leaf) =>
    `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 0 C 20 -30, 60 -30, 80 0 C 60 30, 20 30, 0 0 Z" fill="${c}"/>`;
  let body = "";
  switch (art) {
    case "leafy":
      body = [leaf(200, 290, -110, 1.3), leaf(200, 285, -60, 1.2, p.leaf2), leaf(200, 285, -150, 1.1, p.leaf2), leaf(200, 290, -30, 1), leaf(200, 290, -180, 0.9), leaf(200, 260, -90, 1, p.leaf2)].join("");
      break;
    case "tall":
      body = `<rect x="196" y="120" width="8" height="175" fill="${p.leaf}"/>` + [0, 1, 2, 3, 4, 5].map((i) => leaf(200, 140 + i * 26, i % 2 ? -20 : -160, 0.8, i % 2 ? p.leaf2 : p.leaf)).join("");
      break;
    case "succulent":
      body = [0, 40, 80, 120, 160, 200, 240, 280, 320].map((r, i) => leaf(200, 275, r - 180 + 0, 0.55, i % 2 ? p.leaf2 : p.leaf)).join("") + `<circle cx="200" cy="275" r="14" fill="${p.leaf2}"/>`;
      break;
    case "cactus":
      body = `<rect x="178" y="150" width="44" height="150" rx="22" fill="${p.leaf}"/><rect x="132" y="200" width="30" height="70" rx="15" fill="${p.leaf2}"/><rect x="150" y="250" width="30" height="18" fill="${p.leaf2}"/><rect x="238" y="180" width="30" height="80" rx="15" fill="${p.leaf2}"/><rect x="220" y="235" width="30" height="18" fill="${p.leaf2}"/><circle cx="200" cy="150" r="9" fill="${flower}"/>`;
      break;
    case "flower":
      body = `<path d="M200 295 C 195 240, 205 200, 200 170" stroke="${p.leaf}" stroke-width="6" fill="none"/>` + leaf(200, 260, -30, 0.7) + leaf(200, 250, -150, 0.7, p.leaf2) + [0, 60, 120, 180, 240, 300].map((r) => `<ellipse cx="200" cy="145" rx="16" ry="30" transform="rotate(${r} 200 170)" fill="${flower}"/>`).join("") + `<circle cx="200" cy="170" r="14" fill="#F7C948"/>`;
      break;
    case "herb":
      body = [150, 175, 200, 225, 250].map((x, i) => `<path d="M${x} 295 C ${x} 250, ${x + (i - 2) * 10} 220, ${x + (i - 2) * 12} 190" stroke="${p.leaf}" stroke-width="4" fill="none"/>` + leaf(x + (i - 2) * 12, 190, -90 + (i - 2) * 15, 0.45, p.leaf2) + leaf(x + (i - 2) * 6, 240, i % 2 ? -30 : -150, 0.4)).join("");
      break;
    case "hanging":
      body = `<path d="M160 120 L200 60 L240 120" stroke="#8a7a66" stroke-width="3" fill="none"/><path d="M150 120 h100 l-12 55 h-76 z" fill="${p.pot}"/>` + [0, 1, 2, 3, 4].map((i) => leaf(165 + i * 18, 175 + (i % 2) * 30 + i * 18, 80 + (i - 2) * 12, 0.5, i % 2 ? p.leaf : p.leaf2)).join("");
      return wrap(p.bg, body);
    case "pot":
      return wrap(p.bg, `<path d="M130 200 h140 l-18 150 h-104 z" fill="${p.pot}"/><rect x="118" y="185" width="164" height="26" rx="6" fill="${p.pot}" opacity=".85"/><path d="M150 260 h100" stroke="#fff" stroke-width="4" opacity=".4"/>` + shadow);
    case "tool":
      return wrap(p.bg, `<rect x="190" y="90" width="20" height="170" rx="8" fill="#8B5E3C"/><path d="M165 255 h70 l-8 70 q-27 30 -54 0 z" fill="#9AA5B1"/><rect x="185" y="80" width="30" height="30" rx="6" fill="${p.leaf}"/>` + shadow);
    case "soil":
      return wrap(p.bg, `<path d="M125 140 h150 l10 220 h-170 z" fill="${p.pot}"/><rect x="140" y="200" width="120" height="80" rx="8" fill="#fff" opacity=".85"/>` + leaf(170, 245, -40, 0.5) + leaf(200, 245, -140, 0.5, p.leaf2) + `<path d="M125 140 q75 -30 150 0" fill="#5a3d2b"/>` + shadow);
  }
  return wrap(p.bg, body + pot + shadow);
}

function wrap(bg: string, inner: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${bg}"/><circle cx="320" cy="80" r="60" fill="#fff" opacity=".35"/><circle cx="70" cy="330" r="40" fill="#fff" opacity=".3"/>${inner}</svg>`;
}

function writeArt(name: string, art: Art, paletteIdx: number, flower?: string): string {
  const file = `seed-${name}.svg`;
  fs.writeFileSync(path.join(UPLOAD_DIR, file), plantSvg(art, palettes[paletteIdx % palettes.length], flower));
  return `/uploads/${file}`;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const categories = [
  { name: "Indoor Plants", description: "Easy-going greens that brighten up any room." },
  { name: "Outdoor Plants", description: "Hardy plants for balconies, terraces and gardens." },
  { name: "Flowering Plants", description: "Colourful blooms all year round." },
  { name: "Succulents & Cacti", description: "Low-water plants for busy plant parents." },
  { name: "Medicinal Plants", description: "Herbs and plants with traditional healing uses." },
  { name: "Garden Accessories", description: "Pots, tools, soil and everything in between." },
];

type SeedProduct = {
  name: string;
  cat: number;
  price: number;
  mrp?: number;
  stock: number;
  art: Art;
  care?: string;
  light?: string;
  water?: string;
  flower?: string;
  description: string;
};

const products: SeedProduct[] = [
  { name: "Money Plant (Golden Pothos)", cat: 0, price: 249, mrp: 349, stock: 40, art: "hanging", care: "Easy", light: "Low to bright indirect", water: "Once a week", description: "A classic trailing plant that thrives almost anywhere. Great for shelves and hanging baskets, and known for purifying indoor air." },
  { name: "Snake Plant (Sansevieria)", cat: 0, price: 399, mrp: 499, stock: 25, art: "tall", care: "Easy", light: "Low to bright indirect", water: "Every 2–3 weeks", description: "Upright, architectural leaves and near-indestructible. Tolerates low light and irregular watering — perfect for beginners." },
  { name: "Peace Lily", cat: 0, price: 449, stock: 18, art: "flower", flower: "#FFFFFF", care: "Easy", light: "Medium indirect", water: "Twice a week", description: "Glossy dark leaves with elegant white blooms. Droops slightly when thirsty, so it tells you when to water." },
  { name: "Areca Palm", cat: 0, price: 699, mrp: 899, stock: 12, art: "leafy", care: "Moderate", light: "Bright indirect", water: "Twice a week", description: "Feathery fronds that bring a tropical feel to living rooms. One of the best natural humidifiers." },
  { name: "ZZ Plant", cat: 0, price: 549, stock: 4, art: "tall", care: "Easy", light: "Low to medium", water: "Every 2 weeks", description: "Waxy, glossy leaves that look polished all year. Stores water in its rhizomes and forgives forgetful waterers." },
  { name: "Rubber Plant", cat: 0, price: 599, stock: 15, art: "leafy", care: "Moderate", light: "Bright indirect", water: "Once a week", description: "Large burgundy-green leaves and a bold upright habit. Wipe the leaves occasionally to keep them shiny." },
  { name: "Bougainvillea", cat: 1, price: 299, stock: 30, art: "flower", flower: "#D94F8C", care: "Easy", light: "Full sun", water: "Twice a week", description: "Bursts of magenta bracts that love the Indian sun. Ideal for compound walls, terraces and trellises." },
  { name: "Areca Bamboo (Outdoor)", cat: 1, price: 799, stock: 10, art: "tall", care: "Moderate", light: "Partial sun", water: "Every 2 days", description: "Tall, graceful bamboo-like stems for garden borders and privacy screens." },
  { name: "Curry Leaf Plant", cat: 1, price: 199, stock: 50, art: "herb", care: "Easy", light: "Full sun", water: "Every 2 days", description: "Fresh curry leaves from your own garden. Fast growing and essential for every Indian kitchen." },
  { name: "Ixora (Jungle Geranium)", cat: 1, price: 249, stock: 22, art: "flower", flower: "#E8453C", care: "Easy", light: "Full to partial sun", water: "Every 2 days", description: "Clusters of bright red flowers almost all year. A garden favourite that attracts butterflies." },
  { name: "Hibiscus", cat: 2, price: 279, mrp: 329, stock: 28, art: "flower", flower: "#E03B52", care: "Easy", light: "Full sun", water: "Daily in summer", description: "Large, showy red blooms that open every morning. Also used for temple offerings and hair oils." },
  { name: "Jasmine (Mogra)", cat: 2, price: 229, stock: 35, art: "flower", flower: "#FFFFFF", care: "Easy", light: "Full sun", water: "Every 2 days", description: "Intensely fragrant white flowers through the summer. Perfect for balconies and window grills." },
  { name: "Rose (Desi Red)", cat: 2, price: 199, stock: 40, art: "flower", flower: "#C81D3A", care: "Moderate", light: "Full sun", water: "Daily", description: "Classic red rose with a lovely scent. Feed regularly and prune after flowering for more blooms." },
  { name: "Anthurium", cat: 2, price: 649, stock: 3, art: "flower", flower: "#E2283E", care: "Moderate", light: "Bright indirect", water: "Twice a week", description: "Glossy heart-shaped red spathes that last for weeks. A stylish indoor flowering plant." },
  { name: "Aloe Vera", cat: 3, price: 179, stock: 60, art: "succulent", care: "Easy", light: "Bright light", water: "Every 2 weeks", description: "The everyday healing plant. Soothing gel for skin and hair, and almost no maintenance." },
  { name: "Jade Plant", cat: 3, price: 299, stock: 20, art: "succulent", care: "Easy", light: "Bright light", water: "Every 10 days", description: "Thick, coin-like leaves — considered a symbol of good luck and prosperity." },
  { name: "Golden Barrel Cactus", cat: 3, price: 349, stock: 14, art: "cactus", flower: "#F7C948", care: "Easy", light: "Full sun", water: "Every 3 weeks", description: "A round, golden-spined cactus that makes a striking desk or windowsill plant." },
  { name: "Echeveria Mix (Set of 3)", cat: 3, price: 449, mrp: 549, stock: 9, art: "succulent", care: "Easy", light: "Bright light", water: "Every 10 days", description: "Three rosette succulents in pastel shades. Lovely as a gift or a mini desk garden." },
  { name: "Tulsi (Holy Basil)", cat: 4, price: 149, stock: 70, art: "herb", care: "Easy", light: "Full sun", water: "Daily", description: "Sacred and medicinal. Tulsi leaves are used in teas and home remedies for cough and cold." },
  { name: "Neem Sapling", cat: 4, price: 199, stock: 25, art: "leafy", care: "Easy", light: "Full sun", water: "Twice a week", description: "The village pharmacy tree. Neem leaves are known for their antibacterial properties." },
  { name: "Mint (Pudina)", cat: 4, price: 99, stock: 80, art: "herb", care: "Easy", light: "Partial sun", water: "Daily", description: "Fast-spreading, fragrant mint for chutneys, juices and teas. Grows happily in a small pot." },
  { name: "Lemongrass", cat: 4, price: 129, stock: 45, art: "tall", care: "Easy", light: "Full sun", water: "Every 2 days", description: "Citrus-scented grass for refreshing tea. Also helps keep mosquitoes away." },
  { name: "Ceramic Pot – 8 inch", cat: 5, price: 349, stock: 40, art: "pot", care: undefined, description: "Glazed ceramic pot with a drainage hole and saucer. Suits medium indoor plants." },
  { name: "Gardening Tool Kit (3 pcs)", cat: 5, price: 399, mrp: 499, stock: 30, art: "tool", description: "Trowel, transplanter and cultivator with comfortable wooden handles." },
  { name: "Organic Potting Mix – 5 kg", cat: 5, price: 249, stock: 55, art: "soil", description: "Ready-to-use mix of cocopeat, compost and perlite. Great drainage for pots and grow bags." },
  { name: "Vermicompost – 2 kg", cat: 5, price: 149, stock: 65, art: "soil", description: "Nutrient-rich organic manure that improves soil health and plant growth." },
];

const services = [
  { name: "Home Plant Care Visit", short: "A gardener visits to water, clean, feed and check your plants.", price: 399, duration: 60, art: "leafy" as Art, description: "Our trained gardener visits your home to look after your indoor and balcony plants: watering, leaf cleaning, removing dead foliage, feeding with organic fertiliser, and a quick health check. Ideal for regular upkeep or while you're travelling." },
  { name: "Balcony Garden Setup", short: "Design and set up a beautiful balcony garden from scratch.", price: 1499, duration: 180, art: "flower" as Art, description: "We plan your balcony garden based on sunlight and space, bring the plants, pots and soil, and set everything up. Plants and materials are billed separately based on your choices." },
  { name: "Repotting Service", short: "Move your plants into fresh soil and bigger pots.", price: 249, duration: 60, art: "pot" as Art, description: "Root-bound plants grow slowly. We repot up to 5 plants with fresh potting mix and check the roots for rot. New pots can be bought from our store." },
  { name: "Pest & Disease Treatment", short: "Diagnose and treat pests, fungus and yellowing leaves.", price: 499, duration: 60, art: "herb" as Art, description: "Upload photos of the affected plants when booking. Our expert identifies the problem and treats it with safe, organic solutions, and leaves you a short care plan." },
  { name: "Pruning & Trimming", short: "Shape hedges, shrubs and overgrown plants.", price: 349, duration: 90, art: "tool" as Art, description: "Professional pruning to keep plants healthy and tidy: hedges, flowering shrubs, creepers and small trees. Garden waste is cleared after the job." },
  { name: "Lawn Maintenance", short: "Mowing, edging and lawn feeding for your garden.", price: 699, duration: 120, art: "tall" as Art, description: "Mowing, edging, weeding and fertilising for lawns up to 1000 sq ft. Larger lawns can be quoted after the first visit." },
];

async function main() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  for (const f of fs.readdirSync(UPLOAD_DIR)) if (f.startsWith("seed-")) fs.unlinkSync(path.join(UPLOAD_DIR, f));

  // Clean tables (children first)
  await prisma.bookingStatusHistory.deleteMany();
  await prisma.bookingImage.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.serviceSlot.deleteMany();
  await prisma.service.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: { name: "Admin", email: "admin@plantpointmart.com", password: await bcrypt.hash("admin123", 10), role: "ADMIN", phone: "9876543210" },
  });
  const customer = await prisma.user.create({
    data: { name: "Demo Customer", email: "customer@example.com", password: await bcrypt.hash("customer123", 10), phone: "9123456780" },
  });

  const catArt: Art[] = ["leafy", "flower", "flower", "succulent", "herb", "pot"];
  const cats = [];
  for (const [i, c] of categories.entries()) {
    cats.push(
      await prisma.category.create({
        data: { ...c, slug: slugify(c.name), image: writeArt(`cat-${slugify(c.name)}`, catArt[i], i) },
      }),
    );
  }

  for (const [i, p] of products.entries()) {
    const slug = slugify(p.name);
    await prisma.product.create({
      data: {
        name: p.name,
        slug,
        description: p.description,
        price: p.price,
        mrp: p.mrp ?? null,
        stock: p.stock,
        careLevel: p.care ?? null,
        light: p.light ?? null,
        water: p.water ?? null,
        categoryId: cats[p.cat].id,
        // Earlier entries (plants) are "newest", accessories last
        createdAt: new Date(Date.now() - i * 3600_000),
        images: {
          create: [
            { url: writeArt(slug, p.art, i, p.flower), sortOrder: 0 },
            { url: writeArt(`${slug}-2`, p.art, i + 2, p.flower), sortOrder: 1 },
          ],
        },
      },
    });
  }

  for (const [i, s] of services.entries()) {
    const slug = slugify(s.name);
    await prisma.service.create({
      data: {
        name: s.name,
        slug,
        shortDescription: s.short,
        description: s.description,
        price: s.price,
        durationMinutes: s.duration,
        image: writeArt(`service-${slug}`, s.art, i + 1),
      },
    });
  }

  // General free slots for the next 21 days: Mon–Sat, 9am, 11am, 2pm, 4pm (2 hours each)
  const slots: { startsAt: Date; endsAt: Date }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let d = 1; d <= 21; d++) {
    const day = new Date(today);
    day.setDate(today.getDate() + d);
    if (day.getDay() === 0) continue; // Sunday off
    for (const hour of [9, 11, 14, 16]) {
      const startsAt = new Date(day);
      startsAt.setHours(hour);
      slots.push({ startsAt, endsAt: new Date(startsAt.getTime() + 2 * 3600_000) });
    }
  }
  await prisma.serviceSlot.createMany({ data: slots });

  // One sample booking + order for the demo customer
  const firstSlot = await prisma.serviceSlot.findFirstOrThrow({ orderBy: { startsAt: "asc" } });
  const careVisit = await prisma.service.findFirstOrThrow({ where: { slug: "home-plant-care-visit" } });
  await prisma.serviceSlot.update({ where: { id: firstSlot.id }, data: { status: "BOOKED" } });
  await prisma.booking.create({
    data: {
      bookingNumber: "SRV-DEMO01",
      userId: customer.id,
      serviceId: careVisit.id,
      slotId: firstSlot.id,
      price: careVisit.price,
      status: "CONFIRMED",
      fullName: "Demo Customer",
      phone: "9123456780",
      addressLine: "12, Gandhi Nagar, Near Bus Stand",
      city: "Coimbatore",
      pincode: "641046",
      notes: "Around 10 indoor plants, some leaves turning yellow.",
      history: { create: [{ status: "PENDING", note: "Booking requested" }, { status: "CONFIRMED", note: "Gardener assigned" }] },
    },
  });

  const moneyPlant = await prisma.product.findFirstOrThrow({ where: { slug: "money-plant-golden-pothos" }, include: { images: true } });
  const aloe = await prisma.product.findFirstOrThrow({ where: { slug: "aloe-vera" }, include: { images: true } });
  await prisma.order.create({
    data: {
      orderNumber: "PPM-DEMO01",
      userId: customer.id,
      status: "SHIPPED",
      subtotal: moneyPlant.price + aloe.price * 2,
      shippingFee: 0,
      total: moneyPlant.price + aloe.price * 2,
      fullName: "Demo Customer",
      phone: "9123456780",
      addressLine: "12, Gandhi Nagar, Near Bus Stand",
      city: "Coimbatore",
      state: "Tamil Nadu",
      pincode: "641046",
      items: {
        create: [
          { productId: moneyPlant.id, name: moneyPlant.name, image: moneyPlant.images[0].url, price: moneyPlant.price, quantity: 1 },
          { productId: aloe.id, name: aloe.name, image: aloe.images[0].url, price: aloe.price, quantity: 2 },
        ],
      },
      history: {
        create: [
          { status: "PLACED", note: "Order placed (Cash on Delivery)" },
          { status: "CONFIRMED" },
          { status: "SHIPPED", note: "Handed to delivery partner" },
        ],
      },
    },
  });

  console.log(`Seeded ${cats.length} categories, ${products.length} products, ${services.length} services, ${slots.length} slots.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
