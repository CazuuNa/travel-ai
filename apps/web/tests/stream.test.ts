import { it, expect } from 'vitest';
import { consumeStream } from '../src/lib/stream';
function response(frames: string) {
  const bytes = new TextEncoder().encode(frames);
  return new Response(
    new ReadableStream({
      start(c) {
        for (const b of bytes) c.enqueue(new Uint8Array([b]));
        c.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}
it('requires a terminal event and preserves Chinese text', async () => {
  const events: unknown[] = [];
  await consumeStream(
    response('data: {"type":"token","text":"旅行"}\n\ndata: {"type":"done"}\n\n'),
    (e) => events.push(e),
  );
  expect(events).toHaveLength(2);
  await expect(
    consumeStream(response('data: {"type":"token","text":"x"}\n\n'), () => {}),
  ).rejects.toThrow('中断');
});
