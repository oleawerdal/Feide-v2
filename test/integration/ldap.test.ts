import { describe, it, expect, afterAll } from "vitest";
import { normalizePerson, personInputSchema } from "../../src/domain/person.js";
import { normalizeGroup, groupInputSchema } from "../../src/domain/group.js";
import {
  createPerson,
  deletePerson,
  getPerson,
  personDn,
  updatePerson,
} from "../../src/ldap/person.repository.js";
import {
  createGroup,
  deleteGroup,
  getGroup,
  setMembers,
} from "../../src/ldap/group.repository.js";
import { analyzeDirectory } from "../../src/quality/data-quality.js";
import { listPersons } from "../../src/ldap/person.repository.js";
import { listGroups } from "../../src/ldap/group.repository.js";

/**
 * Integrasjonstest mot en kjørende OpenLDAP (LDAPS). Kjør med:
 *   npm run ldap:up   (eller npm run ldap:native)
 *   npm run test:integration
 * Hoppes over uten RUN_LDAP_INTEGRATION=1.
 */
const enabled = process.env.RUN_LDAP_INTEGRATION === "1";
const d = describe;

(enabled ? d : d.skip)("LDAP-integrasjon", () => {
  const stamp = Date.now();
  const uid = `it.test.${stamp}`;
  const cn = `it-basis-${stamp}`;
  const realm = "skole.kommune.no";

  afterAll(async () => {
    await deletePerson(uid).catch(() => {});
    await deleteGroup(cn).catch(() => {});
  });

  it("oppretter, leser og oppdaterer en person over LDAPS", async () => {
    const person = normalizePerson(
      personInputSchema.parse({
        uid,
        eduPersonPrincipalName: `${uid}@${realm}`,
        givenName: "Integrasjon",
        sn: "Test",
        displayName: "Integrasjon Test",
        mail: `${uid}@${realm}`,
        eduPersonAffiliation: ["student"],
        eduPersonPrimaryAffiliation: "student",
        schacHomeOrganization: realm,
        norEduPersonNIN: "15061250090",
      }),
    );
    await createPerson(person, "TestPassord123");

    const read = await getPerson(uid);
    expect(read?.eduPersonPrincipalName).toBe(`${uid}@${realm}`);
    expect(read?.eduPersonPrimaryAffiliation).toBe("student");

    await updatePerson(uid, { ...person, displayName: "Endret Navn" });
    expect((await getPerson(uid))?.displayName).toBe("Endret Navn");
  });

  it("oppretter en basisgruppe og setter medlemmer", async () => {
    const group = normalizeGroup(
      groupInputSchema.parse({
        cn,
        displayName: `IT ${stamp}`,
        goType: "basis",
        goGrade: 7,
        schacHomeOrganization: realm,
        members: [],
      }),
    );
    await createGroup(group);
    await setMembers(cn, [personDn(uid)]);

    const read = await getGroup(cn);
    expect(read?.goType).toBe("basis");
    expect(read?.goGrade).toBe(7);
    expect(read?.members).toContain(personDn(uid));
  });

  it("produserer en datakvalitetsrapport for hele katalogen", async () => {
    const [persons, groups] = await Promise.all([listPersons(), listGroups()]);
    const report = analyzeDirectory(persons, groups);
    expect(report.totals.persons).toBeGreaterThan(0);
    expect(report.totals.groups).toBeGreaterThan(0);
    expect(report.score).toBeGreaterThanOrEqual(0);
  });
});
