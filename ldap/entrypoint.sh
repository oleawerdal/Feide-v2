#!/bin/bash
# Initialiserer slapd og sikrer at TLS/LDAPS alltid er konfigurert.
#
# Databaseinit (dpkg-reconfigure) og lasting av eksempeldata skjer KUN første
# gang (gated av en markør i datavolumet). Sertifikat og TLS-konfigurasjon
# sikres derimot ved HVER oppstart, slik at en katalog fra en tidligere deploy
# uten TLS «selvheler» ved redeploy. Stegene speiler det som er verifisert mot
# OpenLDAP 2.6.
set -euo pipefail

SUFFIX="${LDAP_BASE_DN:-dc=skole,dc=kommune,dc=no}"
DOMAIN="${LDAP_DOMAIN:-skole.kommune.no}"
ORG="${LDAP_ORG:-Skole kommune}"
ADMIN_PW="${LDAP_ADMIN_PASSWORD:-adminpass}"
LOGLEVEL="${LDAP_LOGLEVEL:-256}"
TLS_CN="${LDAP_TLS_CN:-openldap}"
DB_MARKER=/var/lib/ldap/.feide-initialized

mkdir -p /var/run/slapd
chown -R openldap:openldap /var/run/slapd /var/lib/ldap /etc/ldap/slapd.d

FIRST_INIT=0
if [ ! -e "$DB_MARKER" ]; then
  FIRST_INIT=1
  echo "==> Førstegangs initialisering av databasen ($SUFFIX)"
  cat <<EOF | debconf-set-selections
slapd slapd/no_configuration boolean false
slapd slapd/domain string ${DOMAIN}
slapd shared/organization string ${ORG}
slapd slapd/password1 password ${ADMIN_PW}
slapd slapd/password2 password ${ADMIN_PW}
slapd slapd/backend select MDB
slapd slapd/purge_database boolean true
slapd slapd/move_old_database boolean true
slapd slapd/allow_ldap_v2 boolean false
EOF
  dpkg-reconfigure -f noninteractive slapd
fi

# Generer selvsignert sertifikat hvis ingen er montert og /certs er skrivbar.
if [ ! -f /certs/ldap.crt ] && ( : > /certs/.wtest 2>/dev/null ); then
  rm -f /certs/.wtest
  echo "==> Genererer selvsignert TLS-sertifikat (CN=${TLS_CN})"
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout /certs/ldap.key -out /certs/ldap.crt -days 825 \
    -subj "/C=NO/O=${ORG}/CN=${TLS_CN}" \
    -addext "subjectAltName=DNS:${TLS_CN},DNS:localhost,IP:127.0.0.1"
  cp /certs/ldap.crt /certs/ca.crt
fi

# Midlertidig slapd for å sikre skjema, (eventuelt data) og TLS – idempotent.
echo "==> Sikrer skjema og TLS via midlertidig slapd"
slapd -h "ldap://127.0.0.1:389/ ldapi:///" -u openldap -g openldap -F /etc/ldap/slapd.d &
TMP_PID=$!
for i in $(seq 1 30); do
  if ldapsearch -x -H ldap://127.0.0.1:389 -b "$SUFFIX" -s base >/dev/null 2>&1; then break; fi
  sleep 1
done

ldapadd -Y EXTERNAL -H ldapi:/// -c -f /schema/feide.ldif >/dev/null 2>&1 || true

if [ "$FIRST_INIT" = "1" ]; then
  echo "==> Laster eksempeldata"
  ldapadd -x -H ldap://127.0.0.1:389 -D "cn=admin,${SUFFIX}" -w "${ADMIN_PW}" -c -f /bootstrap/data.ldif || true
fi

TLS_OK=0
if [ -f /certs/ldap.crt ] && [ -f /certs/ldap.key ]; then
  echo "==> Konfigurerer TLS"
  mkdir -p /etc/ldap/certs
  cp /certs/ldap.crt /certs/ldap.key /etc/ldap/certs/
  if [ -f /certs/ca.crt ]; then cp /certs/ca.crt /etc/ldap/certs/ca.crt; else cp /certs/ldap.crt /etc/ldap/certs/ca.crt; fi
  chown -R openldap:openldap /etc/ldap/certs
  chmod 600 /etc/ldap/certs/ldap.key
  cat > /tmp/tls.ldif <<EOF
dn: cn=config
changetype: modify
replace: olcTLSCertificateFile
olcTLSCertificateFile: /etc/ldap/certs/ldap.crt
-
replace: olcTLSCertificateKeyFile
olcTLSCertificateKeyFile: /etc/ldap/certs/ldap.key
-
replace: olcTLSCACertificateFile
olcTLSCACertificateFile: /etc/ldap/certs/ca.crt
EOF
  if ldapmodify -Y EXTERNAL -H ldapi:/// -f /tmp/tls.ldif; then TLS_OK=1; fi
else
  echo "ADVARSEL: fant ikke /certs/ldap.crt – LDAPS deaktiveres"
fi

kill "$TMP_PID" 2>/dev/null || true
wait "$TMP_PID" 2>/dev/null || true
if [ "$FIRST_INIT" = "1" ]; then touch "$DB_MARKER"; fi

if [ "$TLS_OK" = "1" ]; then
  LISTENERS="ldap:/// ldaps:/// ldapi:///"
else
  LISTENERS="ldap:/// ldapi:///"
fi
echo "==> Starter slapd ($LISTENERS)"
exec slapd -h "$LISTENERS" -u openldap -g openldap -F /etc/ldap/slapd.d -d "$LOGLEVEL"
