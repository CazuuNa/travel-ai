import { it, expect } from 'vitest';
import { selectHistory, buildSystemPrompt } from '../src/agent/context';
it('bounds history and excludes unapproved memory keys', () => {
  const history = selectHistory(
    Array.from({ length: 100 }, () => ({ role: 'user', content: 'a'.repeat(1000) })),
    4000,
  );
  expect(history.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(4000);
  const p = buildSystemPrompt(
    [
      { key: 'passport', value: 'DO_NOT_INCLUDE' },
      { key: 'pace', value: '慢游' },
    ],
    'live',
  );
  expect(p).not.toContain('DO_NOT_INCLUDE');
  expect(p).toContain('慢游');
});
