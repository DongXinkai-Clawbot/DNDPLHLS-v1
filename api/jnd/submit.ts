
const json = (res: any, status: number, body: any) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const sendStatus = (res: any, status: number) => {
  res.statusCode = status;
  res.end();
};

const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;
const ERR_TOO_LARGE = 'Payload too large';
const ERR_BAD_JSON = 'Invalid JSON';

const rateLimits = new Map<string, { count: number; resetAt: number }>();

const readBody = async (req: any) => {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error(ERR_TOO_LARGE);
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(ERR_BAD_JSON);
  }
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const isPlainObject = (value: any) =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const getClientId = (req: any) => {
  const header = req.headers?.['x-forwarded-for'] || req.headers?.['X-Forwarded-For'];
  if (typeof header === 'string' && header.trim()) {
    return header.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
};

const isRateLimited = (key: string, max = RATE_LIMIT_MAX) => {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  if (entry.count > max) return true;
  return false;
};

const parseAllowedOrigins = () => {
  const raw = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

const applyCors = (res: any, origin: string, allowed: string[]) => {
  if (origin && allowed.length > 0 && !allowed.includes(origin)) {
    return false;
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', allowed.length > 0 ? origin : '*');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  return true;
};

export default async function handler(req: any, res: any) {
  const allowedOrigins = parseAllowedOrigins();
  const origin = typeof req.headers?.origin === 'string' ? req.headers.origin : '';
  if (!applyCors(res, origin, allowedOrigins)) {
    return json(res, 403, { error: 'Forbidden origin' });
  }

  if (req.method === 'OPTIONS') {
    return sendStatus(res, 204);
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 500, { error: 'Server not configured (missing Supabase env vars)' });
  }

  try {
    const clientId = getClientId(req);
    if (isRateLimited(`ip:${clientId}`)) {
      return json(res, 429, { error: 'Too many requests' });
    }

    const body = await readBody(req);
    const anonUserId = typeof body.anonUserId === 'string' ? body.anonUserId : '';
    const conditions = isPlainObject(body.conditions) ? body.conditions : null;
    const computed = isPlainObject(body.computed) ? body.computed : null;
    const metrics = isPlainObject(body.metrics) ? body.metrics : null;

    if (!anonUserId || anonUserId.length < 8 || anonUserId.length > 128) {
      return json(res, 400, { error: 'Invalid anonUserId' });
    }
    if (isRateLimited(`anon:${anonUserId}`)) {
      return json(res, 429, { error: 'Too many requests' });
    }
    if (!conditions || !computed || !metrics) return json(res, 400, { error: 'Missing fields' });
    if (Object.keys(conditions).length > 32 || Object.keys(computed).length > 32 || Object.keys(metrics).length > 32) {
      return json(res, 400, { error: 'Payload too large' });
    }

    const estimateCents = Number(computed.estimateCents);
    const trials = Math.floor(Number(computed.trials));
    const avgAnswerMs = Number(metrics.avgAnswerMs);
    const maxAnswerMs = Number(metrics.maxAnswerMs);

    if (!Number.isFinite(estimateCents)) return json(res, 400, { error: 'Invalid estimateCents' });
    if (!Number.isFinite(trials) || trials < 5) return json(res, 400, { error: 'Not enough trials' });
    if (!Number.isFinite(avgAnswerMs) || avgAnswerMs > 6000) return json(res, 400, { error: 'Avg answer time too slow' });
    if (!Number.isFinite(maxAnswerMs) || maxAnswerMs > 8000) return json(res, 400, { error: 'Max answer time too large' });

    const est = clamp(estimateCents, 0, 1200);
    if (est <= 0.05 || est > 80) return json(res, 400, { error: 'Unreasonable JND estimate' });

    const insert = {
      created_at: new Date().toISOString(),
      anon_user_id: anonUserId,
      estimate_cents: est,
      trials_counted: trials,
      method: String(computed.method || ''),
      conditions,
      metrics: {
        avgAnswerMs,
        maxAnswerMs
      }
    };

    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/jnd_sessions`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(insert)
    });

    if (!r.ok) {
      const text = await r.text();
      console.error('[jnd] Supabase insert failed', text);
      return json(res, 500, { error: 'Supabase insert failed' });
    }
    const data = await r.json().catch(() => []);
    const sessionId = Array.isArray(data) && data[0]?.id ? data[0].id : null;
    return json(res, 200, { ok: true, sessionId });
  } catch (e: any) {
    if (e?.message === ERR_TOO_LARGE) {
      return json(res, 413, { error: 'Payload too large' });
    }
    if (e?.message === ERR_BAD_JSON) {
      return json(res, 400, { error: 'Invalid JSON' });
    }
    console.error('[jnd] Handler error', e);
    return json(res, 500, { error: 'Server error' });
  }
}
