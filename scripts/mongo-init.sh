#!/bin/sh
# Re-run replica set init against the Docker Mongo container (safe if already PRIMARY).
set -e
docker exec leadmachine-mongo mongosh --quiet --eval \
  'try { rs.status() } catch (e) { rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] }) }'
echo "rs.status():"
docker exec leadmachine-mongo mongosh --quiet --eval 'rs.status()'
