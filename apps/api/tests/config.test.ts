import { it, expect } from 'vitest';
import { loadConfig } from '../src/config';
const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/travel', JWT_SECRET: 'a'.repeat(48) };
it('rejects live mode without a DeepSeek key', () => {
  expect(() => loadConfig({ ...base, AI_MODE: 'live' })).toThrow('DEEPSEEK');
  expect(loadConfig({ ...base, AI_MODE: 'demo' }).mode).toBe('demo');
});
it('rejects weak secrets', () =>
  expect(() => loadConfig({ ...base, JWT_SECRET: 'weak' })).toThrow());
