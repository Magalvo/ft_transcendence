FROM node:22-bookworm-slim

# Install sqlite runtime and minimal build deps for native modules
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		sqlite3 \
		libsqlite3-dev \
		build-essential \
		python3 \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/auth

# Copy package files first to leverage Docker layer caching for npm installs
COPY package*.json ./

# Use npm ci for reproducible, cached installs (fast on repeated builds)
RUN npm ci --prefer-offline --no-audit --progress=false

# Copy remaining source
COPY . .

ENV NODE_ENV=development

EXPOSE 3000
CMD ["npm", "run", "dev"]
