import crypto from "node:crypto";

export function sha256Base64(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("base64");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function nowMs(): number {
  return Date.now();
}

export function msFromSeconds(s: number): number {
  return s * 1000;
}
