import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "./env.js";

export type DB = Database.Database;

let _db: DB | null = null;

export function db(): DB {
  if (_db) return _db;

  const dbPath = env.DATABASE_PATH;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS magic_tokens (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      refresh_token_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_magic_tokens_email ON magic_tokens(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);

  _db = database;
  return database;
}
