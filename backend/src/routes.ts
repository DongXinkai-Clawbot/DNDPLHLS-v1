import { Router } from "express";
import { z } from "zod";
import { env } from "./env.js";
import { createMagicToken, loginWithMagic, rotateSession, revokeSession } from "./auth.js";
import { signAccessToken } from "./jwt.js";
import { sendMagicLinkEmail, hasSmtp } from "./mailer.js";

export const router = Router();

router.post("/auth/start", async (req, res) => {
  const body = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ ok: false, error: "Invalid email" });

  const email = body.data.email.toLowerCase();
  const mt = createMagicToken(email);
  const magicLink = `${env.APP_PUBLIC_URL}/?magic_token=${encodeURIComponent(mt.token)}&email=${encodeURIComponent(email)}`;

  // If SMTP configured, email it. Otherwise return link (dev-friendly).
  if (hasSmtp()) {
    try {
      await sendMagicLinkEmail({ to: email, magicLink });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: "Failed to send email", detail: String(e?.message ?? e) });
    }
    return res.json({ ok: true });
  }

  console.log(`[DEV] Magic Link for ${email}: ${magicLink}`);
  return res.json({ ok: true, note: "SMTP not configured; check server console for magic link." });
});

router.post("/auth/verify", (req, res) => {
  const body = z.object({ email: z.string().email(), magic_token: z.string().min(10) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ ok: false, error: "Invalid payload" });

  const email = body.data.email.toLowerCase();
  const magicToken = body.data.magic_token;

  try {
    const { user, accessToken, refreshToken } = loginWithMagic(email, magicToken);
    // cookie is set in index.ts helper (to centralize options)
    res.locals.refreshToken = refreshToken;
    return res.json({ ok: true, access_token: accessToken, user: { id: user.id, email: user.email } });
  } catch (e: any) {
    return res.status(401).json({ ok: false, error: e?.message ?? "Login failed" });
  }
});

router.post("/auth/refresh", (req, res) => {
  const rt = req.cookies?.[env.COOKIE_NAME];
  if (!rt) return res.status(401).json({ ok: false, error: "Missing refresh token" });

  try {
    const rotated = rotateSession(rt);
    res.locals.refreshToken = rotated.newRefreshToken;
    return res.json({ ok: true, access_token: signAccessToken({ id: rotated.user.id, email: rotated.user.email }) });
  } catch (e: any) {
    return res.status(401).json({ ok: false, error: e?.message ?? "Refresh failed" });
  }
});

router.post("/auth/logout", (req, res) => {
  const rt = req.cookies?.[env.COOKIE_NAME];
  if (rt) {
    try { revokeSession(rt); } catch { }
  }
  res.locals.clearRefresh = true;
  return res.json({ ok: true });
});
