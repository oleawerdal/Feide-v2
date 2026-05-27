#!/usr/bin/env node
// Genererer ldap/bootstrap/data.ldif: en liten, men komplett grunnskole med
// basisgrupper (klasser) for ALLE trinn 1–10, trinngrupper, undervisnings-
// grupper og en "andre"-gruppe, samt elever og lærere med gyldige
// fødselsnummer (mod11). Determinisk – kjør på nytt for å regenerere.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = "dc=skole,dc=kommune,dc=no";
const REALM = "skole.kommune.no";
const PEOPLE = `ou=people,${BASE}`;
const GROUPS = `ou=groups,${BASE}`;
const SCHOOL_YEAR = "2025/2026";

const K1 = [3, 7, 6, 1, 8, 9, 4, 5, 2];
const K2 = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const ctrl = (d, w) => {
  const r = w.reduce((a, x, i) => a + x * d[i], 0) % 11;
  return r === 0 ? 0 : 11 - r;
};
// Lager et gyldig fnr for gitt dato (Date) – søker individnummer til mod11 stemmer.
function makeFnr(date) {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(date.getUTCFullYear() % 100).padStart(2, "0");
  const year = date.getUTCFullYear();
  const start = year >= 2000 ? 500 : 0; // individnummer-rom for århundre
  for (let i = start; i < (year >= 2000 ? 1000 : 500); i++) {
    const ind = String(i).padStart(3, "0");
    const nine = (dd + mm + yy + ind).split("").map(Number);
    const k1 = ctrl(nine, K1);
    if (k1 === 10) continue;
    const k2 = ctrl([...nine, k1], K2);
    if (k2 === 10) continue;
    return dd + mm + yy + ind + k1 + k2;
  }
  throw new Error("fant ikke gyldig fnr for " + date.toISOString());
}

const GIVEN = ["Ola", "Kari", "Per", "Nora", "Liam", "Emma", "Noah", "Sofie", "Jonas", "Maja", "Aksel", "Ingrid", "Elias", "Thea", "Filip", "Sara"];
const SUR = ["Hansen", "Berg", "Johansen", "Olsen", "Larsen", "Andersen", "Nilsen", "Pedersen", "Kristiansen", "Jensen"];
const TEACHER_GIVEN = ["Anne", "Bjørn", "Cecilie", "David", "Eva", "Frode", "Grete", "Henrik", "Ida", "Jan", "Kristin", "Lars", "Mona", "Nils", "Oda", "Pål", "Randi", "Stein", "Tone", "Ulf"];

const SUBJECTS = [
  { grep: "NOR01-06", short: "Norsk" },
  { grep: "MAT01-05", short: "Matematikk" },
  { grep: "ENG01-04", short: "Engelsk" },
];

const lines = [];
const dn = (d) => lines.push(`dn: ${d}`);
const a = (k, v) => lines.push(`${k}: ${v}`);
const blank = () => lines.push("");

// ---- OU-er ----
dn(PEOPLE); a("objectClass", "organizationalUnit"); a("ou", "people"); blank();
dn(GROUPS); a("objectClass", "organizationalUnit"); a("ou", "groups"); blank();

function personEntry(p) {
  dn(`uid=${p.uid},${PEOPLE}`);
  a("objectClass", "top");
  a("objectClass", "person");
  a("objectClass", "organizationalPerson");
  a("objectClass", "inetOrgPerson");
  a("objectClass", "feidePerson");
  a("uid", p.uid);
  a("cn", `${p.given} ${p.sur}`);
  a("sn", p.sur);
  a("givenName", p.given);
  a("displayName", `${p.given} ${p.sur}`);
  a("mail", `${p.uid}@${REALM}`);
  a("eduPersonPrincipalName", `${p.uid}@${REALM}`);
  for (const aff of p.affiliations) a("eduPersonAffiliation", aff);
  a("eduPersonPrimaryAffiliation", p.primary);
  a("schacHomeOrganization", REALM);
  a("norEduPersonNIN", p.fnr);
  if (p.password) a("userPassword", p.password);
  blank();
}

let pupilCounter = 0;
let teacherCounter = 0;
const uidSeen = new Map();
function uniqueUid(given, sur) {
  let base = `${given}.${sur}`.toLowerCase().replace(/[æ]/g, "ae").replace(/[ø]/g, "o").replace(/[å]/g, "aa");
  const n = (uidSeen.get(base) ?? 0) + 1;
  uidSeen.set(base, n);
  return n === 1 ? base : `${base}${n}`;
}

// ---- Administrator (Feide-portal-admin) ----
const admin = {
  uid: "admin.skole",
  given: "Ada",
  sur: "Administrator",
  affiliations: ["employee", "staff"],
  primary: "employee",
  fnr: makeFnr(new Date(Date.UTC(1980, 4, 12))),
  password: "Admin123!",
};
personEntry(admin);

// ---- Bygg trinn 1–10 med klasser A og B ----
const teachers = [];
const basisGroups = [];
const trinnGroups = [];
const allPersons = [admin];

