import { Router } from "express";
import { z } from "zod";
import { personInputSchema, normalizePerson } from "../domain/person.js";
import {
  createPerson,
  deletePerson,
  getPerson,
  listPersons,
  setPassword,
  updatePerson,
} from "../ldap/person.repository.js";
import { asyncHandler, zodErrorResponse } from "./http-helpers.js";

export const personsRouter: Router = Router();

personsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.q === "string" ? req.query.q : undefined;
    res.json({ persons: await listPersons(search) });
  }),
);

personsRouter.get(
  "/:uid",
  asyncHandler(async (req, res) => {
    const person = await getPerson(req.params.uid!);
    if (!person) {
      res.status(404).json({ error: "Fant ikke person" });
      return;
    }
    res.json({ person });
  }),
);

const createSchema = z.object({
  person: personInputSchema,
  password: z.string().min(8).max(1024).optional(),
});

personsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      zodErrorResponse(res, parsed.error);
      return;
    }
    const person = normalizePerson(parsed.data.person);
    await createPerson(person, parsed.data.password);
    res.status(201).json({ person });
  }),
);

personsRouter.put(
  "/:uid",
  asyncHandler(async (req, res) => {
    const parsed = personInputSchema.safeParse(req.body?.person);
    if (!parsed.success) {
      zodErrorResponse(res, parsed.error);
      return;
    }
    const person = normalizePerson(parsed.data);
    await updatePerson(req.params.uid!, person);
    res.json({ person });
  }),
);

const passwordSchema = z.object({ password: z.string().min(8).max(1024) });

personsRouter.put(
  "/:uid/password",
  asyncHandler(async (req, res) => {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Passord må være minst 8 tegn" });
      return;
    }
    await setPassword(req.params.uid!, parsed.data.password);
    res.json({ ok: true });
  }),
);

personsRouter.delete(
  "/:uid",
  asyncHandler(async (req, res) => {
    await deletePerson(req.params.uid!);
    res.json({ ok: true });
  }),
);
