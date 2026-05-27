#!/usr/bin/env bash
# Genererer et selvsignert TLS-sertifikat for LDAPS (test/utvikling).
# Sertifikatet dekker vertsnavnene 'openldap', 'localhost' og 127.0.0.1, og
# brukes som sin egen CA slik at klienten kan verifisere det (LDAP_CA_FILE).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p certs

if [[ -f certs/ldap.crt && -f certs/ldap.key ]]; then
  echo "certs/ldap.crt finnes allerede – hopper over (slett for å regenerere)"
  exit 0
fi

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/ldap.key \
  -out certs/ldap.crt \
  -days 825 \
  -subj "/C=NO/O=Skole kommune/CN=openldap" \
  -addext "subjectAltName=DNS:openldap,DNS:localhost,IP:127.0.0.1"

cp certs/ldap.crt certs/ca.crt
chmod 644 certs/ldap.crt certs/ca.crt
chmod 640 certs/ldap.key
echo "Skrev certs/ldap.crt, certs/ldap.key og certs/ca.crt"
