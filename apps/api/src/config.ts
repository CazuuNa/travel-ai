import { z } from 'zod';
export function loadConfig(env: Record<string, string | undefined> = process.env) {
  const e = z
    .object({
      DATABASE_URL: z.string().url().startsWith('postgresql://'),
      JWT_SECRET: z.string().min(32),
      AI_MODE: z.enum(['demo', 'live']).default('demo'),
      PORT: z.coerce.number().int().min(1).max(65535).default(3000),
      TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
      DEEPSEEK_API_KEY: z.string().optional(),
      DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
      OPENTRIPMAP_API_KEY: z.string().optional(),
    })
    .parse(env);
  if (e.AI_MODE === 'live' && !e.DEEPSEEK_API_KEY)
    throw new Error('live 模式必须设置 DEEPSEEK_API_KEY');
  return {
    mode: e.AI_MODE,
    databaseUrl: e.DATABASE_URL,
    jwtSecret: e.JWT_SECRET,
    port: e.PORT,
    proxyHops: e.TRUST_PROXY_HOPS,
    deepseekKey: e.DEEPSEEK_API_KEY,
    model: e.DEEPSEEK_MODEL,
    attractionsKey: e.OPENTRIPMAP_API_KEY,
  };
}
export type AppConfig = ReturnType<typeof loadConfig>;
export const CONFIG = Symbol('CONFIG');
