import { afterEach, it, expect, vi } from 'vitest';
import { weather, exchange } from '../src/tools/live-providers';
import { providerJson } from '../src/tools/provider-client';
afterEach(() => vi.unstubAllGlobals());
it('blocks arbitrary hosts before making network requests', async () => {
  await expect(
    providerJson(new URL('https://example.com/secret'), new AbortController().signal),
  ).rejects.toThrow('不受支持');
});
it('validates forecast dates against actual provider coverage', async () => {
  const values = [
    { results: [{ name: '杭州', latitude: 30, longitude: 120 }] },
    {
      timezone: 'Asia/Shanghai',
      daily: {
        time: ['2026-10-18'],
        temperature_2m_max: [20],
        temperature_2m_min: [10],
        precipitation_probability_max: [10],
        weather_code: [1],
      },
    },
  ];
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(values.shift())));
  await expect(weather('杭州', '2026-12-31', new AbortController().signal)).rejects.toThrow(
    '预报范围',
  );
});
it('uses provider rate date and rounds currency amounts', async () => {
  vi.stubGlobal(
    'fetch',
    async () => new Response(JSON.stringify({ date: '2026-10-16', rates: { USD: 0.140123 } })),
  );
  expect(await exchange('CNY', 'USD', 1000, new AbortController().signal)).toMatchObject({
    rateDate: '2026-10-16',
    converted: 140.12,
  });
});
