FROM nginx:1.27-alpine

# Install OpenSSL
RUN apk add --no-cache openssl

# Generate a Self-Signed SSL Certificate
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/nginx-selfsigned.key \
    -out /etc/ssl/certs/nginx-selfsigned.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Copy our custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html

COPY . .

EXPOSE 80 443
