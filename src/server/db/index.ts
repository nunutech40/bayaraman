import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== "test") {
  throw new Error("DATABASE_URL is required outside tests");
}

export const pool = new Pool({
  connectionString: connectionString ?? "postgresql://localhost/test"
});

export const db = drizzle(pool, { schema });
