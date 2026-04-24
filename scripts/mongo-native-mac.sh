#!/bin/sh
# Prisma needs MongoDB as a replica set. Use this when Docker is not available.
cat <<'EOF'

=== MongoDB without Docker (macOS) ===

1) Install & start MongoDB Community (Homebrew example):
   brew tap mongodb/brew
   brew install mongodb-community@7
   brew services start mongodb-community@7

2) Enable a replica set name in mongod config, then restart:

   Apple Silicon default config:
     /opt/homebrew/etc/mongod.conf
   Intel Homebrew:
     /usr/local/etc/mongod.conf

   Add this block (same indentation as other top-level keys):

     replication:
       replSetName: "rs0"

   Then:
     brew services restart mongodb-community@7

3) One-time init (run once after the above):
     npm run db:mongo:native-init

4) Use this DATABASE_URL in .env:
     mongodb://127.0.0.1:27017/leadmachine?replicaSet=rs0&directConnection=true

5) Apply schema:
     npm run db:push

--- Cloud (no local Mongo) ---
Create a free cluster at https://www.mongodb.com/cloud/atlas
Use the "Connect" string as DATABASE_URL (do not add replicaSet=rs0 to mongodb+srv URLs).

--- Docker (optional) ---
Start Docker Desktop, then: npm run db:mongo:up
Use port 27018 in DATABASE_URL (see .env.example).

EOF
