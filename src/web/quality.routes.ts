import { Router } from "express";
import { analyzeDirectory } from "../quality/data-quality.js";
import { listPersons } from "../ldap/person.repository.js";
import { listGroups } from "../ldap/group.repository.js";
import { asyncHandler } from "./http-helpers.js";

export const qualityRouter: Router = Router();

qualityRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [persons, groups] = await Promise.all([listPersons(), listGroups()]);
    res.json(analyzeDirectory(persons, groups));
  }),
);
