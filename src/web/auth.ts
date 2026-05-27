import { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { findLoginUser, verifyPassword } from "../ldap/client.js";
import { logger } from "../logger.js";
import { ensureCsrfToken } from "./csrf.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session.user) {
    next();
    return;
  }
  res.status(401).json({ error: "Ikke innlogget" });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "For mange innloggingsforsøk. Prøv igjen senere." },
});

const loginSchema = z.object({
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(1024),
});

export const authRouter: Router = Router();

authRouter.get("/csrf", (req, res) => {
  res.json({ csrfToken: ensureCsrfToken(req) });
});

authRouter.get("/me", (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ error: "Ikke innlogget" });
    return;
  }
  res.json({ user: req.session.user });
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Brukernavn og passord er påkrevd" });
    return;
  }
  const { username, password } = parsed.data;

  try {
    const found = await findLoginUser(username);
    if (!found) {
      res.status(401).json({ error: "Feil brukernavn eller passord" });
      return;
    }
    const ok = await verifyPassword(found.dn, password);
    if (!ok) {
      res.status(401).json({ error: "Feil brukernavn eller passord" });
      return;
    }
    if (!found.isAdmin) {
      logger.warn({ uid: found.uid }, "innlogging avvist – ikke administrator");
      res.status(403).json({ error: "Du har ikke administratortilgang til portalen" });
      return;
    }

    // Forny sesjons-ID ved innlogging (mot session fixation).
    req.session.regenerate((err) => {
      if (err) {
        logger.error({ err }, "kunne ikke regenerere sesjon");
        res.status(500).json({ error: "Innlogging feilet" });
        return;
      }
      req.session.user = {
        dn: found.dn,
        uid: found.uid,
        displayName: found.displayName,
      };
      ensureCsrfToken(req);
      res.json({ user: req.session.user });
    });
  } catch (err) {
    logger.error({ err }, "feil under innlogging");
    res.status(502).json({ error: "Kunne ikke nå katalogtjeneren" });
  }
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) logger.error({ err }, "feil ved utlogging");
    res.clearCookie("feide.sid");
    res.json({ ok: true });
  });
});
