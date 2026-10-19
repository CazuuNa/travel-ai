import { z } from 'zod';
import { providerJson, ProviderError } from './provider-client';
const geoSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        timezone: z.string().optional(),
      }),
    )
    .optional(),
});
export async function geocode(city: string, signal: AbortSignal) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: city, count: '1', language: 'zh' }).toString();
  const data = geoSchema.parse(await providerJson(url, signal));
  if (!data.results?.[0])
    throw new ProviderError('LOCATION_NOT_FOUND', '未找到城市，请尝试城市英文名');
  return data.results[0];
}
export async function weather(city: string, date: string | undefined, signal: AbortSignal) {
  const location = await geocode(city, signal);
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    timezone: 'auto',
    forecast_days: '16',
  }).toString();
  const data = z
    .object({
      timezone: z.string(),
      daily: z.object({
        time: z.array(z.string()),
        temperature_2m_max: z.array(z.number().nullable()),
        temperature_2m_min: z.array(z.number().nullable()),
        precipitation_probability_max: z.array(z.number().nullable()),
        weather_code: z.array(z.number().nullable()),
      }),
    })
    .parse(await providerJson(url, signal));
  if (date && !data.daily.time.includes(date))
    throw new ProviderError(
      'FORECAST_RANGE',
      `日期不在供应商可用预报范围 ${data.daily.time[0]} 至 ${data.daily.time.at(-1)}`,
    );
  return {
    location,
    timezone: data.timezone,
    units: { temperature: '°C', precipitationProbability: '%' },
    days: data.daily.time.flatMap((d, i) =>
      date && d !== date
        ? []
        : [
            {
              date: d,
              max: data.daily.temperature_2m_max[i],
              min: data.daily.temperature_2m_min[i],
              rainProbability: data.daily.precipitation_probability_max[i],
              weatherCode: data.daily.weather_code[i],
            },
          ],
    ),
  };
}
export async function exchange(from: string, to: string, amount: number, signal: AbortSignal) {
  if (from === to)
    return {
      from,
      to,
      amount,
      rate: 1,
      converted: amount,
      rateDate: new Date().toISOString().slice(0, 10),
      note: '同币种恒等换算',
    };
  const url = new URL('https://api.frankfurter.dev/v1/latest');
  url.search = new URLSearchParams({ base: from, symbols: to }).toString();
  const data = z
    .object({ date: z.string(), rates: z.record(z.number().positive()) })
    .parse(await providerJson(url, signal));
  const rate = data.rates[to];
  if (!rate) throw new ProviderError('CURRENCY_UNSUPPORTED', '不支持此币种');
  return {
    from,
    to,
    amount,
    rate,
    rateDate: data.date,
    converted: Math.round(amount * rate * 100) / 100,
    note: '参考汇率，不包含银行手续费或兑换点价差',
  };
}
export async function attractions(
  destination: string,
  count: number,
  key: string | undefined,
  signal: AbortSignal,
) {
  if (!key)
    throw new ProviderError('PROVIDER_NOT_CONFIGURED', '景点查询需要配置 OPENTRIPMAP_API_KEY');
  const location = await geocode(destination, signal);
  const url = new URL('https://api.opentripmap.com/0.1/en/places/radius');
  url.search = new URLSearchParams({
    radius: '15000',
    lon: String(location.longitude),
    lat: String(location.latitude),
    rate: '2',
    format: 'json',
    limit: String(count * 3),
    apikey: key,
  }).toString();
  const list = z
    .array(
      z.object({
        xid: z.string(),
        name: z.string(),
        kinds: z.string(),
        dist: z.number().optional(),
      }),
    )
    .parse(await providerJson(url, signal));
  return {
    location,
    items: list
      .filter((x) => x.name)
      .slice(0, count)
      .map((x) => ({
        name: x.name,
        categories: x.kinds,
        distanceMeters: x.dist,
        url: `https://opentripmap.com/en/card/${encodeURIComponent(x.xid)}`,
      })),
    note: '候选按供应商返回顺序；营业时间与门票请至官方核验。',
  };
}
