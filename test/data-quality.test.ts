import { describe, it, expect } from "vitest";
import { analyzeDirectory } from "../src/quality/data-quality.js";
import type { FeidePerson } from "../src/domain/person.js";
import type { FeideGroup } from "../src/domain/group.js";

function student(uid: string, overrides: Partial<FeidePerson> = {}): FeidePerson {
  return {
    uid,
    eduPersonPrincipalName: `${uid}@skole.kommune.no`,
    givenName: "Test",
    sn: "Elev",
    displayName: "Test Elev",
    cn: "Test Elev",
    mail: `${uid}@skole.kommune.no`,
    eduPersonAffiliation: ["student"],
    eduPersonPrimaryAffiliation: "student",
    schacHomeOrganization: "skole.kommune.no",
    norEduPersonNIN: "15061250090",
    dn: `uid=${uid},ou=people,dc=skole,dc=kommune,dc=no`,
    ...overrides,
  };
}

function code(report: ReturnType<typeof analyzeDirectory>, c: string) {
  return report.issues.filter((i) => i.code === c);
}

describe("datakvalitet", () => {
  it("gir en ren rapport for et korrekt oppsett", () => {
    const teacher = student("kari", {
      givenName: "Kari",
      sn: "Lærer",
      eduPersonAffiliation: ["employee"],
      eduPersonPrimaryAffiliation: "employee",
      norEduPersonNIN: "01019000083",
    });
    const persons = [student("ola"), teacher];
    const groups: FeideGroup[] = [
      {
        cn: "7a",
        displayName: "7A",
        goType: "basis",
        goGrade: 7,
        schacHomeOrganization: "skole.kommune.no",
        members: [persons[0]!.dn!, teacher.dn!],
      },
    ];
    const report = analyzeDirectory(persons, groups);
    expect(report.totals.errors).toBe(0);
    expect(report.score).toBe(100);
  });

  it("oppdager duplikat eduPPN", () => {
    const a = student("ola");
    const b = student("ola2", { eduPersonPrincipalName: "ola@skole.kommune.no" });
    const report = analyzeDirectory([a, b], []);
    expect(code(report, "P-EPPN-DUPLICATE").length).toBe(1);
  });

  it("oppdager ugyldig fødselsnummer", () => {
    const report = analyzeDirectory([student("ola", { norEduPersonNIN: "12345678901" })], []);
    expect(code(report, "P-NIN-INVALID").length).toBe(1);
  });

  it("oppdager forelderløst gruppemedlem", () => {
    const groups: FeideGroup[] = [
      {
        cn: "7a",
        displayName: "7A",
        goType: "basis",
        goGrade: 7,
        schacHomeOrganization: "skole.kommune.no",
        members: ["uid=finnesikke,ou=people,dc=skole,dc=kommune,dc=no"],
      },
    ];
    const report = analyzeDirectory([student("ola")], groups);
    expect(code(report, "G-MEMBER-ORPHAN").length).toBe(1);
  });

  it("advarer når elev ikke er i noen basisgruppe", () => {
    const report = analyzeDirectory([student("ola")], []);
    expect(code(report, "X-STUDENT-NO-BASIS").length).toBe(1);
  });

  it("advarer når elev er i flere basisgrupper", () => {
    const ola = student("ola");
    const groups: FeideGroup[] = [
      { cn: "7a", displayName: "7A", goType: "basis", goGrade: 7, schacHomeOrganization: "skole.kommune.no", members: [ola.dn!] },
      { cn: "7b", displayName: "7B", goType: "basis", goGrade: 7, schacHomeOrganization: "skole.kommune.no", members: [ola.dn!] },
    ];
    const report = analyzeDirectory([ola], groups);
    expect(code(report, "X-STUDENT-MULTI-BASIS").length).toBe(1);
  });

  it("krever GREP-kode på undervisningsgruppe", () => {
    const ola = student("ola");
    const groups: FeideGroup[] = [
      { cn: "mat", displayName: "Mat", goType: "undervisning", schacHomeOrganization: "skole.kommune.no", members: [ola.dn!] },
    ];
    const report = analyzeDirectory([ola], groups);
    expect(code(report, "G-GREP-MISSING").length).toBe(1);
  });
});