for (let grade = 1; grade <= 10; grade++) {
  const birthYear = 2026 - 5 - grade; // 1. trinn ~6 år
  const trinnMembers = [];

  for (const klasse of ["A", "B"]) {
    const className = `${grade}${klasse}`;
    // Kontaktlærer
    const tGiven = TEACHER_GIVEN[teacherCounter % TEACHER_GIVEN.length];
    const tSur = SUR[(teacherCounter + 3) % SUR.length];
    teacherCounter++;
    const teacherUid = uniqueUid(tGiven, tSur);
    const teacher = {
      uid: teacherUid,
      given: tGiven,
      sur: tSur,
      affiliations: ["employee", "faculty"],
      primary: "employee",
      fnr: makeFnr(new Date(Date.UTC(1970 + (teacherCounter % 25), teacherCounter % 12, 1 + (teacherCounter % 27)))),
      password: "Laerer123!",
    };
    personEntry(teacher);
    teachers.push(teacher);
    allPersons.push(teacher);

    // Elever (3 per klasse)
    const pupilDns = [];
    for (let i = 0; i < 3; i++) {
      const given = GIVEN[pupilCounter % GIVEN.length];
      const sur = SUR[(pupilCounter * 7 + grade) % SUR.length];
      pupilCounter++;
      const uid = uniqueUid(given, sur);
      const day = 1 + (pupilCounter % 27);
      const month = pupilCounter % 12;
      const pupil = {
        uid,
        given,
        sur,
        affiliations: ["student"],
        primary: "student",
        fnr: makeFnr(new Date(Date.UTC(birthYear, month, day))),
      };
      personEntry(pupil);
      allPersons.push(pupil);
      const pdn = `uid=${uid},${PEOPLE}`;
      pupilDns.push(pdn);
      trinnMembers.push(pdn);
    }

    basisGroups.push({
      cn: `basis-${className}-2025`,
      displayName: className,
      grade,
      members: [`uid=${teacher.uid},${PEOPLE}`, ...pupilDns],
      contactTeacher: teacher,
      pupils: pupilDns,
    });
  }

  trinnGroups.push({
    cn: `trinn-${grade}-2025`,
    displayName: `${grade}. trinn`,
    grade,
    members: trinnMembers,
  });
}

function groupEntry(g) {
  dn(`cn=${g.cn},${GROUPS}`);
  a("objectClass", "top");
  a("objectClass", "gogroup");
  a("cn", g.cn);
  a("displayName", g.displayName);
  if (g.description) a("description", g.description);
  a("goType", g.goType);
  if (g.goGrep) a("goGrep", g.goGrep);
  if (g.goGrade !== undefined) a("goGrade", String(g.goGrade));
  a("goSchoolYear", SCHOOL_YEAR);
  a("schacHomeOrganization", REALM);
  for (const m of g.members) a("member", m);
  blank();
}

// Skolegruppe (alle)
groupEntry({
  cn: "skole-alle-2025",
  displayName: "Hele skolen",
  goType: "skole",
  members: allPersons.map((p) => `uid=${p.uid},${PEOPLE}`),
});

// Basisgrupper (klasser) – ALLE trinn
for (const g of basisGroups) {
  groupEntry({ cn: g.cn, displayName: g.displayName, goType: "basis", goGrade: g.grade, members: g.members });
}

// Trinngrupper
for (const g of trinnGroups) {
  groupEntry({ cn: g.cn, displayName: g.displayName, goType: "trinn", goGrade: g.grade, members: g.members });
}

// Undervisningsgrupper – noen fag per klasse (bruker kontaktlærer + klassens elever)
for (const g of basisGroups) {
  for (const subj of SUBJECTS) {
    groupEntry({
      cn: `und-${subj.short.toLowerCase()}-${g.displayName}-2025`,
      displayName: `${subj.short} ${g.displayName}`,
      goType: "undervisning",
      goGrep: subj.grep,
      members: [`uid=${g.contactTeacher.uid},${PEOPLE}`, ...g.pupils],
    });
  }
}

// Andre-gruppe
groupEntry({
  cn: "andre-leksehjelp-2025",
  displayName: "Leksehjelp",
  description: "Frivillig leksehjelp etter skoletid",
  goType: "andre",
  members: basisGroups.slice(0, 3).flatMap((g) => g.pupils),
});

// Feide-admins (groupOfNames) – styrer hvem som kan logge inn i portalen
dn(`cn=feide-admins,${GROUPS}`);
a("objectClass", "groupOfNames");
a("cn", "feide-admins");
a("description", "Administratorer av Feide-katalogportalen");
a("member", `uid=${admin.uid},${PEOPLE}`);
blank();

const out = lines.join("\n") + "\n";
const dir = dirname(fileURLToPath(import.meta.url));
const target = join(dir, "..", "ldap", "bootstrap", "data.ldif");
writeFileSync(target, out, "utf8");
console.error(
  `Skrev ${target}: ${allPersons.length} personer, ${basisGroups.length} basisgrupper, ${trinnGroups.length} trinngrupper.`,
);
