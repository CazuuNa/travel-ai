import { createSseParser, type StreamEvent } from '@travel/shared';
export async function consumeStream(
  response: Response,
  onEvent: (e: StreamEvent) => void,
): Promise<void> {
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(error.message ?? `请求失败 (${response.status})`);
  }
  if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body)
    throw new Error('服务器未返回事件流');
  let terminal = false;
  let failure: string | undefined;
  const parser = createSseParser((raw) => {
    const e = raw as StreamEvent;
    if (e.type === 'done') terminal = true;
    if (e.type === 'error') {
      terminal = true;
      failure = e.message;
    }
    onEvent(e);
  });
  const reader = response.body.getReader();
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      parser.push(r.value);
    }
    parser.end();
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (failure) throw new Error(failure);
  if (!terminal) throw new Error('连接中断，已保存的内容可在会话中查看');
}
