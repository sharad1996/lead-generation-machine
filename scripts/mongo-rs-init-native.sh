#!/bin/sh
# Initialize replica set rs0 on local mongod (must be started with replSetName rs0 — see mongo-native-mac.sh).
set -e
PORT="${MONGO_PORT:-27017}"
URI="mongodb://127.0.0.1:${PORT}"
echo "Using $URI"
mongosh "$URI" --quiet --eval '
  try {
    const s = rs.status();
    print("Replica set already configured:", s.set);
  } catch (e) {
    print("Running rs.initiate...");
    rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:'"${PORT}"'" }] });
  }
'
sleep 2
mongosh "$URI" --quiet --eval 'rs.status()'
