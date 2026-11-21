import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "../lib/constants";
import { forbidden, unauthorized } from "../lib/errors";
import { prisma } from "../lib/prisma";

export const AUTH_COOKIE = "ppm_token";

export interface AuthUser {
  id: number;
  role: Role;
}

interface TokenPayload {
  id: number;
  /** session version: tokens issued before a password reset or block stop working */
  sv: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: { id: number; sessionVersion: number }): string {
  const payload: TokenPayload = { id: user.id, sv: user.sessionVersion };
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

/**
 * Reads the token if present; never rejects. The account is checked on every request,
 * so blocking a user or resetting their password signs them out straight away.
 */
export async function loadUser(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return next();
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
  } catch {
    return next(); // expired / invalid token: treat as signed out
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, role: true, isBlocked: true, sessionVersion: true },
  });
  if (!user || user.isBlocked || user.sessionVersion !== (payload.sv ?? 0)) {
    res.clearCookie(AUTH_COOKIE);
    return next();
  }
  req.user = { id: user.id, role: user.role as Role };
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== "ADMIN") return next(forbidden());
  next();
}
