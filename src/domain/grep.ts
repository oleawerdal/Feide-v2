/**
 * GREP-koder for grunnskolefag (LK20).
 *
 * GREP er Utdanningsdirektoratets register over læreplaner og fag. I Feide
 * info_go refererer undervisningsgrupper til en GREP-kode via `goGrep`.
 *
 * Listen under er et kuratert utvalg av gjennomgående fag i grunnskolen
 * (1.–10. trinn) med LK20-læreplankoder. Den autoritative kilden er UDIRs
 * GREP-API (https://data.udir.no/kl06/v201906/). Validering behandler ukjente
 * koder som en advarsel, ikke en hard feil, slik at lokale/nye koder kan brukes.
 */
export interface GrepSubject {
  code: string;
  name: string;
  shortName: string;
}

export const GREP_GRUNNSKOLE_SUBJECTS: readonly GrepSubject[] = [
  { code: "NOR01-06", name: "Norsk", shortName: "NOR" },
  { code: "MAT01-05", name: "Matematikk 1.–10. trinn", shortName: "MAT" },
  { code: "ENG01-04", name: "Engelsk", shortName: "ENG" },
  { code: "NAT01-04", name: "Naturfag", shortName: "NAT" },
  { code: "SAF01-04", name: "Samfunnsfag", shortName: "SAF" },
  { code: "RLE01-03", name: "Kristendom, religion, livssyn og etikk (KRLE)", shortName: "KRLE" },
  { code: "KRO01-05", name: "Kroppsøving", shortName: "KRO" },
  { code: "KHV01-02", name: "Kunst og håndverk", shortName: "K&H" },
  { code: "MUS01-02", name: "Musikk", shortName: "MUS" },
  { code: "MHE01-02", name: "Mat og helse", shortName: "M&H" },
  { code: "FSP01-02", name: "Fremmedspråk", shortName: "FSP" },
  { code: "FAM01-01", name: "Fordypning i matematikk", shortName: "FAM" },
  { code: "UTV01-03", name: "Utdanningsvalg", shortName: "UTV" },
] as const;

const BY_CODE = new Map(
  GREP_GRUNNSKOLE_SUBJECTS.map((s) => [s.code.toUpperCase(), s]),
);

export function getGrepSubject(code: string): GrepSubject | undefined {
  return BY_CODE.get(code.trim().toUpperCase());
}

export function isKnownGrepCode(code: string): boolean {
  return BY_CODE.has(code.trim().toUpperCase());
}

/** Gyldige årstrinn i grunnskolen. */
export const GRUNNSKOLE_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function isValidGrunnskoleGrade(grade: number): boolean {
  return Number.isInteger(grade) && grade >= 1 && grade <= 10;
}
