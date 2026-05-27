/**
 * Hjelpefunksjoner for Feide-identifikatorer: eduPersonPrincipalName (eduPPN),
 * realm (schacHomeOrganization) og brukernavn (uid).
 *
 * Sjekklista for god datakvalitet krever at eduPPN er unik, varig og aldri
 * gjenbrukes, og at den har formen <brukernavn>@<realm>.
 */

const REALM_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
const UID_RE = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;

export function isValidRealm(realm: string): boolean {
  return REALM_RE.test(realm.trim().toLowerCase());
}

export function isValidUid(uid: string): boolean {
  return UID_RE.test(uid.trim());
}

export interface EduPpnParts {
  uid: string;
  realm: string;
}

export function parseEduPpn(eppn: string): EduPpnParts | undefined {
  const value = eppn.trim();
  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@")) return undefined;
  const uid = value.slice(0, at);
  const realm = value.slice(at + 1);
  return { uid, realm };
}

export function isValidEduPpn(eppn: string): boolean {
  const parts = parseEduPpn(eppn);
  if (!parts) return false;
  return isValidUid(parts.uid) && isValidRealm(parts.realm);
}

export function buildEduPpn(uid: string, realm: string): string {
  return `${uid.trim().toLowerCase()}@${realm.trim().toLowerCase()}`;
}

/**
 * schacPersonalUniqueID for norsk fødselsnummer, slik Feide/SCHAC forventer.
 * urn:mace:terena.org:schac:personalUniqueID:no:NO:FNR:<fnr>
 */
export function schacPersonalUniqueId(fnr: string): string {
  return `urn:mace:terena.org:schac:personalUniqueID:no:NO:FNR:${fnr.trim()}`;
}

/**
 * eduPersonEntitlement-URN for medlemskap i en go-gruppe.
 * urn:mace:feide.no:go:group:<urnCode>:<realm>:<groupId>
 */
export function goGroupEntitlement(
  urnCode: string,
  realm: string,
  groupId: string,
): string {
  return `urn:mace:feide.no:go:group:${urnCode}:${realm}:${groupId}`;
}
