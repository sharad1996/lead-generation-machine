#!/bin/sh
# Show replica set status: Docker container if present, else local mongosh.
set -e
PORT="${MONGO_PORT:-27017}"
if docker info >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^leadmachine-mongo$'; then
  echo "=== Docker container leadmachine-mongo ==="
  docker exec leadmachine-mongo mongosh --quiet --eval 'try{rs.status()}catch(e){print(e)}'
else
  echo "=== Local mongosh (127.0.0.1:${PORT}) — Docker not used or daemon not running ==="
  if command -v mongosh >/dev/null 2>&1; then
    mongosh "mongodb://127.0.0.1:${PORT}" --quiet --eval 'try{rs.status()}catch(e){print(e)}' || true
  else
    echo "mongosh not found. Install: brew install mongosh"
  fi
fi
