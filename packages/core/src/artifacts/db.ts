import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../schema/drizzle/schema.js";

const INDEX_DB_FILENAME = "index.sqlite";

const migrationsFolder = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../migrations",
);

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export function openDb(gitchangeDir: string): DrizzleDb {
  mkdirSync(gitchangeDir, { recursive: true });

  const dbPath = join(gitchangeDir, INDEX_DB_FILENAME);
  const client = new Database(dbPath);
  client.pragma("journal_mode = WAL");
  client.pragma("synchronous = NORMAL");
  client.pragma("cache_size = -64000");
  client.pragma("mmap_size = 268435456");

  const db = drizzle({ client, schema });
  migrate(db, { migrationsFolder });

  return db;
}
