import "dotenv/config";
import { z } from "zod";

/**
 * Sentralisert, validert konfigurasjon. Alle hemmeligheter og
 * tilkoblingsdetaljer kommer fra miljøvariabler (aldri hardkodet).
 */
const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def : v === "true" || v === "1"));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8443),

  // Web-TLS (HTTPS). Anbefalt i produksjon.
  TLS_CERT_FILE: z.string().optional(),
  TLS_KEY_FILE: z.string().optional(),

  // LDAP
  LDAP_URL: z.string().default("ldaps://localhost:636"),
  LDAP_BIND_DN: z.string().default("cn=admin,dc=skole,dc=kommune,dc=no"),
  LDAP_BIND_PASSWORD: z.string().default("adminpass"),
  LDAP_BASE_DN: z.string().default("dc=skole,dc=kommune,dc=no"),
  LDAP_PEOPLE_OU: z.string().default("ou=people"),
  LDAP_GROUPS_OU: z.string().default("ou=groups"),
  LDAP_TLS_REJECT_UNAUTHORIZED: bool(true),
  LDAP_CA_FILE: z.string().optional(),

  // Hvem får logge inn i portalen: medlemmer av denne gruppen.
  LDAP_ADMIN_GROUP_DN: z
    .string()
    .default("cn=feide-admins,ou=groups,dc=skole,dc=kommune,dc=no"),

  // Standard realm (schacHomeOrganization) for nye personer/grupper.
  REALM: z.string().default("skole.kommune.no"),

  // Sesjon
  SESSION_SECRET: z.string().min(16).default("change-me-in-production-please!!"),
  SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(60),
});

export type AppConfig = z.infer<typeof envSchema> & {
  peopleBaseDn: string;
  groupsBaseDn: string;
  isProd: boolean;
};

function load(): AppConfig {
  const parsed = envSchema.parse(process.env);
  const peopleBaseDn = `${parsed.LDAP_PEOPLE_OU},${parsed.LDAP_BASE_DN}`;
  const groupsBaseDn = `${parsed.LDAP_GROUPS_OU},${parsed.LDAP_BASE_DN}`;
  const isProd = parsed.NODE_ENV === "production";

  if (isProd && parsed.SESSION_SECRET.startsWith("change-me")) {
    throw new Error("SESSION_SECRET må settes til en sterk verdi i produksjon");
  }
  if (isProd && !parsed.LDAP_URL.startsWith("ldaps://")) {
    throw new Error("LDAP_URL må bruke ldaps:// (kryptert) i produksjon");
  }

  return { ...parsed, peopleBaseDn, groupsBaseDn, isProd };
}

export const config = load();
