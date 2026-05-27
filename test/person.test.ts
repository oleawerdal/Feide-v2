import { describe, it, expect } from "vitest";
import { personInputSchema, normalizePerson } from "../src/domain/person.js";

const base = {
  uid: "ola.nordmann",
  eduPersonPrincipalName: "ola.nordmann@skole.kommune.no",
  givenName: "Ola",
  sn: "Nordmann",
  displayName: "Ola Nordmann",
  mail: "ola@skole.kommune.no",
  eduPersonAffiliation: ["student"],
  eduPersonPrimaryAffiliation: "student",
  schacHomeOrganization: "skole.kommune.no",
  norEduPersonNIN: "15061250090",
};

describe("person-schema", () => {
  it("godtar en gyldig elev", () => {
    const res = personInputSchema.safeParse(base);
    expect(res.success).toBe(true);
  });

  it("avleder cn fra navn når det mangler", () => {
    const person = normalizePerson(personInputSchema.parse(base));
    expect(person.cn).toBe("Ola Nordmann");
  });

  it("avviser ugyldig eduPPN", () => {
    const res = personInputSchema.safeParse({ ...base, eduPersonPrincipalName: "ola" });
    expect(res.success).toBe(false);
  });

  it("krever at primær tilknytning finnes i listen", () => {
    const res = personInputSchema.safeParse({
      ...base,
      eduPersonAffiliation: ["student"],
      eduPersonPrimaryAffiliation: "employee",
    });
    expect(res.success).toBe(false);
  });

  it("krever at realm i eduPPN matcher schacHomeOrganization", () => {
    const res = personInputSchema.safeParse({
      ...base,
      schacHomeOrganization: "annen.skole.no",
    });
    expect(res.success).toBe(false);
  });

  it("avviser ugyldig fødselsnummer", () => {
    const res = personInputSchema.safeParse({ ...base, norEduPersonNIN: "12345678901" });
    expect(res.success).toBe(false);
  });

  it("tillater person uten fødselsnummer", () => {
    const { norEduPersonNIN, ...rest } = base;
    const res = personInputSchema.safeParse(rest);
    expect(res.success).toBe(true);
  });
});
