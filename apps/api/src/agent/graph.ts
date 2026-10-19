import { ToolMessage, type AIMessage, type BaseMessage } from '@langchain/core/messages';
import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { toolCatalog, type AgentEvent, type ToolId, type ToolResult } from '@travel/shared';
export interface GraphOptions {
  messages: BaseMessage[];
  signal: AbortSignal;
  decide: (messages: BaseMessage[]) => Promise<AIMessage>;
  execute: (id: string, args: unknown) => Promise<ToolResult>;
  final: (messages: BaseMessage[], emit: (text: string) => void) => Promise<string>;
  emit: (event: AgentEvent) => void;
}
export async function executeGraph(o: GraphOptions): Promise<{ content: string }> {
  o.signal.throwIfAborted();
  const State = Annotation.Root({
    messages: Annotation<BaseMessage[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
    rounds: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
    answer: Annotation<string>({ reducer: (_a, b) => b, default: () => '' }),
  });
  const graph = new StateGraph(State)
    .addNode('decide', async (s) => {
      o.signal.throwIfAborted();
      const response = await o.decide(s.messages);
      return { messages: [response] };
    })
    .addNode('tools', async (s) => {
      o.signal.throwIfAborted();
      if (s.rounds >= 4) throw new Error('工具调用轮数达到上限');
      const last = s.messages.at(-1) as AIMessage;
      const messages: ToolMessage[] = [];
      if ((last.tool_calls?.length ?? 0) > 8) throw new Error('单轮工具调用达到上限');
      for (const call of last.tool_calls ?? []) {
        o.signal.throwIfAborted();
        if (!toolCatalog.some((t) => t.id === call.name)) throw new Error('未知工具');
        const id = call.name as ToolId;
        o.emit({ type: 'tool_start', toolId: id });
        const started = Date.now();
        const result = await o.execute(id, call.args);
        const durationMs = Date.now() - started;
        o.emit({ type: 'tool_result', toolId: id, result, durationMs });
        messages.push(new ToolMessage({ tool_call_id: call.id!, content: JSON.stringify(result) }));
      }
      return { messages, rounds: s.rounds + 1 };
    })
    .addNode('respond', async (s) => {
      o.signal.throwIfAborted();
      // The last planner reply is discarded: final generation uses no tools and streams only public text.
      const answer = await o.final(s.messages.slice(0, -1), (text) => {
        o.signal.throwIfAborted();
        o.emit({ type: 'token', text });
      });
      return { answer };
    })
    .addEdge(START, 'decide')
    .addConditionalEdges(
      'decide',
      (s) => ((s.messages.at(-1) as AIMessage).tool_calls?.length ? 'tools' : 'respond'),
      ['tools', 'respond'],
    )
    .addEdge('tools', 'decide')
    .addEdge('respond', END)
    .compile();
  const result = await graph.invoke(
    { messages: o.messages },
    { signal: o.signal, recursionLimit: 16 },
  );
  return { content: result.answer };
}
