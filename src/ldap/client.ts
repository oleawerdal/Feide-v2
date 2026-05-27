import { readFileSync } from "node:fs";
import { Client, InvalidCredentialsError } from "ldapts";
import type { Entry } from "ldapts";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { escapeFilterValue } from "./escape.js";

/**
 * Tynt lag over ldapts. Hver arbeidsenhet får en fersk, TLS-kryptert
 * tilkobling som bindes med tjenestekontoen og lukkes etterpå (`withClient`).
 * Innlogging av brukere skjer med en separat tilkobling (`bindAs`).
 */

function tlsOptions() {
  const opts: Record<string, unknown> = {
    rejectUnauthorized: config.LDAP_TLS_REJECT_UNAUTHORIZED,
  };
  if (config.LDAP_CA_FILE) {
    opts.ca = readFileSync(config.LDAP_CA_FILE);
  }
  return opts;
}

function newClient(): Client {
  return new Client({
    url: config.LDAP_URL,
    timeout: 10_000,
    connectTimeout: 10_000,
    tlsOptions: tlsOptions(),
  });
}

/** Kjører `fn` med en tilkobling bundet som tjenestekontoen. */
export async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = newClient();
  try {
    await client.bind(config.LDAP_BIND_DN, config.LDAP_BIND_PASSWORD);
    return await fn(client);
  } finally {
    try {
      await client.unbind();
    } catch (err) {
      logger.debug({ err }, "feil ved unbind");
    }
  }
}

/**
 * Forsøker å binde som en bruker for å verifisere passord.
 * Returnerer true ved suksess, false ved feil passord.
 */
export async function verifyPassword(userDn: string, password: string): Promise<boolean> {
  if (!password) return false;
  const client = newClient();
  try {
    await client.bind(userDn, password);
    return true;
  } catch (err) {
    if (err instanceof InvalidCredentialsError) return false;
    throw err;
  } finally {
    try {
      await client.unbind();
    } catch {
      /* ignore */
    }
  }
}

export interface FoundUser {
  dn: string;
  uid?: string;
  displayName?: string;
  isAdmin: boolean;
}

/** Finn en bruker via uid eller eduPPN og avgjør om vedkommende er admin. */
export async function findLoginUser(login: string): Promise<FoundUser | undefined> {
  const safe = escapeFilterValue(login.trim());
  return withClient(async (client) => {
    const { searchEntries } = await client.search(config.peopleBaseDn, {
      scope: "sub",
      filter: `(&(objectClass=person)(|(uid=${safe})(eduPersonPrincipalName=${safe})(mail=${safe})))`,
      attributes: ["uid", "displayName", "isMemberOf"],
      sizeLimit: 2,
    });
    const entry = searchEntries[0];
    if (!entry) return undefined;

    const isAdmin = await isMemberOfAdminGroup(client, entry.dn);
    return {
      dn: entry.dn,
      uid: firstValue(entry.uid),
      displayName: firstValue(entry.displayName),
      isAdmin,
    };
  });
}

async function isMemberOfAdminGroup(client: Client, userDn: string): Promise<boolean> {
  const safe = escapeFilterValue(userDn);
  const { searchEntries } = await client.search(config.LDAP_ADMIN_GROUP_DN, {
    scope: "base",
    filter: `(|(member=${safe})(uniqueMember=${safe}))`,
    attributes: ["cn"],
  });
  return searchEntries.length > 0;
}

export function firstValue(v: Entry[string] | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) {
    const first = v[0];
    return first === undefined ? undefined : first.toString();
  }
  return v.toString();
}

export function allValues(v: Entry[string] | undefined): string[] {
  if (v === undefined) return [];
  if (Array.isArray(v)) return v.map((x) => x.toString());
  return [v.toString()];
}
