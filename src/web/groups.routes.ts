import { Router } from "express";
import { z } from "zod";
import { groupInputSchema, normalizeGroup } from "../domain/group.js";
import {
  createGroup,
  deleteGroup,
  getGroup,
  listGroups,
  setMembers,
  updateGroup,
} from "../ldap/group.repository.js";
import { asyncHandler, zodErrorResponse } from "./http-helpers.js";

export const groupsRouter: Router = Router();

groupsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const goType = typeof req.query.type === "string" ? req.query.type : undefined;
    res.json({ groups: await listGroups(goType) });
  }),
);

groupsRouter.get(
  "/:cn",
  asyncHandler(async (req, res) => {
    const group = await getGroup(req.params.cn!);
    if (!group) {
      res.status(404).json({ error: "Fant ikke gruppe" });
      return;
    }
    res.json({ group });
  }),
);

groupsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = groupInputSchema.safeParse(req.body?.group);
    if (!parsed.success) {
      zodErrorResponse(res, parsed.error);
      return;
    }
    const group = normalizeGroup(parsed.data);
    await createGroup(group);
    res.status(201).json({ group });
  }),
);

groupsRouter.put(
  "/:cn",
  asyncHandler(async (req, res) => {
    const parsed = groupInputSchema.safeParse(req.body?.group);
    if (!parsed.success) {
      zodErrorResponse(res, parsed.error);
      return;
    }
    const group = normalizeGroup(parsed.data);
    await updateGroup(req.params.cn!, group);
    res.json({ group });
  }),
);

const membersSchema = z.object({ members: z.array(z.string().trim().min(1)) });

groupsRouter.put(
  "/:cn/members",
  asyncHandler(async (req, res) => {
    const parsed = membersSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Ugyldig medlemsliste" });
      return;
    }
    await setMembers(req.params.cn!, parsed.data.members);
    res.json({ ok: true });
  }),
);

groupsRouter.delete(
  "/:cn",
  asyncHandler(async (req, res) => {
    await deleteGroup(req.params.cn!);
    res.json({ ok: true });
  }),
);
