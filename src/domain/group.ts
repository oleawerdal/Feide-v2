import { z } from "zod";
import {
  GO_GROUP_TYPE_VALUES,
  getGroupTypeDef,
} from "./group-types.js";
import { isValidGrunnskoleGrade } from "./grep.js";

/**
 * Gruppedatamodell for Feide info_go (objektklasse `gogroup`).
 * Dekker basisgrupper (klasser), undervisningsgrupper, trinn, skolegrupper
 * og andre grupper.
 */
export interface FeideGroup {
  cn: string;
  displayName: string;
  description?: string;
  goType: string;
  goGrep?: string;
  goGrade?: number;
  schacHomeOrganization: string;
  eduPersonOrgUnitDN?: string;
  /** Skoleår, f.eks. "2025/2026". */
  schoolYear?: string;
  /** DN-ene til medlemmene. */
  members: string[];
  dn?: string;
}

const idSchema = z
  .string()
  .trim()
  .min(1, "Gruppe-ID (cn) er påkrevd")
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Ugyldige tegn i gruppe-ID");

export const groupInputSchema = z
  .object({
    cn: idSchema,
    displayName: z.string().trim().min(1, "Visningsnavn er påkrevd").max(256),
    description: z.string().trim().max(1024).optional(),
    goType: z.enum(GO_GROUP_TYPE_VALUES as [string, ...string[]], {
      errorMap: () => ({
        message: `Gruppetype må være en av: ${GO_GROUP_TYPE_VALUES.join(", ")}`,
      }),
    }),
    goGrep: z.string().trim().max(64).optional(),
    goGrade: z
      .number()
      .int()
      .optional()
      .refine(
        (v) => v === undefined || isValidGrunnskoleGrade(v),
        "Årstrinn må være mellom 1 og 10 for grunnskolen",
      ),
    schacHomeOrganization: z.string().trim().min(1),
    eduPersonOrgUnitDN: z.string().trim().optional(),
    schoolYear: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Skoleår må ha formen ÅÅÅÅ/ÅÅÅÅ")
      .optional(),
    members: z.array(z.string().trim().min(1)).default([]),
  })
  .superRefine((val, ctx) => {
    const def = getGroupTypeDef(val.goType);
    if (!def) return;
    if (def.requiresGrep && !val.goGrep) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["goGrep"],
        message: `${def.label} krever en GREP-fagkode`,
      });
    }
    if (def.requiresGrade && val.goGrade === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["goGrade"],
        message: `${def.label} krever årstrinn`,
      });
    }
  });

export type GroupInput = z.infer<typeof groupInputSchema>;

export function normalizeGroup(input: GroupInput): FeideGroup {
  return {
    cn: input.cn,
    displayName: input.displayName,
    description: input.description || undefined,
    goType: input.goType,
    goGrep: input.goGrep || undefined,
    goGrade: input.goGrade,
    schacHomeOrganization: input.schacHomeOrganization.toLowerCase(),
    eduPersonOrgUnitDN: input.eduPersonOrgUnitDN || undefined,
    schoolYear: input.schoolYear || undefined,
    members: [...new Set(input.members)],
  };
}
