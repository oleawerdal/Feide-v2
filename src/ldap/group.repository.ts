import { Attribute, Change } from "ldapts";
import type { Entry } from "ldapts";
import { config } from "../config.js";
import type { FeideGroup } from "../domain/group.js";
import { withClient, firstValue, allValues } from "./client.js";
import { escapeDnValue, escapeFilterValue } from "./escape.js";

const GROUP_OBJECT_CLASSES = ["top", "gogroup"];

export function groupDn(cn: string): string {
  return `cn=${escapeDnValue(cn)},${config.groupsBaseDn}`;
}

const READ_ATTRS = [
  "dn",
  "cn",
  "displayName",
  "description",
  "goType",
  "goGrep",
  "goGrade",
  "goSchoolYear",
  "schacHomeOrganization",
  "eduPersonOrgUnitDN",
  "member",
];

function entryToGroup(entry: Entry): FeideGroup {
  const gradeRaw = firstValue(entry.goGrade);
  return {
    dn: entry.dn,
    cn: firstValue(entry.cn) ?? "",
    displayName: firstValue(entry.displayName) ?? "",
    description: firstValue(entry.description),
    goType: firstValue(entry.goType) ?? "",
    goGrep: firstValue(entry.goGrep),
    goGrade: gradeRaw ? Number(gradeRaw) : undefined,
    schoolYear: firstValue(entry.goSchoolYear),
    schacHomeOrganization: firstValue(entry.schacHomeOrganization) ?? "",
    eduPersonOrgUnitDN: firstValue(entry.eduPersonOrgUnitDN),
    members: allValues(entry.member),
  };
}

export async function listGroups(goType?: string): Promise<FeideGroup[]> {
  let filter = "(objectClass=gogroup)";
  if (goType && goType.trim()) {
    filter = `(&(objectClass=gogroup)(goType=${escapeFilterValue(goType.trim())}))`;
  }
  return withClient(async (client) => {
    const { searchEntries } = await client.search(config.groupsBaseDn, {
      scope: "sub",
      filter,
      attributes: READ_ATTRS,
    });
    return searchEntries
      .map(entryToGroup)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "nb"));
  });
}

export async function getGroup(cn: string): Promise<FeideGroup | undefined> {
  return withClient(async (client) => {
    const { searchEntries } = await client.search(config.groupsBaseDn, {
      scope: "sub",
      filter: `(&(objectClass=gogroup)(cn=${escapeFilterValue(cn)}))`,
      attributes: READ_ATTRS,
      sizeLimit: 1,
    });
    const entry = searchEntries[0];
    return entry ? entryToGroup(entry) : undefined;
  });
}

function buildAttributes(g: FeideGroup): Record<string, string | string[]> {
  const attrs: Record<string, string | string[]> = {
    objectClass: GROUP_OBJECT_CLASSES,
    cn: g.cn,
    displayName: g.displayName,
    goType: g.goType,
    schacHomeOrganization: g.schacHomeOrganization,
  };
  if (g.description) attrs.description = g.description;
  if (g.goGrep) attrs.goGrep = g.goGrep;
  if (g.goGrade !== undefined) attrs.goGrade = String(g.goGrade);
  if (g.schoolYear) attrs.goSchoolYear = g.schoolYear;
  if (g.eduPersonOrgUnitDN) attrs.eduPersonOrgUnitDN = g.eduPersonOrgUnitDN;
  if (g.members.length > 0) attrs.member = g.members;
  return attrs;
}

export async function createGroup(g: FeideGroup): Promise<void> {
  await withClient(async (client) => {
    await client.add(groupDn(g.cn), buildAttributes(g));
  });
}

export async function updateGroup(cn: string, g: FeideGroup): Promise<void> {
  await withClient(async (client) => {
    const changes: Change[] = [];
    const repl = (type: string, values: string[]) =>
      changes.push(new Change({ operation: "replace", modification: new Attribute({ type, values }) }));

    repl("displayName", [g.displayName]);
    repl("goType", [g.goType]);
    repl("schacHomeOrganization", [g.schacHomeOrganization]);
    repl("description", g.description ? [g.description] : []);
    repl("goGrep", g.goGrep ? [g.goGrep] : []);
    repl("goGrade", g.goGrade !== undefined ? [String(g.goGrade)] : []);
    repl("goSchoolYear", g.schoolYear ? [g.schoolYear] : []);
    repl("eduPersonOrgUnitDN", g.eduPersonOrgUnitDN ? [g.eduPersonOrgUnitDN] : []);
    repl("member", g.members);

    await client.modify(groupDn(cn), changes);
  });
}

export async function deleteGroup(cn: string): Promise<void> {
  await withClient(async (client) => {
    await client.del(groupDn(cn));
  });
}

export async function setMembers(cn: string, members: string[]): Promise<void> {
  await withClient(async (client) => {
    await client.modify(
      groupDn(cn),
      new Change({
        operation: "replace",
        modification: new Attribute({ type: "member", values: [...new Set(members)] }),
      }),
    );
  });
}
