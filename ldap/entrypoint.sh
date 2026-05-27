#!/bin/bash
# Initialiserer slapd (DIT, Feide-skjema, eksempeldata, TLS) ved første
# oppstart og kjører deretter slapd med kryptert LDAPS. Stegene speiler det
# som er verifisert manuelt mot OpenLDAP 2.6.
set -euo pipefail

SUFFIX="${LDAP_BASE_DN:-dc=skole,dc=kommune,dc=no}"
DOMAIN="${LDAP_DOMAIN:-skole.kommune.no}"
ORG="${LDAP_ORG:-Skole kommune}"
ADMIN_PW="${LDAP_ADMIN_PASSWORD:-adminpass}"
LOGLEVEL="${LDAP_LOGLEVEL:-256}"
MARKER=/var/lib/ldap/.feide-initialized

mkdir -p /var/run/slapd
chown -R openldap:openldap /var/run/slapd /var/lib/ldap /etc/ldap/slapd.d

if [ ! -e "$MARKER" ]; then
  echo "==> Førstegangs initialisering av OpenLDAP ($SUFFIX)"
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

  echo "==> Starter midlertidig slapd for lasting"
  slapd -h "ldap://127.0.0.1:389/ ldapi:///" -u openldap -g openldap -F /etc/ldap/slapd.d &
  TMP_PID=$!
  for i in $(seq 1 30); do
    if ldapsearch -x -H ldap://127.0.0.1:389 -b "$SUFFIX" -s base >/dev/null 2>&1; then break; fi
    sleep 1
  done

  echo "==> Laster Feide-skjema"
  ldapadd -Y EXTERNAL -H ldapi:/// -f /schema/feide.ldif -c || true

  echo "==> Laster eksempeldata"
  ldapadd -x -H ldap://127.0.0.1:389 -D "cn=admin,${SUFFIX}" -w "${ADMIN_PW}" -c -f /bootstrap/data.ldif || true

  if [ -f /certs/ldap.crt ] && [ -f /certs/ldap.key ]; then
    echo "==> Konfigurerer TLS"
    mkdir -p /etc/ldap/certs
    cp /certs/ldap.crt /certs/ldap.key /etc/ldap/certs/
    [ -f /certs/ca.crt ] && cp /certs/ca.crt /etc/ldap/certs/ || cp /certs/ldap.crt /etc/ldap/certs/ca.crt
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
    ldapmodify -Y EXTERNAL -H ldapi:/// -f /tmp/tls.ldif
  else
    echo "ADVARSEL: fant ikke /certs/ldap.crt – LDAPS blir ikke konfigurert"
  fi

  kill "$TMP_PID"; wait "$TMP_PID" 2>/dev/null || true
  touch "$MARKER"
  echo "==> Initialisering ferdig"
fi

echo "==> Starter slapd (ldap:// + ldaps:// + ldapi://)"
exec slapd -h "ldap:/// ldaps:/// ldapi:///" -u openldap -g openldap -F /etc/ldap/slapd.d -d "$LOGLEVEL"
