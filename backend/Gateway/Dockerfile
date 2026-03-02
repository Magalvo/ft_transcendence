FROM node:18-bullseye-slim

# Install sqlite runtime and build deps if needed
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		sqlite3 \
		libsqlite3-dev \
		build-essential \
		python3 \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/gateway

# Cache dependencies layer
COPY package*.json ./
RUN npm ci --legacy-peer-deps --prefer-offline --no-audit --progress=false

# Copy source
COPY . .

ENV NODE_ENV=development

EXPOSE 3333
CMD ["npm", "run", "dev"]
