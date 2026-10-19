import { it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { configureProxyAndRateLimit } from '../src/common/rate-limit';
it('isolates clients behind trusted proxies and ignores spoofed prefixes', async () => {
  for (const hops of [1, 2] as const) {
    const app = express();
    configureProxyAndRateLimit(app, hops, { auth: 1, api: 1 });
    app.get('/test', (_req, res) => res.json({ ok: true }));
    const suffix = hops === 2 ? ', 172.30.0.10' : '';
    expect(
      (await request(app).get('/test').set('X-Forwarded-For', `198.51.100.1${suffix}`)).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get('/test')
          .set('X-Forwarded-For', `203.0.113.99, 198.51.100.1${suffix}`)
      ).status,
    ).toBe(429);
    expect(
      (await request(app).get('/test').set('X-Forwarded-For', `198.51.100.2${suffix}`)).status,
    ).toBe(200);
  }
});
