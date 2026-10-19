import { it, expect } from 'vitest';
import { ToolsService } from '../src/tools/tools.service';
const demo = new ToolsService({ mode: 'demo' } as never);
const context = { userId: 'test', signal: new AbortController().signal };
it('calculates exact per-person budget with shared hotel rooms', async () => {
  const r = await demo.execute(
    'budget',
    {
      days: 3,
      people: 2,
      dailyHotel: 300,
      dailyFood: 100,
      dailyTransport: 50,
      tickets: 200,
      reservePercent: 10,
    },
    context,
  );
  expect(r.status).toBe('ok');
  expect(r.data).toMatchObject({ subtotal: 1900, reserve: 190, total: 2090 });
});
it('unknown visa combinations never invent a policy', async () => {
  const r = await new ToolsService({ mode: 'live' } as never).execute(
    'visa',
    { nationality: 'XX', destination: 'YY', purpose: '旅游' },
    context,
  );
  expect(r.mode).toBe('estimated');
  expect(JSON.stringify(r.data)).toContain('未覆盖');
});
it('validates input before providers and labels demonstration results', async () => {
  const bad = await demo.execute('currency', { amount: -1 }, context);
  expect(bad.status).toBe('error');
  const r = await demo.execute('weather', { city: '杭州' }, context);
  expect(r.mode).toBe('demo');
  expect(r.warning).toContain('演示');
});
it('honours an already aborted signal', async () => {
  const ac = new AbortController();
  ac.abort();
  await expect(
    demo.execute('weather', { city: '杭州' }, { ...context, signal: ac.signal }),
  ).rejects.toThrow();
});
it('rejects prototype names as unknown tools', async () => {
  const result = await demo.execute('toString' as never, {}, context);
  expect(result.status).toBe('error');
  expect(result.error?.code).toBe('UNKNOWN_TOOL');
});
