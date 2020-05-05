#!/usr/bin/env bash
set -e

command="${1}"

if [[ "${command}" == "--help" ]]; then
    echo "/entrypoint.sh command"
    exit 0
fi

openssl req -x509 -nodes -sha256 -newkey rsa:2048 \
-keyout /certs/api.key -out /certs/api.crt \
-days 3650 \
-subj "/CN=localhost" \
-reqexts SAN -extensions SAN \
-config <(cat /etc/ssl/openssl.cnf <(printf "\n[SAN]\nsubjectAltName=IP:127.0.0.1,DNS:localhost"))

case ${command} in
    slowapp)
        exec /usr/bin/supervisord -c /src/slowapp/conf/supervisord.ini
    ;;
    *)
      echo "unknown command ${command}"
      exit -1
    ;;
esac
