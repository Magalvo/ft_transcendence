#!/bin/bash

echo "=== Docker Containers Status ==="
docker ps

echo -e "\n=== Auth Container Logs ==="
docker logs Auth 2>&1 | tail -50

echo -e "\n=== Gateway Container Logs ==="
docker logs ApiGateWay 2>&1 | tail -20

echo -e "\n=== Test Auth Service ==="
docker exec Auth curl -s http://localhost:3000/ok || echo "Auth service not responding"

echo -e "\n=== Test Gateway Service ==="
curl -s http://localhost:3333/ || echo "Gateway not responding"

echo -e "\n=== Check Auth .env file ==="
if [ -f "backend/Auth/.env" ]; then
  grep -E "JWT_SECRET|DB_" backend/Auth/.env || echo "No env vars found"
else
  echo "backend/Auth/.env not found!"
fi
