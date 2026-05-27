import pino from "pino";
import { config } from "./config.js";

export const logger = pino({
  level: config.isProd ? "info" : "debug",
  redact: {
    // Logg aldri passord eller fødselsnummer.
    paths: [
      "password",
      "*.password",
      "userPassword",
      "*.userPassword",
      "norEduPersonNIN",
      "*.norEduPersonNIN",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
});
