import bcrypt from "bcryptjs";
import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, forbidden, unauthorized } from "../lib/errors";
import { parse } from "../lib/utils";
import { AUTH_COOKIE, requireAuth, signToken } from "../middleware/auth";

const router = Router();

const publicUser = { id: true, name: true, email: true, phone: true, role: true, mustChangePassword: true, createdAt: true } as const;

/** Drops the fields the browser should never see. */
function toPublic<T extends { password: string; isBlocked: boolean; sessionVersion: number }>(user: T) {
  const { password: _pw, isBlocked: _b, sessionVersion: _sv, ...safe } = user;
  return safe;
}

function setAuthCookie(res: Response, user: { id: number; sessionVersion: number }) {
  res.cookie(AUTH_COOKIE, signToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

const phoneField = z
  .string()
  .trim()
  .regex(/^[0-9+\- ]{7,15}$/, "Enter a valid phone number")
  .optional()
  .or(z.literal(""));

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase()),
  phone: phoneField,
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

router.post("/register", async (req, res) => {
  const data = parse(registerSchema, req.body);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw conflict("An account with this email already exists");
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      password: await bcrypt.hash(data.password, 10),
    },
  });
  setAuthCookie(res, user);
  res.status(201).json({ user: toPublic(user) });
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

router.post("/login", async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw unauthorized("Incorrect email or password");
  }
  if (user.isBlocked) throw forbidden("This account has been blocked. Please contact Plant Point Mart for help.");
  setAuthCookie(res, user);
  res.json({ user: toPublic(user) });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE);
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: publicUser });
  if (!user) res.clearCookie(AUTH_COOKIE);
  res.json({ user });
});

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  phone: phoneField,
});

router.patch("/me", requireAuth, async (req, res) => {
  const data = parse(profileSchema, req.body);
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { name: data.name, phone: data.phone || null },
    select: publicUser,
  });
  res.json({ user });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters").max(100),
});

router.post("/me/password", requireAuth, async (req, res) => {
  const data = parse(passwordSchema, req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await bcrypt.compare(data.currentPassword, user.password))) {
    throw badRequest("Current password is incorrect");
  }
  if (data.currentPassword === data.newPassword) throw badRequest("Choose a new password that's different from the current one");
  // A new session version signs out every other device; this one gets a fresh cookie.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(data.newPassword, 10), mustChangePassword: false, sessionVersion: { increment: 1 } },
  });
  setAuthCookie(res, updated);
  res.json({ user: toPublic(updated) });
});

export default router;
