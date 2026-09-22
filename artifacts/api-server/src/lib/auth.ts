import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}
const SECRET_KEY: string = SECRET;

const TOKEN_TTL = "30d";

export function signToken(memberId: number): string {
  return jwt.sign({ memberId }, SECRET_KEY, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, SECRET_KEY) as { memberId?: number };
    return typeof payload.memberId === "number" ? payload.memberId : null;
  } catch {
    return null;
  }
}

export function signResetToken(memberId: number): string {
  return jwt.sign({ memberId, purpose: "reset" }, SECRET_KEY, { expiresIn: "30m" });
}

export function verifyResetToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, SECRET_KEY) as { memberId?: number; purpose?: string };
    if (payload.purpose !== "reset") return null;
    return typeof payload.memberId === "number" ? payload.memberId : null;
  } catch {
    return null;
  }
}

/**
 * Reads the `Authorization: Bearer <jwt>` header and, when valid, attaches the
 * decoded member id to `req.memberId`. Does not reject unauthenticated
 * requests — individual route handlers decide whether auth is required.
 */
export function attachMember(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    const memberId = verifyToken(token);
    if (memberId) {
      (req as Request & { memberId?: number }).memberId = memberId;
    }
  }
  next();
}
