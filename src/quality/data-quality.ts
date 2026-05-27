import type { FeidePerson } from "../domain/person.js";
import type { FeideGroup } from "../domain/group.js";
import { isValidEduPpn } from "../domain/identifiers.js";
import { isValidFnr } from "../domain/fnr.js";
import { isAffiliation } from "../domain/affiliation.js";
import { getGroupTypeDef } from "../domain/group-types.js";
import { isKnownGrepCode, isValidGrunnskoleGrade } from "../domain/grep.js";

/**
 * Datakvalitetsmotor som implementerer kravene i Feides "Sjekkliste for god
 * datakvalitet". Tar hele katalogen (personer + grupper) og produserer en
 * rapport med funn klassifisert som error/warning/info, samt en samlet score.
 */

export type Severity = "error" | "warning" | "info";

export interface QualityIssue {
  code: string;
  severity: Severity;
  message: string;
  subjectKind: "person" | "group" | "directory";
  subjectId?: string;
}

export interface QualityReport {
  generatedAt: string;
  totals: {
    persons: number;
    groups: number;
    students: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  score: number;
  issues: QualityIssue[];
}

function personId(p: FeidePerson): string {
  return p.eduPersonPrincipalName || p.uid || p.dn || "(ukjent)";
}

/** Alle identifikatorer en gruppes `member` kan peke på for samme person. */
function memberKeys(p: FeidePerson): string[] {
  const keys: string[] = [];
  if (p.dn) keys.push(p.dn.toLowerCase());
  if (p.eduPersonPrincipalName) keys.push(p.eduPersonPrincipalName.toLowerCase());
  if (p.uid) keys.push(p.uid.toLowerCase());
  return keys;
}

export function analyzeDirectory(
  persons: FeidePerson[],
  groups: FeideGroup[],
): QualityReport {
  const issues: QualityIssue[] = [];
  const add = (
    severity: Severity,
    code: string,
    message: string,
    subjectKind: QualityIssue["subjectKind"],
    subjectId?: string,
  ) => issues.push({ severity, code, message, subjectKind, subjectId });

  // ---- Oppslag for kryssjekker ----
  const memberLookup = new Map<string, FeidePerson>();
  for (const p of persons) {
    for (const key of memberKeys(p)) memberLookup.set(key, p);
  }

  // ---- Person-sjekker ----
  const eppnSeen = new Map<string, number>();
  const uidSeen = new Map<string, number>();
  const ninSeen = new Map<string, number>();
  const realms = new Set<string>();

  for (const p of persons) {
    const id = personId(p);

    if (!p.eduPersonPrincipalName) {
      add("error", "P-EPPN-MISSING", "Mangler eduPersonPrincipalName (eduPPN)", "person", id);
    } else if (!isValidEduPpn(p.eduPersonPrincipalName)) {
      add("error", "P-EPPN-INVALID", `Ugyldig eduPPN: ${p.eduPersonPrincipalName}`, "person", id);
    } else {
      const key = p.eduPersonPrincipalName.toLowerCase();
      eppnSeen.set(key, (eppnSeen.get(key) ?? 0) + 1);
    }

    if (p.uid) {
      const key = p.uid.toLowerCase();
      uidSeen.set(key, (uidSeen.get(key) ?? 0) + 1);
    }

    if (!p.givenName) add("error", "P-GIVENNAME-MISSING", "Mangler fornavn (givenName)", "person", id);
    if (!p.sn) add("error", "P-SN-MISSING", "Mangler etternavn (sn)", "person", id);
    if (!p.displayName) {
      add("warning", "P-DISPLAYNAME-MISSING", "Mangler visningsnavn (displayName)", "person", id);
    }

    if (!p.mail) {
      add("warning", "P-MAIL-MISSING", "Mangler e-postadresse (mail)", "person", id);
    }

    if (!p.eduPersonAffiliation || p.eduPersonAffiliation.length === 0) {
      add("error", "P-AFFIL-MISSING", "Mangler tilknytning (eduPersonAffiliation)", "person", id);
    } else if (!p.eduPersonAffiliation.every(isAffiliation)) {
      add("error", "P-AFFIL-INVALID", "Ugyldig verdi i eduPersonAffiliation", "person", id);
    }
    if (!p.eduPersonPrimaryAffiliation || !isAffiliation(p.eduPersonPrimaryAffiliation)) {
      add("error", "P-PRIMARY-INVALID", "Mangler/ugyldig eduPersonPrimaryAffiliation", "person", id);
    } else if (!p.eduPersonAffiliation?.includes(p.eduPersonPrimaryAffiliation)) {
      add("error", "P-PRIMARY-NOT-IN-SET", "Primær tilknytning finnes ikke i tilknytningslisten", "person", id);
    }

    if (p.norEduPersonNIN) {
      if (!isValidFnr(p.norEduPersonNIN)) {
        add("error", "P-NIN-INVALID", "Ugyldig fødselsnummer (norEduPersonNIN)", "person", id);
      } else {
        ninSeen.set(p.norEduPersonNIN, (ninSeen.get(p.norEduPersonNIN) ?? 0) + 1);
      }
    } else if (p.eduPersonPrimaryAffiliation === "student") {
      add("warning", "P-NIN-MISSING", "Elev mangler fødselsnummer (norEduPersonNIN)", "person", id);
    }

    if (p.schacHomeOrganization) realms.add(p.schacHomeOrganization.toLowerCase());
    else add("warning", "P-REALM-MISSING", "Mangler schacHomeOrganization (realm)", "person", id);
  }

  for (const [key, count] of eppnSeen) {
    if (count > 1) add("error", "P-EPPN-DUPLICATE", `eduPPN brukes av ${count} personer: ${key}`, "directory");
  }
  for (const [key, count] of uidSeen) {
    if (count > 1) add("error", "P-UID-DUPLICATE", `uid brukes av ${count} personer: ${key}`, "directory");
  }
  for (const [key, count] of ninSeen) {
    if (count > 1) add("error", "P-NIN-DUPLICATE", `Samme fødselsnummer brukt av ${count} personer`, "directory", key);
  }
  if (realms.size > 1) {
    add("warning", "D-REALM-MIXED", `Flere realm i samme katalog: ${[...realms].join(", ")}`, "directory");
  }

  // ---- Gruppe-sjekker ----
  const cnSeen = new Map<string, number>();
  // student-DN/eppn -> antall basisgrupper de er medlem i
  const basisCountPerStudent = new Map<string, number>();

  for (const g of groups) {
    const id = g.cn || g.displayName || "(ukjent gruppe)";
    cnSeen.set(g.cn.toLowerCase(), (cnSeen.get(g.cn.toLowerCase()) ?? 0) + 1);

    if (!g.displayName) add("error", "G-DISPLAYNAME-MISSING", "Gruppe mangler visningsnavn", "group", id);

    const def = getGroupTypeDef(g.goType);
    if (!def) {
      add("error", "G-TYPE-INVALID", `Ukjent gruppetype: ${g.goType}`, "group", id);
    } else {
      if (def.requiresGrep) {
        if (!g.goGrep) {
          add("error", "G-GREP-MISSING", `${def.label} mangler GREP-fagkode`, "group", id);
        } else if (!isKnownGrepCode(g.goGrep)) {
          add("warning", "G-GREP-UNKNOWN", `GREP-kode ikke i kjent grunnskoleliste: ${g.goGrep}`, "group", id);
        }
      }
      if (def.requiresGrade) {
        if (g.goGrade === undefined) {
          add("error", "G-GRADE-MISSING", `${def.label} mangler årstrinn`, "group", id);
        } else if (!isValidGrunnskoleGrade(g.goGrade)) {
          add("error", "G-GRADE-INVALID", `Ugyldig årstrinn: ${g.goGrade}`, "group", id);
        }
      }
    }

    // Medlemsoppløsning
    let studentMembers = 0;
    let staffMembers = 0;
    for (const m of g.members) {
      const person = memberLookup.get(m.toLowerCase());
      if (!person) {
        add("error", "G-MEMBER-ORPHAN", `Medlem peker ikke på en eksisterende person: ${m}`, "group", id);
        continue;
      }
      if (person.eduPersonPrimaryAffiliation === "student") {
        studentMembers++;
        if (g.goType === "basis") {
          const k = (person.eduPersonPrincipalName || person.dn || person.uid).toLowerCase();
          basisCountPerStudent.set(k, (basisCountPerStudent.get(k) ?? 0) + 1);
        }
      } else {
        staffMembers++;
      }
    }

    if (g.goType === "basis") {
      if (studentMembers === 0) add("warning", "G-BASIS-NO-STUDENTS", "Basisgruppe (klasse) har ingen elever", "group", id);
      if (staffMembers === 0) add("warning", "G-BASIS-NO-CONTACT", "Basisgruppe (klasse) mangler kontaktlærer", "group", id);
    }
  }

  for (const [key, count] of cnSeen) {
    if (count > 1) add("error", "G-CN-DUPLICATE", `Gruppe-ID (cn) er ikke unik: ${key}`, "directory");
  }

  // Hver elev skal tilhøre nøyaktig én basisgruppe.
  const students = persons.filter((p) => p.eduPersonPrimaryAffiliation === "student");
  for (const s of students) {
    const k = (s.eduPersonPrincipalName || s.dn || s.uid).toLowerCase();
    const count = basisCountPerStudent.get(k) ?? 0;
    if (count === 0) {
      add("warning", "X-STUDENT-NO-BASIS", "Elev er ikke medlem av noen basisgruppe (klasse)", "person", personId(s));
    } else if (count > 1) {
      add("warning", "X-STUDENT-MULTI-BASIS", `Elev er medlem av ${count} basisgrupper (bør være én)`, "person", personId(s));
    }
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  // Score: 100 minus vektet andel feil/advarsler per kontrollert enhet.
  const units = Math.max(1, persons.length + groups.length);
  const penalty = (errors * 3 + warnings) / units;
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty * 20)));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      persons: persons.length,
      groups: groups.length,
      students: students.length,
      errors,
      warnings,
      infos,
    },
    score,
    issues,
  };
}
