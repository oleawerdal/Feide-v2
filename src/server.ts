import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { sessionMiddleware } from "./web/session.js";
import { csrfProtection } from "./web/csrf.js";
import { authRouter, requireAuth } from "./web/auth.js";
import { personsRouter } from "./web/persons.routes.js";
import { groupsRouter } from "./web/groups.routes.js";
import { qualityRouter } from "./web/quality.routes.js";
import { referenceRouter } from "./web/reference.routes.js";
import { errorHandler } from "./web/http-helpers.js";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/healthz" },
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());
  app.use(sessionMiddleware);

  app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

  // CSRF-vern på alle API-kall (sikre metoder slipper gjennom).
  app.use("/api", csrfProtection);

  // Innlogging/CSRF krever ikke aktiv sesjon.
  app.use("/api/auth", authRouter);

  // Resten av API-et krever innlogget administrator.
  app.use("/api/reference", requireAuth, referenceRouter);
  app.use("/api/persons", requireAuth, personsRouter);
  app.use("/api/groups", requireAuth, groupsRouter);
  app.use("/api/quality", requireAuth, qualityRouter);

  app.use(express.static(publicDir));
  // SPA-fallback for ikke-API-ruter.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(publicDir, "index.html"));
  });

  app.use(errorHandler);
  return app;
}

function start(): void {
  const app = createApp();
  const useTls = Boolean(config.TLS_CERT_FILE && config.TLS_KEY_FILE);

  const server = useTls
    ? createHttpsServer(
        {
          cert: readFileSync(config.TLS_CERT_FILE!),
          key: readFileSync(config.TLS_KEY_FILE!),
        },
        app,
      )
    : createHttpServer(app);

  server.listen(config.PORT, () => {
    const scheme = useTls ? "https" : "http";
    logger.info(
      { port: config.PORT, tls: useTls, ldap: config.LDAP_URL },
      `Feide-katalogportal kjører på ${scheme}://localhost:${config.PORT}`,
    );
    if (!useTls && config.isProd) {
      logger.warn("Kjører UTEN web-TLS i produksjon – sett TLS_CERT_FILE/TLS_KEY_FILE eller terminer TLS i proxy");
    }
  });
}

// Start kun når filen kjøres direkte (ikke ved import i tester).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
