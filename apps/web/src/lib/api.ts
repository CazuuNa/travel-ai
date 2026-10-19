import type { ChatInput, StreamEvent } from '@travel/shared';
import { consumeStream } from './stream';
let accessToken = '';
export function setToken(token: string) {
  accessToken = token;
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const r = await fetch('/api' + path, {
    method: options.method ?? 'GET',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const result = (await r.json().catch(() => ({}))) as { message?: string };
  if (!r.ok) throw new Error(result.message ?? `请求失败 (${r.status})`);
  return result as T;
}
export async function streamChat(
  input: ChatInput,
  signal: AbortSignal,
  onEvent: (e: StreamEvent) => void,
) {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
  });
  return consumeStream(response, onEvent);
}
