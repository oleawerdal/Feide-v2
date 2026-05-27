import { Attribute, Change } from "ldapts";
import type { Entry } from "ldapts";
import { config } from "../config.js";
import type { FeidePerson } from "../domain/person.js";
import { withClient, firstValue, allValues } from "./client.js";
import { escapeDnValue, escapeFilterValue } from "./escape.js";

const PERSON_OBJECT_CLASSES = [
  "top",
  "person",
  "organizationalPerson",
  "inetOrgPerson",
  "feidePerson",
];

export function personDn(uid: string): string {
  return `uid=${escapeDnValue(uid)},${config.peopleBaseDn}`;
}

function entryToPerson(entry: Entry): FeidePerson {
  return {
    dn: entry.dn,
    uid: firstValue(entry.uid) ?? "",
    eduPersonPrincipalName: firstValue(entry.eduPersonPrincipalName) ?? "",
    givenName: firstValue(entry.givenName) ?? "",
    sn: firstValue(entry.sn) ?? "",
    displayName: firstValue(entry.displayName) ?? "",
    cn: firstValue(entry.cn) ?? "",
    mail: firstValue(entry.mail) ?? "",
    eduPersonAffiliation: allValues(entry.eduPersonAffiliation),
    eduPersonPrimaryAffiliation: firstValue(entry.eduPersonPrimaryAffiliation) ?? "",
    schacHomeOrganization: firstValue(entry.schacHomeOrganization) ?? "",
    norEduPersonNIN: firstValue(entry.norEduPersonNIN),
    mobile: firstValue(entry.mobile),
    telephoneNumber: firstValue(entry.telephoneNumber),
    eduPersonOrgDN: firstValue(entry.eduPersonOrgDN),
    eduPersonOrgUnitDN: firstValue(entry.eduPersonOrgUnitDN),
  };
}

const READ_ATTRS = [
  "dn",
  "uid",
  "eduPersonPrincipalName",
  "givenName",
  "sn",
  "displayName",
  "cn",
  "mail",
  "eduPersonAffiliation",
  "eduPersonPrimaryAffiliation",
  "schacHomeOrganization",
  "norEduPersonNIN",
  "mobile",
  "telephoneNumber",
  "eduPersonOrgDN",
  "eduPersonOrgUnitDN",
];

export async function listPersons(search?: string): Promise<FeidePerson[]> {
  let filter = "(objectClass=feidePerson)";
  if (search && search.trim()) {
    const s = escapeFilterValue(search.trim());
    filter = `(&(objectClass=feidePerson)(|(uid=*${s}*)(displayName=*${s}*)(sn=*${s}*)(mail=*${s}*)(eduPersonPrincipalName=*${s}*)))`;
  }
  return withClient(async (client) => {
    const { searchEntries } = await client.search(config.peopleBaseDn, {
      scope: "sub",
      filter,
      attributes: READ_ATTRS,
    });
    return searchEntries.map(entryToPerson).sort((a, b) => a.displayName.localeCompare(b.displayName, "nb"));
  });
}

export async function getPerson(uid: string): Promise<FeidePerson | undefined> {
  return withClient(async (client) => {
    const { searchEntries } = await client.search(config.peopleBaseDn, {
      scope: "sub",
      filter: `(&(objectClass=feidePerson)(uid=${escapeFilterValue(uid)}))`,
      attributes: READ_ATTRS,
      sizeLimit: 1,
    });
    const entry = searchEntries[0];
    return entry ? entryToPerson(entry) : undefined;
  });
}

function buildAttributes(p: FeidePerson, password?: string): Record<string, string | string[]> {
  const attrs: Record<string, string | string[]> = {
    objectClass: PERSON_OBJECT_CLASSES,
    uid: p.uid,
    cn: p.cn,
    sn: p.sn,
    givenName: p.givenName,
    displayName: p.displayName,
    mail: p.mail,
    eduPersonPrincipalName: p.eduPersonPrincipalName,
    eduPersonAffiliation: p.eduPersonAffiliation,
    eduPersonPrimaryAffiliation: p.eduPersonPrimaryAffiliation,
    schacHomeOrganization: p.schacHomeOrganization,
  };
  if (p.norEduPersonNIN) attrs.norEduPersonNIN = p.norEduPersonNIN;
  if (p.mobile) attrs.mobile = p.mobile;
  if (p.telephoneNumber) attrs.telephoneNumber = p.telephoneNumber;
  if (p.eduPersonOrgDN) attrs.eduPersonOrgDN = p.eduPersonOrgDN;
  if (p.eduPersonOrgUnitDN) attrs.eduPersonOrgUnitDN = p.eduPersonOrgUnitDN;
  if (password) attrs.userPassword = password;
  return attrs;
}

export async function createPerson(p: FeidePerson, password?: string): Promise<void> {
  await withClient(async (client) => {
    await client.add(personDn(p.uid), buildAttributes(p, password));
  });
}

const OPTIONAL_ATTRS = [
  "norEduPersonNIN",
  "mobile",
  "telephoneNumber",
  "eduPersonOrgDN",
  "eduPersonOrgUnitDN",
] as const;

export async function updatePerson(uid: string, p: FeidePerson): Promise<void> {
  await withClient(async (client) => {
    const changes: Change[] = [];
    const repl = (type: string, values: string[]) =>
      changes.push(new Change({ operation: "replace", modification: new Attribute({ type, values }) }));

    repl("cn", [p.cn]);
    repl("sn", [p.sn]);
    repl("givenName", [p.givenName]);
    repl("displayName", [p.displayName]);
    repl("mail", [p.mail]);
    repl("eduPersonPrincipalName", [p.eduPersonPrincipalName]);
    repl("eduPersonAffiliation", p.eduPersonAffiliation);
    repl("eduPersonPrimaryAffiliation", [p.eduPersonPrimaryAffiliation]);
    repl("schacHomeOrganization", [p.schacHomeOrganization]);

    const optionalValues: Record<(typeof OPTIONAL_ATTRS)[number], string | undefined> = {
      norEduPersonNIN: p.norEduPersonNIN,
      mobile: p.mobile,
      telephoneNumber: p.telephoneNumber,
      eduPersonOrgDN: p.eduPersonOrgDN,
      eduPersonOrgUnitDN: p.eduPersonOrgUnitDN,
    };
    for (const attr of OPTIONAL_ATTRS) {
      const value = optionalValues[attr];
      // Tom verdi => 'replace' med tom liste fjerner attributtet.
      repl(attr, value ? [value] : []);
    }

    await client.modify(personDn(uid), changes);
  });
}

export async function setPassword(uid: string, password: string): Promise<void> {
  await withClient(async (client) => {
    await client.modify(
      personDn(uid),
      new Change({ operation: "replace", modification: new Attribute({ type: "userPassword", values: [password] }) }),
    );
  });
}

export async function deletePerson(uid: string): Promise<void> {
  await withClient(async (client) => {
    await client.del(personDn(uid));
  });
}
