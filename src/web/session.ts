import session from "express-session";
import { config } from "../config.js";

declare module "express-session" {
  interface SessionData {
    user?: {
      dn: string;
      uid?: string;
      displayName?: string;
    };
    csrfToken?: string;
  }
}

/**
 * Sesjonskonfigurasjon. Cookien er httpOnly + sameSite=strict, og settes
 * `secure` i produksjon (krever HTTPS). MemoryStore brukes i utvikling –
 * bytt til en delt store (Redis e.l.) før produksjon med flere instanser.
 */
export const sessionMiddleware = session({
  name: "feide.sid",
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: config.isProd,
    maxAge: config.SESSION_TTL_MINUTES * 60 * 1000,
  },
});
