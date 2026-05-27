/**
 * eduPersonAffiliation – kontrollert vokabular fra eduPerson-spesifikasjonen
 * (REFEDS / Internet2). Feide krever at affiliation-verdier hentes herfra, og
 * at hver person har én primær tilknytning (eduPersonPrimaryAffiliation).
 */
export const EDU_PERSON_AFFILIATIONS = [
  "faculty",
  "student",
  "staff",
  "employee",
  "member",
  "affiliate",
  "alum",
  "library-walk-in",
] as const;

export type EduPersonAffiliation = (typeof EDU_PERSON_AFFILIATIONS)[number];

export function isAffiliation(value: string): value is EduPersonAffiliation {
  return (EDU_PERSON_AFFILIATIONS as readonly string[]).includes(value);
}

/**
 * Tilknytninger som er relevante i grunnopplæringen (info_go).
 * Elever skal være `student`; ansatte/lærere `employee`/`faculty`/`staff`.
 */
export const GO_PRIMARY_AFFILIATIONS = [
  "student",
  "faculty",
  "staff",
  "employee",
] as const;

/** Norsk visningstekst for tilknytning. */
export const AFFILIATION_LABELS: Record<EduPersonAffiliation, string> = {
  faculty: "Lærer/faglig",
  student: "Elev",
  staff: "Ansatt (administrativ)",
  employee: "Ansatt",
  member: "Medlem",
  affiliate: "Tilknyttet",
  alum: "Tidligere elev",
  "library-walk-in": "Bibliotekbruker",
};
