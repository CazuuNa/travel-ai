import { it, expect } from 'vitest';
import { RequestScope } from '../src/lib/request-scope';
it('discards late responses and callbacks from a closed account session', async () => {
  const a = new RequestScope();
  const b = new RequestScope();
  const seen: string[] = [];
  let release!: (v: string) => void;
  const late = new Promise<string>((r) => {
    release = r;
  });
  const pending = a.run(
    async () => late,
    (v) => seen.push(v),
  );
  a.close();
  await b.run(
    async () => 'B',
    (v) => seen.push(v),
  );
  release('A-private-title');
  await pending;
  await a.run(
    async () => 'old callback',
    (v) => seen.push(v),
  );
  expect(seen).toEqual(['B']);
});
