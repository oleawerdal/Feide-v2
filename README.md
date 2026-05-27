# Feide brukerkatalog – administrasjonsportal

Webbasert, sikker portal for å forvalte en Feide-brukerkatalog (LDAP) for
**grunnskolen** – en erstatning for å redigere katalogen direkte i Apache
Directory Studio. Portalen følger Feides LDAP-skjemaer (info_go) og håndhever
kravene i Feides «Sjekkliste for god datakvalitet».

> Datamodell og validering er bygget etter eduPerson-, norEdu*- og
> SCHAC-spesifikasjonene samt Feides info_go-gruppemodell. Se
> [Samsvar med Feide](#samsvar-med-feide) for nøyaktig avbildning.

## Hva du får

- **Personadministrasjon** – opprett/rediger/slett elever og ansatte med full
  validering (eduPPN, fødselsnummer med mod11, tilknytninger, realm m.m.).
- **Gruppeadministrasjon** – alle gruppetypene i info_go:
  **basisgrupper (klasser)**, undervisningsgrupper (med GREP-fagkoder),
  trinngrupper, skolegruppe og «andre»-grupper. Medlemshåndtering med søk.
- **Datakvalitetsrapport** – kontinuerlig kontroll mot Feide-kravene med score
  og konkrete avvik (feil/advarsler).
- **Sikkerhet** – kryptert LDAPS mot katalogen, innlogging via LDAP-bind
  begrenset til administratorgruppe, sesjonscookies (httpOnly/SameSite),
  CSRF-vern, rate limiting, Helmet/CSP og valgfri HTTPS.
- **Testbart lokalt** – komplett OpenLDAP med Feide-skjema og eksempeldata
  (en hel grunnskole med klasser for alle trinn) via Docker eller natively.

## Arkitektur

```
Nettleser (SPA, vanilla JS)
        │ HTTPS + CSRF + sesjon
        ▼
Express-API (TypeScript)
  ├─ domain/      Feide-datamodell + Zod-validering (fnr, eduPPN, grep, gruppetyper)
  ├─ quality/     Datakvalitetsmotor (sjekklista)
  ├─ ldap/        ldapts-klient + person-/gruppe-repositorier (LDAPS)
  └─ web/         auth, csrf, ruter, feilhåndtering
        │ LDAPS (kryptert)
        ▼
OpenLDAP (info_go-skjema)
```

## Kom i gang

Krever Node ≥ 20. For testkatalogen: Docker (anbefalt) eller Debian/Ubuntu med
`slapd` (native-varianten).

```bash
npm install
npm run certs          # selvsignert TLS-sertifikat for LDAPS (test)
cp .env.example .env    # juster ved behov

# Alternativ A – Docker (bygger et selvstendig OpenLDAP-image):
npm run ldap:up

# Alternativ B – uten Docker (Debian/Ubuntu, krever sudo):
npm run ldap:native

npm run dev             # starter portalen på http://localhost:8443
```

Logg inn med den ferdige administratorkontoen fra eksempeldataene:

| Brukernavn    | Passord     | Rolle                       |
| ------------- | ----------- | --------------------------- |
| `admin.skole` | `Admin123!` | Medlem av `feide-admins`    |

Lærerkontoene (`Laerer123!`) finnes også, men avvises ved innlogging fordi de
ikke er administratorer – nyttig for å teste tilgangskontrollen.

## Testing

```bash
npm test               # enhetstester (fnr, eduPPN, person/gruppe-schema, datakvalitet)
npm run typecheck      # streng TypeScript-sjekk
npm run test:integration   # CRUD mot kjørende OpenLDAP (krever ldap:up/ldap:native)
```

Enhetstestene dekker domenelogikken (mod11-validering, eduPPN, GREP-koder,
gruppetyper) og datakvalitetsmotoren. Integrasjonstesten kjører faktisk
person-/gruppe-CRUD og en datakvalitetsrapport mot LDAPS.

## Samsvar med Feide

### Personer (objektklasser `inetOrgPerson` + `feidePerson`)

| Felt                          | Krav / validering                                              |
| ----------------------------- | -------------------------------------------------------------- |
| `eduPersonPrincipalName`      | `bruker@realm`, unik og varig (sjekkes for duplikater)         |
| `eduPersonAffiliation`        | Kontrollert vokabular (student, employee, faculty, staff, …)   |
| `eduPersonPrimaryAffiliation` | Må finnes i tilknytningslisten                                 |
| `cn`, `sn`, `givenName`, `displayName` | Påkrevd; `cn` avledes om den mangler                  |
| `mail`                        | Validert e-postadresse                                         |
| `norEduPersonNIN`             | Fødselsnummer/D-nummer med full mod11-kontroll og datovalidering |
| `schacHomeOrganization`       | Realm; må stemme med realm i eduPPN                            |

### Grupper (objektklasse `gogroup`, attributtet `goType`)

| `goType`       | Norsk navn                  | Krav                          |
| -------------- | --------------------------- | ----------------------------- |
| `basis`        | Basisgruppe (klasse)        | Årstrinn (1–10)               |
| `undervisning` | Undervisningsgruppe (fag)   | GREP-fagkode                  |
| `trinn`        | Trinn / årstrinn            | Årstrinn (1–10)               |
| `skole`        | Skolegruppe                 | –                             |
| `andre`        | Andre grupper               | –                             |

### Datakvalitetssjekker (utdrag)

Personer: manglende/ugyldig eduPPN, dupliserte eduPPN/uid/fnr, manglende navn,
e-post, tilknytning, primær tilknytning utenfor listen, elever uten fnr.
Grupper: ukjent gruppetype, manglende GREP/årstrinn, foreldreløse medlemmer
(peker ikke på en reell person), basisgruppe uten elever/kontaktlærer.
Kryss: hver elev skal være i nøyaktig **én** basisgruppe.

> **OID-er og attributtnavn:** `eduPerson*`, `norEduPerson*` og `schac*` bruker
> de offisielle OID-ene. `go*`-attributtene bruker en privat OID-arc i denne
> testkatalogen (`ldap/schema/feide.ldif`). Avbildningen mellom datamodellen og
> LDAP-attributtene ligger samlet i `src/ldap/*.repository.ts`, slik at navn
> enkelt kan justeres mot en eksisterende produksjonskatalog.

## Koble til en eksisterende katalog

Sett LDAP-variablene i `.env` (se `.env.example`) mot deres egen katalog. Bruk
alltid `ldaps://` og pek `LDAP_CA_FILE` mot riktig CA. Innlogging styres av
`LDAP_ADMIN_GROUP_DN`. I produksjon: sett `NODE_ENV=production`, en sterk
`SESSION_SECRET`, og terminer HTTPS (enten `TLS_CERT_FILE`/`TLS_KEY_FILE` eller
en proxy foran).

## Sikkerhetsnotater

- All katalogtrafikk går over LDAPS; sertifikatet verifiseres mot CA.
- Brukerinput escapes for både LDAP-filtre (RFC 4515) og DN-er (RFC 4514).
- Passord og fødselsnummer redaktes i logger.
- Sesjons-ID fornyes ved innlogging (mot session fixation).
- Selvsignerte sertifikater og standardpassord her er **kun for test** – bytt
  dem ut i produksjon.
