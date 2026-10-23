#!/bin/sh
set -e

# Volumes created by older images are owned by root. Hand them to the
# unprivileged "node" user, then drop root before starting the service.
if [ "$(id -u)" = "0" ]; then
	chown -R node:node /usr/src/auth/data /usr/src/auth/public/avatars
	exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

exec "$@"
