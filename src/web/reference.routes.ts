import { Router } from "express";
import { config } from "../config.js";
import { GO_GROUP_TYPES } from "../domain/group-types.js";
import { GREP_GRUNNSKOLE_SUBJECTS, GRUNNSKOLE_GRADES } from "../domain/grep.js";
import {
  AFFILIATION_LABELS,
  EDU_PERSON_AFFILIATIONS,
} from "../domain/affiliation.js";

/** Refdata som UI-et trenger: gruppetyper, fagkoder, trinn, tilknytninger. */
export const referenceRouter: Router = Router();

referenceRouter.get("/", (_req, res) => {
  res.json({
    realm: config.REALM,
    baseDn: config.LDAP_BASE_DN,
    peopleBaseDn: config.peopleBaseDn,
    groupsBaseDn: config.groupsBaseDn,
    affiliations: EDU_PERSON_AFFILIATIONS.map((a) => ({
      value: a,
      label: AFFILIATION_LABELS[a],
    })),
    groupTypes: GO_GROUP_TYPES,
    grepSubjects: GREP_GRUNNSKOLE_SUBJECTS,
    grades: GRUNNSKOLE_GRADES,
  });
});
