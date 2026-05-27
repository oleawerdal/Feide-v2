import { z } from "zod";
import { EDU_PERSON_AFFILIATIONS, isAffiliation } from "./affiliation.js";
import { isValidEduPpn, isValidRealm, isValidUid } from "./identifiers.js";
import { isValidFnr } from "./fnr.js";

/**
 * Persondatamodell for Feide info_go.
 *
 * Avbilder de Feide-relevante attributtene fra objektklassene
 * person / organizationalPerson / inetOrgPerson / eduPerson / norEduPerson.
 */
export interface FeidePerson {
  uid: string;
  eduPersonPrincipalName: string;
  givenName: string;
  sn: string;
  displayName: string;
  cn: string;
  mail: string;
  eduPersonAffiliation: string[];
  eduPersonPrimaryAffiliation: string;
  schacHomeOrganization: string;
  norEduPersonNIN?: string;
  mobile?: string;
  telephoneNumber?: string;
  eduPersonOrgDN?: string;
  eduPersonOrgUnitDN?: string;
  /** Distinguished name i katalogen (settes ved lesing). */
  dn?: string;
}

const trimmed = (max: number) =>
  z.string().trim().min(1, "Påkrevd").max(max);

const mailSchema = z
  .string()
  .trim()
  .max(254)
  .email("Ugyldig e-postadresse");

/**
 * Inndata for opprettelse/endring av person. Validerer Feide-reglene.
 */
export const personInputSchema = z
  .object({
    uid: z
      .string()
      .trim()
      .min(1, "Brukernavn er påkrevd")
      .max(64)
      .refine(isValidUid, "Ugyldig brukernavn (uid)"),
    eduPersonPrincipalName: z
      .string()
      .trim()
      .max(255)
      .refine(isValidEduPpn, "eduPPN må ha formen brukernavn@realm"),
    givenName: trimmed(128),
    sn: trimmed(128),
    displayName: trimmed(256),
    cn: trimmed(256).optional(),
    mail: mailSchema,
    eduPersonAffiliation: z
      .array(z.string().trim())
      .min(1, "Minst én tilknytning er påkrevd")
      .refine(
        (arr) => arr.every(isAffiliation),
        `Tilknytning må være en av: ${EDU_PERSON_AFFILIATIONS.join(", ")}`,
      ),
    eduPersonPrimaryAffiliation: z
      .string()
      .trim()
      .refine(isAffiliation, "Ugyldig primær tilknytning"),
    schacHomeOrganization: z
      .string()
      .trim()
      .refine(isValidRealm, "Ugyldig realm (schacHomeOrganization)"),
    norEduPersonNIN: z
      .string()
      .trim()
      .optional()
      .refine(
        (v) => v === undefined || v === "" || isValidFnr(v),
        "Ugyldig fødselsnummer/D-nummer (mod11)",
      ),
    mobile: z.string().trim().max(32).optional(),
    telephoneNumber: z.string().trim().max(32).optional(),
    eduPersonOrgDN: z.string().trim().optional(),
    eduPersonOrgUnitDN: z.string().trim().optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.eduPersonAffiliation.includes(val.eduPersonPrimaryAffiliation)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eduPersonPrimaryAffiliation"],
        message:
          "Primær tilknytning må også finnes i listen over tilknytninger",
      });
    }
    const [, realm] = val.eduPersonPrincipalName.split("@");
    if (realm && realm.toLowerCase() !== val.schacHomeOrganization.toLowerCase()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["schacHomeOrganization"],
        message: "Realm i eduPPN og schacHomeOrganization må være lik",
      });
    }
  });

export type PersonInput = z.infer<typeof personInputSchema>;

/** Fyller ut avledede felter (cn) fra inndata. */
export function normalizePerson(input: PersonInput): FeidePerson {
  const cn = input.cn?.trim() || `${input.givenName} ${input.sn}`.trim();
  return {
    uid: input.uid,
    eduPersonPrincipalName: input.eduPersonPrincipalName.toLowerCase(),
    givenName: input.givenName,
    sn: input.sn,
    displayName: input.displayName,
    cn,
    mail: input.mail,
    eduPersonAffiliation: [...new Set(input.eduPersonAffiliation)],
    eduPersonPrimaryAffiliation: input.eduPersonPrimaryAffiliation,
    schacHomeOrganization: input.schacHomeOrganization.toLowerCase(),
    norEduPersonNIN:
      input.norEduPersonNIN && input.norEduPersonNIN !== ""
        ? input.norEduPersonNIN
        : undefined,
    mobile: input.mobile || undefined,
    telephoneNumber: input.telephoneNumber || undefined,
    eduPersonOrgDN: input.eduPersonOrgDN || undefined,
    eduPersonOrgUnitDN: input.eduPersonOrgUnitDN || undefined,
  };
}
