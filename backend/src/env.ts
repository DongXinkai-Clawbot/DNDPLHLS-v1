import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const boolAuto = z.union([z.literal("true"), z.literal("false"), z.literal("auto")]).default("auto");
const sameSite = z.union([z.literal("none"), z.literal("lax"), z.literal("strict"), z.literal("auto")]).default("auto");

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  APP_PUBLIC_URL: z.string().url().default("http://localhost:5173"),
  CORS_ORIGINS: z.string().default(""),

  JWT_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().default(900),

  COOKIE_NAME: z.string().default("refresh_token"),
  COOKIE_SECURE: boolAuto,
  COOKIE_SAMESITE: sameSite,
  COOKIE_DOMAIN: z.string().optional().default(""),

  DATABASE_PATH: z.string().default("./data/app.db"),

  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.string().optional().default(""),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().optional().default("no-reply@example.com"),
});

export type Env = z.infer<typeof schema>;

const loadDotEnv = () => {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "backend/.env"),
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIndex = line.indexOf("=");
      if (eqIndex <= 0) continue;
      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
    break;
  }
};

loadDotEnv();

export const env: Env = schema.parse(process.env);

export function corsOrigins(): string[] {
  const raw = (env.CORS_ORIGINS ?? "").trim();
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

export function isProduction(): boolean {
  return env.NODE_ENV === "production";
}

export function cookieSecure(reqIsHttps: boolean): boolean {
  const v = env.COOKIE_SECURE;
  if (v === "true") return true;
  if (v === "false") return false;
  // auto
  return isProduction() || reqIsHttps;
}

export function cookieSameSite(): "none" | "lax" | "strict" {
  const v = env.COOKIE_SAMESITE;
  if (v === "auto") {
    // safest default for cross-origin auth flows:
    return "none";
  }
  return v;
}

export function publicApiBase(req: any): string {
  const proto = (req.headers["x-forwarded-proto"] ?? req.protocol ?? "http").toString();
  const host = req.headers.host;
  return `${proto}://${host}`;
}
