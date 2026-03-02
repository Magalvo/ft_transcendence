FROM node:18-bullseye-slim

WORKDIR /usr/src/frontend

# Cache dependency install
COPY package*.json ./
RUN npm ci --legacy-peer-deps --prefer-offline --no-audit --progress=false

# Copy app source
COPY . .

ENV NODE_ENV=development

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
