import { it, expect } from 'vitest';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { executeGraph } from '../src/agent/graph';
it('executes tools and streams final answer', async () => {
  let n = 0;
  const calls: string[] = [];
  const tokens: string[] = [];
  const output = await executeGraph({
    messages: [new HumanMessage('预算')],
    signal: new AbortController().signal,
    decide: async () =>
      ++n === 1
        ? new AIMessage({
            content: '',
            tool_calls: [{ id: '1', name: 'budget', args: { days: 2 } }],
          })
        : new AIMessage('准备好了'),
    execute: async (name) => {
      calls.push(name);
      return { status: 'ok', sources: [], fetchedAt: '', mode: 'estimated', data: { total: 100 } };
    },
    final: async (_m, emit) => {
      emit('预算');
      emit('100');
      return '预算100';
    },
    emit: (e) => {
      if (e.type === 'token') tokens.push(e.text);
    },
  });
  expect(calls).toEqual(['budget']);
  expect(tokens.join('')).toBe('预算100');
  expect(output.content).toBe('预算100');
});
it('bounds endlessly requested tools and propagates abort', async () => {
  let calls = 0;
  await expect(
    executeGraph({
      messages: [],
      signal: new AbortController().signal,
      decide: async () =>
        new AIMessage({
          content: '',
          tool_calls: [{ id: crypto.randomUUID(), name: 'budget', args: {} }],
        }),
      execute: async () => {
        calls++;
        return { status: 'ok', sources: [], fetchedAt: '', mode: 'demo' };
      },
      final: async () => '',
      emit: () => {},
    }),
  ).rejects.toThrow('上限');
  expect(calls).toBe(4);
  const ac = new AbortController();
  ac.abort();
  await expect(
    executeGraph({
      messages: [],
      signal: ac.signal,
      decide: async () => new AIMessage(''),
      execute: async () => {
        throw Error();
      },
      final: async () => '',
      emit: () => {},
    }),
  ).rejects.toThrow();
});
