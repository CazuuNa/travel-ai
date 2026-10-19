/** Incremental UTF-8 SSE parser. Comments are heartbeats; EOF must be frame-aligned. */
export function createSseParser(onEvent: (event: unknown) => void) {
  const decoder = new TextDecoder();
  let buffer = '';
  function drain() {
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(buffer))) {
      const frame = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      const data = frame
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).replace(/^ /, ''))
        .join('\n');
      if (data) onEvent(JSON.parse(data));
    }
    if (buffer.length > 1_000_000) throw new Error('SSE 帧超过大小限制');
  }
  return {
    push(chunk: Uint8Array) {
      buffer += decoder.decode(chunk, { stream: true });
      drain();
    },
    end() {
      buffer += decoder.decode();
      drain();
      if (buffer.trim()) throw new Error('SSE 不完整，连接提前结束');
    },
  };
}
