# Selvstendig OpenLDAP-image for Feide-katalogen (info_go / grunnskole).
# Bygges fra debian-slim slik at vi ikke er avhengige av tredjeparts
# LDAP-images. Initialiserer katalogen, Feide-skjemaet og eksempeldata ved
# første oppstart, og betjener kryptert LDAPS.
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends slapd ldap-utils openssl \
    && rm -rf /var/lib/apt/lists/*

COPY schema/feide.ldif /schema/feide.ldif
COPY bootstrap/data.ldif /bootstrap/data.ldif
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 389 636

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
