import type { Express } from 'express';
/** Hops are fixed by deployment topology; API must not be publicly reachable around its proxy. */
export function configureProxyAndRateLimit(
  app: Express,
  hops: number,
  limits = { auth: 20, api: 120 },
) {
  app.set('trust proxy', hops === 0 ? false : hops);
  const counts = new Map<string, { n: number; until: number }>();
  app.use((req, res, next) => {
    const now = Date.now();
    const group = req.path.includes('/auth/') ? 'auth' : 'api';
    const key = `${req.ip}:${group}`;
    if (counts.size > 10000) for (const [k, v] of counts) if (v.until <= now) counts.delete(k);
    let count = counts.get(key);
    if (!count || count.until <= now) {
      count = { n: 0, until: now + 60000 };
      counts.set(key, count);
    }
    if (++count.n > limits[group]) {
      res.status(429).json({ code: 'RATE_LIMIT', message: '请求过于频繁，请稍后重试' });
      return;
    }
    next();
  });
}
