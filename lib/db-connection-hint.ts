/**
 * Detect Prisma / Mongo driver errors when the database is down or unreachable.
 */
export function isDatabaseUnreachable(error: unknown): boolean {
  const s = String(error);
  return /Connection refused|ECONNREFUSED|Server selection timeout|No available servers|os error 61|getaddrinfo|ENOTFOUND/i.test(
    s,
  );
}

export const DATABASE_UNAVAILABLE_HINT =
  "MongoDB is not reachable. Fix one of: (1) Start local Mongo: `brew services start mongodb-community@7` then `npm run db:mongo:native-init` if needed. (2) Start Docker Desktop and `npm run db:mongo:up`, set DATABASE_URL to port 27018. (3) Use MongoDB Atlas — paste their URI as DATABASE_URL. Then `npm run db:push`.";
