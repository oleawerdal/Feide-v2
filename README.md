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

## Deploy i Coolify

Coolify terminerer HTTPS via sin egen proxy (Traefik + Let's Encrypt), så
portalen kjører HTTP internt i containeren. Appen har `trust proxy` påslått,
slik at `secure`-cookies fungerer bak proxyen når `NODE_ENV=production`.

### Alternativ 1 – Produksjon: portalen mot eksisterende katalog (anbefalt)

Dere har allerede en Feide-katalog. Da deployer dere kun portalen:

1. **New Resource → Application → fra Git-repoet**, branch som ønsket.
2. Build pack: **Dockerfile** (repoet har en `Dockerfile` i rot).
3. **Port**: `8443` (Exposed/Ports i Coolify).
4. Sett **domene** på applikasjonen → Coolify ordner TLS automatisk.
5. **Environment variables** (Coolify → Environment):

   ```
   NODE_ENV=production
   PORT=8443
   LDAP_URL=ldaps://din-ldap-host:636
   LDAP_BIND_DN=cn=service,dc=...      # tjenestekonto med lesetilgang
   LDAP_BIND_PASSWORD=********          # marker som secret
   LDAP_BASE_DN=dc=...
   LDAP_PEOPLE_OU=ou=people
   LDAP_GROUPS_OU=ou=groups
   LDAP_ADMIN_GROUP_DN=cn=feide-admins,ou=groups,dc=...
   LDAP_CA_FILE=/app/certs/ca.crt       # eller LDAP_TLS_REJECT_UNAUTHORIZED=false
   REALM=din.realm.no
   SESSION_SECRET=<openssl rand -hex 32>   # marker som secret
   ```

   Trenger katalogen en egen CA, legg `ca.crt` inn som en **mounted file** i
   Coolify (f.eks. `/app/certs/ca.crt`) og pek `LDAP_CA_FILE` dit. Appen krever
   `ldaps://` og en sterk `SESSION_SECRET` i produksjon (den nekter å starte
   ellers).

6. Healthcheck-sti: `/healthz`.

### Alternativ 2 – Test/demo: hele stacken (portal + OpenLDAP)

1. **New Resource → Docker Compose → fra Git-repoet**.
2. Velg compose-fil **`docker-compose.coolify.yml`**.
3. Sett env: `SESSION_SECRET` og `LDAP_ADMIN_PASSWORD` (begge som secret).
4. Knytt domenet til **`portal`**-tjenesten (port `8443`).

OpenLDAP-containeren genererer sitt eget selvsignerte sertifikat og deler det
med portalen via et internt volum, så intern LDAPS er kryptert og verifisert.
Innlogging: `admin.skole` / `Admin123!` (bytt før reell bruk).

### Feilsøking: «Bad Gateway»

Bad Gateway betyr at Coolifys proxy (Traefik) ikke finner riktig container-port
– appen lytter på **8443**, mens proxyen som standard prøver port 80/3000.
I apploggen ser du da kun `/healthz`-treff fra `user-agent: node` (containerens
egen helsesjekk), ingen trafikk fra nettleseren.

- **Dockerfile-app (Alternativ 1):** sett **Ports Exposes = `8443`** i Coolify
  (Configuration → Network), og knytt domenet til den porten.
- **Docker Compose (Alternativ 2):** `portal`-tjenesten setter
  `SERVICE_FQDN_PORTAL_8443`, som forteller Coolify at domenet skal rutes til
  port 8443. Sørg for at domenet er knyttet til **`portal`**, ikke `openldap`.

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
