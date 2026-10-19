import assert from 'node:assert/strict';
const base = process.env.TEST_API_URL ?? 'http://localhost:8080/api';
let token = '';
async function request(path, method = 'GET', body) {
  const r = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.ok(r.ok, `${path}: HTTP ${r.status}`);
  return r;
}
try {
  const health = await (await request('/health/live')).json();
  assert.equal(health.name, 'travel-ai');
  assert.equal(health.mode, 'demo', 'Smoke script requires AI_MODE=demo to avoid model costs');
  const auth = await (
    await request('/auth/register', 'POST', {
      email: `smoke-${crypto.randomUUID()}@example.com`,
      password: crypto.randomUUID(),
    })
  ).json();
  token = auth.accessToken;
  const catalog = await (await request('/tools')).json();
  assert.equal(catalog.length, 8);
  const { toolExamples } = await import('../packages/shared/dist/index.js');
  for (const t of catalog) {
    const r = await (await request(`/tools/${t.id}`, 'POST', toolExamples[t.id])).json();
    assert.equal(r.status, 'ok', t.id);
    assert.equal(r.mode, 'demo');
    console.log(`PASS tool ${t.id}`);
  }
  await request('/memories', 'POST', { key: 'pace', value: '慢游', confirmed: true });
  const stream = await request('/chat/stream', 'POST', {
    requestId: crypto.randomUUID(),
    message: '计划杭州三日游',
  });
  const text = await stream.text();
  assert.ok(text.includes('"type":"done"'));
  assert.ok(text.includes('慢游') || text.includes('慢'));
  console.log('PASS auth, 8 tools, memory, SSE');
} finally {
  if (token) await request('/auth/account', 'DELETE');
}
