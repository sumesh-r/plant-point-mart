import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import morgan from "morgan";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { HttpError } from "./lib/errors";
import { loadUser, requireAdmin, requireAuth } from "./middleware/auth";
import { UPLOAD_DIR } from "./middleware/upload";
import authRoutes from "./routes/auth.routes";
import catalogRoutes from "./routes/catalog.routes";
import cartRoutes from "./routes/cart.routes";
import orderRoutes from "./routes/order.routes";
import serviceRoutes from "./routes/service.routes";
import bookingRoutes from "./routes/booking.routes";
import adminShopRoutes from "./routes/admin.shop.routes";
import adminServiceRoutes from "./routes/admin.services.routes";

const app = express();

if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));
app.use(cors({ origin: process.env.CLIENT_URL ?? "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(loadUser);

app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

const api = express.Router();
api.get("/health", (_req, res) => res.json({ ok: true }));
api.use("/auth", authRoutes);
api.use("/", catalogRoutes); // public: /categories, /products
api.use("/services", serviceRoutes); // public
api.use("/cart", requireAuth, cartRoutes);
api.use("/orders", requireAuth, orderRoutes);
api.use("/bookings", requireAuth, bookingRoutes);
api.use("/admin", requireAdmin, adminShopRoutes, adminServiceRoutes);
app.use("/api", api);

app.use("/api", (_req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

// Production: serve the built website (client/dist) from the same server.
export const CLIENT_DIST = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(path.join(CLIENT_DIST, "index.html"))) {
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: "1h" }));
  // Any other GET is a page in the React app, so return index.html and let the router handle it.
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Each image must be under 5 MB" : err.message;
    return res.status(400).json({ message });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") return res.status(404).json({ message: "Not found" });
    if (err.code === "P2002") return res.status(409).json({ message: "That already exists" });
    if (err.code === "P2003") return res.status(409).json({ message: "This item is linked to other records" });
  }
  console.error(err);
  res.status(500).json({ message: "Something went wrong. Please try again." });
});

export default app;
