#!/bin/sh
set -e

# Volumes created by older images are owned by root. Hand them to the
# unprivileged "node" user, then drop root before starting the service.
if [ "$(id -u)" = "0" ]; then
	chown -R node:node /usr/src/auth/data /usr/src/auth/public/avatars

	# Compose secrets are read-only bind mounts that keep the host file's
	# owner and mode. On a Linux host where .secrets/*.txt is 0600 and owned
	# by a uid other than 1000, "node" cannot read them. Copy each *_FILE
	# target to an in-memory directory "node" owns and point the variable there.
	# Only files under /run/secrets: other *_FILE variables (DB_FILE is the
	# writable database) must keep pointing at the real file.
	secrets_dir=/dev/shm/auth-secrets
	install -d -o node -g node -m 700 "$secrets_dir"
	for var in $(env | sed -n 's/^\([A-Za-z0-9_]*_FILE\)=.*/\1/p'); do
		src=$(printenv "$var")
		case "$src" in
			/run/secrets/*) ;;
			*) continue ;;
		esac
		if [ -f "$src" ]; then
			dest="$secrets_dir/$var"
			install -o node -g node -m 400 "$src" "$dest"
			export "$var=$dest"
		fi
	done

	exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

exec "$@"
