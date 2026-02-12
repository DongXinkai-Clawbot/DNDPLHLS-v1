import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env, corsOrigins, cookieSameSite, cookieSecure } from "./env.js";
import { router } from "./routes.js";

const app = express();
app.set("trust proxy", true);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const allowlist = corsOrigins();
app.use(cors({
  origin: (origin, cb) => {
    // Allow non-browser tools (no Origin) and same-origin requests
    if (!origin) return cb(null, true);
    if (allowlist.length === 0) return cb(null, true); // dev friendly
    if (allowlist.includes(origin)) return cb(null, true);
    return cb(new Error("CORS blocked"), false);
  },
  credentials: true,
}));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Attach cookie after auth routes that set res.locals.refreshToken / clearRefresh
app.use((req, res, next) => {
  const _json = res.json.bind(res);
  res.json = (body: any) => {
    const isHttps = (req.headers["x-forwarded-proto"] === "https") || req.secure;
    const sameSite = cookieSameSite();
    const secure = cookieSecure(Boolean(isHttps)) || sameSite === "none";
    const domain = env.COOKIE_DOMAIN?.trim() || undefined;

    if (res.locals.clearRefresh) {
      res.clearCookie(env.COOKIE_NAME, { httpOnly: true, sameSite, secure, path: "/", domain });
    } else if (res.locals.refreshToken) {
      res.cookie(env.COOKIE_NAME, res.locals.refreshToken, {
        httpOnly: true,
        sameSite,
        secure,
        path: "/",
        domain,
        // 30d
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }
    return _json(body);
  };
  next();
});

app.use("/v1", router);

app.use((err: any, _req: any, res: any, _next: any) => {
  // CORS / unexpected errors
  const msg = String(err?.message ?? err ?? "Unknown error");
  if (msg.includes("CORS blocked")) {
    return res.status(403).json({ ok: false, error: "CORS blocked", detail: msg, allowlist });
  }
  return res.status(500).json({ ok: false, error: "Server error", detail: msg });
});

app.listen(env.PORT, () => {
  console.log(`[backend] listening on http://localhost:${env.PORT}`);
  console.log(`[backend] allowlist: ${allowlist.length ? allowlist.join(", ") : "(dev: allow all)"}`);
  console.log(`[backend] cookie: name=${env.COOKIE_NAME} sameSite=${cookieSameSite()} secure=${env.COOKIE_SECURE}`);
});
