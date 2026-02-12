import { nanoid } from "nanoid";
import { db } from "./db.js";
import { sha256Base64, randomToken, nowMs, msFromSeconds } from "./crypto.js";
import { signAccessToken } from "./jwt.js";

const MAGIC_TOKEN_TTL_MS = msFromSeconds(15 * 60); // 15 minutes
const REFRESH_TOKEN_TTL_MS = msFromSeconds(30 * 24 * 60 * 60); // 30 days

export type User = { id: string; email: string; created_at: number };

export function getOrCreateUser(email: string): User {
  const database = db();
  const existing = database.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
  if (existing) return existing;
  const user: User = { id: nanoid(), email, created_at: nowMs() };
  database.prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)").run(user.id, user.email, user.created_at);
  return user;
}

export function createMagicToken(email: string): { token: string; id: string; expires_at: number } {
  const token = randomToken(32);
  const id = nanoid();
  const expires_at = nowMs() + MAGIC_TOKEN_TTL_MS;

  db().prepare(
    "INSERT INTO magic_tokens (id, email, token_hash, expires_at) VALUES (?, ?, ?, ?)"
  ).run(id, email, sha256Base64(token), expires_at);

  return { token, id, expires_at };
}

export function consumeMagicToken(email: string, token: string): void {
  const database = db();
  const row = database.prepare(
    "SELECT * FROM magic_tokens WHERE email = ? AND token_hash = ? ORDER BY expires_at DESC LIMIT 1"
  ).get(email, sha256Base64(token)) as any;

  if (!row) throw new Error("Invalid magic token");
  if (row.used_at) throw new Error("Magic token already used");
  if (row.expires_at < nowMs()) throw new Error("Magic token expired");

  database.prepare("UPDATE magic_tokens SET used_at = ? WHERE id = ?").run(nowMs(), row.id);
}

export function createSession(userId: string): { refreshToken: string; sessionId: string; expiresAt: number } {
  const refreshToken = randomToken(48);
  const sessionId = nanoid();
  const createdAt = nowMs();
  const expiresAt = createdAt + REFRESH_TOKEN_TTL_MS;

  db().prepare(
    "INSERT INTO sessions (id, user_id, refresh_token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)"
  ).run(sessionId, userId, sha256Base64(refreshToken), createdAt, expiresAt);

  return { refreshToken, sessionId, expiresAt };
}

export function rotateSession(refreshToken: string): { user: User; newRefreshToken: string; expiresAt: number } {
  const database = db();
  const sess = database.prepare(
    "SELECT * FROM sessions WHERE refresh_token_hash = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1"
  ).get(sha256Base64(refreshToken)) as any;

  if (!sess) throw new Error("Invalid refresh token");
  if (sess.expires_at < nowMs()) throw new Error("Refresh token expired");

  // revoke old
  database.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?").run(nowMs(), sess.id);

  const user = database.prepare("SELECT * FROM users WHERE id = ?").get(sess.user_id) as User | undefined;
  if (!user) throw new Error("User not found");

  const next = createSession(user.id);
  return { user, newRefreshToken: next.refreshToken, expiresAt: next.expiresAt };
}

export function revokeSession(refreshToken: string): void {
  db().prepare("UPDATE sessions SET revoked_at = ? WHERE refresh_token_hash = ? AND revoked_at IS NULL")
    .run(nowMs(), sha256Base64(refreshToken));
}

export function loginWithMagic(email: string, magicToken: string): { user: User; accessToken: string; refreshToken: string } {
  consumeMagicToken(email, magicToken);
  const user = getOrCreateUser(email);
  const session = createSession(user.id);
  const accessToken = signAccessToken(user);
  return { user, accessToken, refreshToken: session.refreshToken };
}
