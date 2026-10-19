import { it, expect } from 'vitest';
import { createSseParser } from '../src';
it('decodes split Chinese bytes, CRLF and multiple frames', () => {
  const events: unknown[] = [];
  const parser = createSseParser((e) => events.push(e));
  const bytes = new TextEncoder().encode(
    'data: {"type":"token","text":"杭州"}\r\n\r\ndata: {"type":"done"}\n\n',
  );
  for (const byte of bytes) parser.push(new Uint8Array([byte]));
  parser.end();
  expect(events).toEqual([{ type: 'token', text: '杭州' }, { type: 'done' }]);
});
it('supports multiline data and rejects incomplete frames', () => {
  const events: unknown[] = [];
  const parser = createSseParser((e) => events.push(e));
  parser.push(new TextEncoder().encode('data: {"type":\ndata: "done"}\n\ndata: {"type":"token"}'));
  expect(events).toEqual([{ type: 'done' }]);
  expect(() => parser.end()).toThrow('不完整');
});
