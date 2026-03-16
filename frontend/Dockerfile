FROM node:22-bookworm-slim AS builder

WORKDIR /usr/src/frontend

COPY package*.json ./
RUN npm ci --legacy-peer-deps --prefer-offline --no-audit --progress=false

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/nginx-selfsigned.key \
    -out /etc/ssl/certs/nginx-selfsigned.crt \
    -subj "/C=PT/ST=Lisbon/L=Lisbon/O=ft_transcendence/CN=localhost"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /usr/src/frontend/dist /usr/share/nginx/html

EXPOSE 80 443
