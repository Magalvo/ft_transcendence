FROM node:22-bookworm-slim AS build

WORKDIR /usr/src/gateway

COPY package*.json ./
RUN npm ci --no-audit --progress=false

COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
	&& npm prune --omit=dev


FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /usr/src/gateway

COPY --from=build /usr/src/gateway/node_modules ./node_modules
COPY --from=build /usr/src/gateway/dist ./dist
COPY package.json ./

USER node
EXPOSE 3333
CMD ["node", "dist/server.js"]
