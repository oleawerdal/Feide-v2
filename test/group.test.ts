import { describe, it, expect } from "vitest";
import { groupInputSchema, normalizeGroup } from "../src/domain/group.js";

const basis = {
  cn: "7a-2025",
  displayName: "7A",
  goType: "basis",
  goGrade: 7,
  schacHomeOrganization: "skole.kommune.no",
  members: [],
};

describe("gruppe-schema", () => {
  it("godtar en basisgruppe (klasse) med årstrinn", () => {
    expect(groupInputSchema.safeParse(basis).success).toBe(true);
  });

  it("avviser basisgruppe uten årstrinn", () => {
    const { goGrade, ...rest } = basis;
    expect(groupInputSchema.safeParse(rest).success).toBe(false);
  });

  it("avviser ugyldig årstrinn for grunnskolen", () => {
    expect(groupInputSchema.safeParse({ ...basis, goGrade: 13 }).success).toBe(false);
  });

  it("krever GREP-kode på undervisningsgruppe", () => {
    const res = groupInputSchema.safeParse({
      cn: "mat-7a",
      displayName: "Matematikk 7A",
      goType: "undervisning",
      schacHomeOrganization: "skole.kommune.no",
      members: [],
    });
    expect(res.success).toBe(false);
  });

  it("godtar undervisningsgruppe med GREP-kode", () => {
    const res = groupInputSchema.safeParse({
      cn: "mat-7a",
      displayName: "Matematikk 7A",
      goType: "undervisning",
      goGrep: "MAT01-05",
      schacHomeOrganization: "skole.kommune.no",
      members: [],
    });
    expect(res.success).toBe(true);
  });

  it("avviser ukjent gruppetype", () => {
    expect(groupInputSchema.safeParse({ ...basis, goType: "tullegruppe" }).success).toBe(false);
  });

  it("validerer skoleår-format", () => {
    expect(groupInputSchema.safeParse({ ...basis, schoolYear: "2025/2026" }).success).toBe(true);
    expect(groupInputSchema.safeParse({ ...basis, schoolYear: "25/26" }).success).toBe(false);
  });

  it("fjerner duplikate medlemmer", () => {
    const g = normalizeGroup(
      groupInputSchema.parse({ ...basis, members: ["a@skole.no", "a@skole.no", "b@skole.no"] }),
    );
    expect(g.members).toEqual(["a@skole.no", "b@skole.no"]);
  });
});
