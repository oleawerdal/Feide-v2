import { describe, it, expect } from "vitest";
import { inspectFnr, isValidFnr } from "../src/domain/fnr.js";

describe("fødselsnummer-validering", () => {
  it("godtar gyldige fødselsnummer (mod11)", () => {
    expect(isValidFnr("01019000083")).toBe(true);
    expect(isValidFnr("23054700059")).toBe(true);
  });

  it("tolker fødselsdato og århundre korrekt", () => {
    expect(inspectFnr("01019000083").birthDate).toBe("1990-01-01");
    // individnummer 500 + årstall 12 => 2000-tallet
    const child = inspectFnr("15061250090");
    expect(child.valid).toBe(true);
    expect(child.birthDate).toBe("2012-06-15");
    expect(child.birthDateCompact).toBe("20120615");
  });

  it("gjenkjenner D-nummer (dag + 40)", () => {
    const r = inspectFnr("41019000077");
    expect(r.valid).toBe(true);
    expect(r.kind).toBe("dnr");
    expect(r.birthDate).toBe("1990-01-01");
  });

  it("avviser feil lengde og ikke-siffer", () => {
    expect(isValidFnr("0101900008")).toBe(false);
    expect(isValidFnr("0101900008X")).toBe(false);
    expect(isValidFnr("")).toBe(false);
  });

  it("avviser feil kontrollsiffer", () => {
    expect(isValidFnr("01019000084")).toBe(false); // siste siffer endret
    expect(inspectFnr("01019000084").reason).toMatch(/kontrollsiffer/);
  });

  it("avviser ugyldig dato", () => {
    expect(isValidFnr("32019000000")).toBe(false); // dag 32
    expect(isValidFnr("01139000000")).toBe(false); // måned 13
  });
});
