import { beforeAll, afterAll, it, expect } from 'vitest';
const url = process.env.TEST_API_URL ?? 'http://localhost:3000/api';
const email = `test-${crypto.randomUUID()}@example.com`;
let token = '';
let otherToken = '';
let conversationId = '';
async function call(path: string, method = 'GET', body?: unknown, auth = token) {
  return fetch(url + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
beforeAll(async () => {
  for (const e of [email, 'other-' + email]) {
    const r = await call('/auth/register', 'POST', { email: e, password: 'TestPass123!safe' }, '');
    expect(r.status).toBe(201);
    const a = (await r.json()) as { accessToken: string };
    if (e === email) token = a.accessToken;
    else otherToken = a.accessToken;
  }
});
afterAll(async () => {
  for (const auth of [token, otherToken])
    if (auth) await call('/auth/account', 'DELETE', undefined, auth);
});
it('rejects anonymous access and duplicate email', async () => {
  expect((await call('/conversations', 'GET', undefined, '')).status).toBe(401);
  expect(
    (await call('/auth/register', 'POST', { email, password: 'TestPass123!safe' }, '')).status,
  ).toBe(409);
  expect(
    (await call('/auth/login', 'POST', { email, password: 'IncorrectPass123!' }, '')).status,
  ).toBe(401);
});
it('isolates ownership and explicit memory fields', async () => {
  const c = (await (await call('/conversations', 'POST', {})).json()) as { id: string };
  conversationId = c.id;
  expect((await call(`/conversations/${c.id}/messages`, 'GET', undefined, otherToken)).status).toBe(
    404,
  );
  expect(
    (await call('/memories', 'POST', { key: 'passport', value: 'secret', confirmed: true })).status,
  ).toBe(400);
  const m = (await (
    await call('/memories', 'POST', { key: 'pace', value: '慢游', confirmed: true })
  ).json()) as { id: string };
  expect((await call(`/memories/${m.id}`, 'DELETE', undefined, otherToken)).status).toBe(404);
  expect((await call(`/memories/${m.id}`, 'DELETE')).status).toBe(200);
});
it('streams demo events once and rejects a duplicate request id', async () => {
  const input = { conversationId, requestId: crypto.randomUUID(), message: '帮我规划杭州旅行' };
  const r = await call('/chat/stream', 'POST', input);
  expect(r.headers.get('content-type')).toContain('text/event-stream');
  const text = await r.text();
  expect(text).toContain('"type":"meta"');
  expect(text).toContain('"type":"token"');
  expect(text.match(/"type":"done"/g)?.length).toBe(1);
  expect((await call('/chat/stream', 'POST', input)).status).toBe(409);
  const messages = (await (
    await call(`/conversations/${conversationId}/messages`)
  ).json()) as unknown[];
  expect(messages.length).toBe(2);
});
it('reserves concurrent request ids once and persists cancellation', async () => {
  const c = (await (await call('/conversations', 'POST', {})).json()) as { id: string };
  const input = { conversationId: c.id, requestId: crypto.randomUUID(), message: '写一段旅行计划' };
  const responses = await Promise.all([
    call('/chat/stream', 'POST', input),
    call('/chat/stream', 'POST', input),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  await responses.find((r) => r.status === 200)!.text();
  const ac = new AbortController();
  const cancelId = crypto.randomUUID();
  const r = await fetch(url + '/chat/stream', {
    method: 'POST',
    signal: ac.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ conversationId: c.id, requestId: cancelId, message: '测试取消' }),
  });
  const reader = r.body!.getReader();
  await reader.read();
  ac.abort();
  await reader.cancel().catch(() => {});
  let messages: { role: string; requestId: string; status: string }[] = [];
  for (let i = 0; i < 30; i++) {
    messages = (await (await call(`/conversations/${c.id}/messages`)).json()) as typeof messages;
    if (
      messages.some(
        (m) => m.requestId === cancelId && m.role === 'assistant' && m.status === 'interrupted',
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  expect(messages.find((m) => m.requestId === cancelId && m.role === 'assistant')?.status).toBe(
    'interrupted',
  );
});
it('limits a user to one generation even with different request ids', async () => {
  const c = (await (await call('/conversations', 'POST', {})).json()) as { id: string };
  const responses = await Promise.all(
    [1, 2].map(() =>
      call('/chat/stream', 'POST', {
        conversationId: c.id,
        requestId: crypto.randomUUID(),
        message: '生成我的旅行方案',
      }),
    ),
  );
  await Promise.all(responses.filter((r) => r.ok).map((r) => r.text()));
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
});
