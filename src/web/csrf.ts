import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * CSRF-vern med synchronizer token bundet til sesjonen. Klienten henter
 * token fra GET /api/csrf og sender den tilbake i X-CSRF-Token-headeren på
 * alle tilstandsendrende kall. SameSite=strict-cookien gir et ekstra lag.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function ensureCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const expected = req.session.csrfToken;
  const provided = req.get("x-csrf-token") ?? "";
  if (!expected || !provided || !safeEqual(expected, provided)) {
    res.status(403).json({ error: "Ugyldig eller manglende CSRF-token" });
    return;
  }
  next();
}
