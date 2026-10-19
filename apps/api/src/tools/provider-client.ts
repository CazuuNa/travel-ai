export class ProviderError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}
const hosts = new Set([
  'geocoding-api.open-meteo.com',
  'api.open-meteo.com',
  'api.frankfurter.dev',
  'api.opentripmap.com',
]);
export async function providerJson(url: URL, signal: AbortSignal): Promise<unknown> {
  if (url.protocol !== 'https:' || !hosts.has(url.hostname))
    throw new ProviderError('PROVIDER_DENIED', '供应商地址不受支持');
  const combined = AbortSignal.any([signal, AbortSignal.timeout(12000)]);
  for (let attempt = 0; attempt < 2; attempt++) {
    combined.throwIfAborted();
    try {
      const r = await fetch(url, {
        signal: combined,
        redirect: 'error',
        headers: { Accept: 'application/json' },
      });
      if (!r.ok)
        throw new ProviderError(
          'PROVIDER_HTTP',
          `供应商返回 ${r.status}`,
          r.status === 429 || r.status >= 500,
        );
      const reader = r.body!.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 2_000_000) throw new ProviderError('PROVIDER_SIZE', '供应商响应超过限制');
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (e) {
      if (combined.aborted) throw e;
      if (attempt || (e instanceof ProviderError && !e.retryable)) throw e;
    }
  }
  throw new ProviderError('PROVIDER_UNAVAILABLE', '外部数据暂时不可用', true);
}
