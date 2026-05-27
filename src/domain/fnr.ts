/**
 * Validering av norsk fødselsnummer / D-nummer (11 siffer).
 *
 * Feide bruker fødselsnummer i `norEduPersonNIN` for å koble personer mot
 * nasjonale registre. Sjekklista for god datakvalitet krever at dette feltet
 * er korrekt utfylt og gyldig der det er i bruk. Vi validerer derfor full
 * mod11-kontroll, datodel og D-nummer-varianten.
 */

const K1_WEIGHTS = [3, 7, 6, 1, 8, 9, 4, 5, 2];
const K2_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export type FnrKind = "fnr" | "dnr";

export interface FnrInfo {
  valid: boolean;
  kind?: FnrKind;
  birthDate?: string; // ISO YYYY-MM-DD
  /** YYYYMMDD slik norEduPersonBirthDate forventer */
  birthDateCompact?: string;
  reason?: string;
}

function mod11Check(digits: number[], weights: number[]): number {
  const sum = weights.reduce((acc, w, i) => acc + w * digits[i]!, 0);
  const remainder = sum % 11;
  if (remainder === 0) return 0;
  return 11 - remainder;
}

/**
 * Validerer et fødselsnummer eller D-nummer.
 * Tom/utelatt verdi regnes ikke som gyldig her – kall denne kun når en verdi finnes.
 */
export function inspectFnr(raw: string): FnrInfo {
  const value = raw.trim();
  if (!/^\d{11}$/.test(value)) {
    return { valid: false, reason: "Må være nøyaktig 11 siffer" };
  }

  const digits = value.split("").map((d) => Number(d));

  let day = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const year2 = Number(value.slice(4, 6));

  let kind: FnrKind = "fnr";
  // D-nummer: første siffer er lagt til 4 (dag 41-71).
  if (day > 40) {
    kind = "dnr";
    day -= 40;
  }

  if (month < 1 || month > 12) {
    return { valid: false, reason: "Ugyldig måned i datodelen" };
  }
  if (day < 1 || day > 31) {
    return { valid: false, reason: "Ugyldig dag i datodelen" };
  }

  // Individnummer bestemmer århundre.
  const individ = Number(value.slice(6, 9));
  let century: number;
  if (individ >= 0 && individ <= 499) century = 1900;
  else if (individ >= 500 && individ <= 749 && year2 >= 54) century = 1800;
  else if (individ >= 500 && individ <= 999 && year2 <= 39) century = 2000;
  else if (individ >= 900 && individ <= 999 && year2 >= 40) century = 1900;
  else century = 1900;

  const fullYear = century + year2;
  const date = new Date(Date.UTC(fullYear, month - 1, day));
  if (
    date.getUTCFullYear() !== fullYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { valid: false, reason: "Datodelen er ikke en gyldig dato" };
  }

  const k1 = mod11Check(digits.slice(0, 9), K1_WEIGHTS);
  if (k1 === 10 || k1 !== digits[9]) {
    return { valid: false, reason: "Feil i første kontrollsiffer (mod11)" };
  }
  const k2 = mod11Check(digits.slice(0, 10), K2_WEIGHTS);
  if (k2 === 10 || k2 !== digits[10]) {
    return { valid: false, reason: "Feil i andre kontrollsiffer (mod11)" };
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return {
    valid: true,
    kind,
    birthDate: `${fullYear}-${mm}-${dd}`,
    birthDateCompact: `${fullYear}${mm}${dd}`,
  };
}

export function isValidFnr(raw: string): boolean {
  return inspectFnr(raw).valid;
}
