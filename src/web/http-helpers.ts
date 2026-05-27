import type { NextFunction, Request, Response } from "express";
import { AlreadyExistsError, NoSuchObjectError, ResultCodeError } from "ldapts";
import { ZodError } from "zod";
import { logger } from "../logger.js";

/** Pakker en async route-handler slik at feil sendes til feilhåndtereren. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

export function zodErrorResponse(res: Response, err: ZodError): void {
  res.status(400).json({
    error: "Valideringsfeil",
    fields: err.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  });
}

/** Sentral feilhåndterer: oversetter LDAP- og valideringsfeil til HTTP-status. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;

  if (err instanceof ZodError) {
    zodErrorResponse(res, err);
    return;
  }
  if (err instanceof AlreadyExistsError) {
    res.status(409).json({ error: "Oppføringen finnes allerede" });
    return;
  }
  if (err instanceof NoSuchObjectError) {
    res.status(404).json({ error: "Fant ikke oppføringen" });
    return;
  }
  if (err instanceof ResultCodeError) {
    logger.warn({ err: err.message }, "LDAP-feil");
    res.status(400).json({ error: `Katalogfeil: ${err.message}` });
    return;
  }
  logger.error({ err }, "uventet feil");
  res.status(500).json({ error: "Intern feil" });
}
