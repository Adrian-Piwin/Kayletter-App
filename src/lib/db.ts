import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

// Single connection pool reused across hot reloads in dev.
// SSL is controlled by the connection string (?sslmode=require for Supabase).
const sql =
  globalThis.__sql ??
  postgres(process.env.DATABASE_URL!, {
    max: 5,
    // Supabase pooler (supavisor) in transaction mode doesn't support prepared statements
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") globalThis.__sql = sql;

export default sql;
