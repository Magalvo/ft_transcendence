FROM node:22-bookworm-slim AS build

# Toolchain for native modules (bcrypt, sqlite3) when no prebuilt binary fits.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends build-essential python3 \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/auth

COPY package*.json ./
RUN npm ci --no-audit --progress=false

COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
	&& npm prune --omit=dev


FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /usr/src/auth

# Same base image as the build stage, so the compiled native modules match.
COPY --from=build /usr/src/auth/node_modules ./node_modules
COPY --from=build /usr/src/auth/dist ./dist
COPY package.json ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
	&& mkdir -p data public/avatars \
	&& chown -R node:node data public

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "node dist/initDb.js && exec node dist/server.js"]
