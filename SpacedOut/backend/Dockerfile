FROM node:20-bookworm-slim

WORKDIR /app

# Toolchain required to compile the native addon (combat.cpp via node-gyp).
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ git \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci \
    && npm install --no-save node-gyp

COPY . .
RUN npx node-gyp rebuild

EXPOSE 3000

CMD ["node", "server.js"]
