/**
 * Gruppetyper for grunnopplæringen (Feide info_go), uttrykt gjennom
 * attributtet `goType` på objektklassen `gogroup`.
 *
 * Disse dekker alle klassegruppene/skolegruppene Feide opererer med i
 * grunnskolen. Hver type angir om en GREP-kode (fag/læreplan) og et
 * årstrinn forventes, slik datakvalitetssjekken kan håndheve det.
 *
 * `urnCode` er den korte koden som brukes når gruppe-ID-en registreres i
 * eduPersonEntitlement (urn:mace:feide.no:go:group:<urnCode>:...).
 */
export interface GoGroupTypeDef {
  type: string;
  urnCode: string;
  label: string;
  description: string;
  /** Krever GREP-fagkode (gjelder undervisningsgrupper). */
  requiresGrep: boolean;
  /** Krever årstrinn (goGrade). */
  requiresGrade: boolean;
}

export const GO_GROUP_TYPES: readonly GoGroupTypeDef[] = [
  {
    type: "basis",
    urnCode: "b",
    label: "Basisgruppe (klasse)",
    description:
      "Klassen en elev tilhører, med kontaktlærer(e). Hver elev skal ligge i nøyaktig én basisgruppe.",
    requiresGrep: false,
    requiresGrade: true,
  },
  {
    type: "undervisning",
    urnCode: "u",
    label: "Undervisningsgruppe (fag)",
    description:
      "Gruppe knyttet til opplæring i et fag, med tilhørende GREP-fagkode.",
    requiresGrep: true,
    requiresGrade: false,
  },
  {
    type: "trinn",
    urnCode: "t",
    label: "Trinn / årstrinn",
    description: "Alle elever på samme årstrinn (1.–10. trinn).",
    requiresGrep: false,
    requiresGrade: true,
  },
  {
    type: "skole",
    urnCode: "s",
    label: "Skolegruppe",
    description: "Alle ved skolen / organisasjonsenheten.",
    requiresGrep: false,
    requiresGrade: false,
  },
  {
    type: "andre",
    urnCode: "a",
    label: "Andre grupper",
    description:
      "Grupper utenfor GREP-rammeverket, f.eks. leksehjelp, prosjekt- eller aktivitetsgrupper.",
    requiresGrep: false,
    requiresGrade: false,
  },
] as const;

export const GO_GROUP_TYPE_VALUES = GO_GROUP_TYPES.map((g) => g.type);

const BY_TYPE = new Map(GO_GROUP_TYPES.map((g) => [g.type, g]));

export function getGroupTypeDef(type: string): GoGroupTypeDef | undefined {
  return BY_TYPE.get(type);
}

export function isGoGroupType(type: string): boolean {
  return BY_TYPE.has(type);
}
