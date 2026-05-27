#!/usr/bin/env bash
# Setter opp en lokal OpenLDAP UTEN Docker (Debian/Ubuntu). Installerer slapd,
# laster Feide-skjemaet og eksempeldataene, konfigurerer LDAPS og starter
# slapd på port 1389 (ldap) og 1636 (ldaps). Krever root.
#
# Dette er det samme oppsettet som docker-compose bygger – nyttig der Docker
# ikke er tilgjengelig.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ $EUID -ne 0 ]]; then echo "Kjør som root (sudo)." >&2; exit 1; fi

SUFFIX="dc=skole,dc=kommune,dc=no"
ADMIN_PW="adminpass"
LDAPI="ldapi://%2Fvar%2Frun%2Fslapd%2Fldapi/"

if ! command -v slapd >/dev/null; then
  echo "==> Installerer slapd + ldap-utils"
  cat <<EOF | debconf-set-selections
slapd slapd/no_configuration boolean false
slapd slapd/domain string skole.kommune.no
slapd shared/organization string Skole kommune
slapd slapd/password1 password ${ADMIN_PW}
slapd slapd/password2 password ${ADMIN_PW}
slapd slapd/backend select MDB
slapd slapd/purge_database boolean true
slapd slapd/move_old_database boolean true
EOF
  DEBIAN_FRONTEND=noninteractive apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y slapd ldap-utils
fi

if [[ ! -f certs/ldap.crt ]]; then bash scripts/gen-certs.sh; fi
mkdir -p /etc/ldap/certs
cp certs/ldap.crt certs/ldap.key certs/ca.crt /etc/ldap/certs/
chown -R openldap:openldap /etc/ldap/certs && chmod 600 /etc/ldap/certs/ldap.key

mkdir -p /var/run/slapd && chown openldap:openldap /var/run/slapd
pkill -x slapd 2>/dev/null || true; sleep 1

echo "==> Starter slapd for lasting"
slapd -h "ldap://127.0.0.1:1389/ $LDAPI" -F /etc/ldap/slapd.d -u openldap -g openldap
sleep 2

echo "==> Laster Feide-skjema"
ldapadd -Y EXTERNAL -H "$LDAPI" -f ldap/schema/feide.ldif -c 2>&1 | grep -vi "already exists" || true

echo "==> Laster eksempeldata"
ldapadd -x -H ldap://127.0.0.1:1389 -D "cn=admin,${SUFFIX}" -w "$ADMIN_PW" -c -f ldap/bootstrap/data.ldif 2>&1 | grep -vi "already exists" || true

echo "==> Konfigurerer TLS"
cat > /tmp/feide-tls.ldif <<EOF
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
ldapmodify -Y EXTERNAL -H "$LDAPI" -f /tmp/feide-tls.ldif

echo "==> Starter slapd på nytt med LDAPS (1636)"
pkill -x slapd; sleep 1
slapd -h "ldap://127.0.0.1:1389/ ldaps://127.0.0.1:1636/ $LDAPI" -F /etc/ldap/slapd.d -u openldap -g openldap
sleep 2

echo "==> Klar. Test:"
echo "    LDAPTLS_CACERT=\$PWD/certs/ca.crt ldapwhoami -x -H ldaps://127.0.0.1:1636 -D cn=admin,${SUFFIX} -w ${ADMIN_PW}"
