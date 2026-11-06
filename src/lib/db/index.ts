import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { databasePath, migrationsDir } from "@/lib/env";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

type Holder = { db?: DB; sqlite?: Database.Database };
const globalForDb = globalThis as unknown as { __kinshiftDb?: Holder };
const holder: Holder = (globalForDb.__kinshiftDb ??= {});

function open(): DB {
  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Best effort: some mounted volumes do not support chmod.
  }
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: migrationsDir() });
  holder.sqlite = sqlite;
  return db;
}

/** Lazily opened, migrated database connection shared by the whole server. */
export function getDb(): DB {
  holder.db ??= open();
  return holder.db;
}

export function getSqlite(): Database.Database {
  getDb();
  return holder.sqlite!;
}

export { schema };
