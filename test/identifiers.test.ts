import { describe, it, expect } from "vitest";
import {
  buildEduPpn,
  goGroupEntitlement,
  isValidEduPpn,
  isValidRealm,
  isValidUid,
  parseEduPpn,
  schacPersonalUniqueId,
} from "../src/domain/identifiers.js";

describe("identifikatorer", () => {
  it("validerer realm", () => {
    expect(isValidRealm("skole.kommune.no")).toBe(true);
    expect(isValidRealm("feide.no")).toBe(true);
    expect(isValidRealm("nodot")).toBe(false);
    expect(isValidRealm("-bad.no")).toBe(false);
  });

  it("validerer uid", () => {
    expect(isValidUid("ola.nordmann")).toBe(true);
    expect(isValidUid("elev_01")).toBe(true);
    expect(isValidUid(".bad")).toBe(false);
    expect(isValidUid("med mellomrom")).toBe(false);
  });

  it("parser og validerer eduPPN", () => {
    expect(isValidEduPpn("ola@skole.kommune.no")).toBe(true);
    expect(parseEduPpn("ola@skole.kommune.no")).toEqual({
      uid: "ola",
      realm: "skole.kommune.no",
    });
    expect(isValidEduPpn("ola")).toBe(false);
    expect(isValidEduPpn("ola@@skole.no")).toBe(false);
    expect(isValidEduPpn("@skole.no")).toBe(false);
  });

  it("bygger eduPPN i lowercase", () => {
    expect(buildEduPpn("Ola", "Skole.No")).toBe("ola@skole.no");
  });

  it("bygger SCHAC- og entitlement-URN-er", () => {
    expect(schacPersonalUniqueId("01019000083")).toBe(
      "urn:mace:terena.org:schac:personalUniqueID:no:NO:FNR:01019000083",
    );
    expect(goGroupEntitlement("b", "skole.no", "7a")).toBe(
      "urn:mace:feide.no:go:group:b:skole.no:7a",
    );
  });
});
