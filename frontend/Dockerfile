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

# The nginx image renders /etc/nginx/templates/*.template with envsubst at
# startup. PUBLIC_HTTPS_PORT must match the host port mapped to 443.
ENV PUBLIC_HTTPS_PORT=8443
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /usr/src/frontend/dist /usr/share/nginx/html

EXPOSE 80 443
