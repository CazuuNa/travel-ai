import { Inject, Injectable } from '@nestjs/common';
import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { toolCatalog, toolSchemas, type AgentEvent, type ToolId } from '@travel/shared';
import { CONFIG, type AppConfig } from '../config';
import { ToolsService } from '../tools/tools.service';
import { createModel } from './model';
import { selectHistory, buildSystemPrompt } from './context';
import { executeGraph } from './graph';
import { setTimeout as delay } from 'node:timers/promises';
export interface AgentInput {
  messages: { role: string; content: string }[];
  memories: { key: string; value: string }[];
  userId: string;
  signal: AbortSignal;
  onEvent: (e: AgentEvent) => void;
}
@Injectable()
export class AgentService {
  constructor(
    @Inject(CONFIG) private config: AppConfig,
    @Inject(ToolsService) private tools: ToolsService,
  ) {}
  async run(input: AgentInput) {
    input.signal.throwIfAborted();
    if (this.config.mode === 'demo') {
      const last = input.messages.at(-1)?.content ?? '';
      const response = `这是**演示模式**，用于验证流式输出与会话保存。\n\n你想了解：${last.slice(0, 300)}\n\n建议先明确目的地、日期、人数和预算，再规划路线。你可以打开右侧的八个旅行工具，体验结构化输入和结果。\n\n${input.memories.length ? `已读取你确认的旅行偏好：${input.memories.map((m) => `${m.key}：${m.value}`).join('；')}。` : '在「旅行记忆」中保存偏好，下次对话会自动参考。'}\n\n接入 DeepSeek 并切换 live 模式后，将启用模型推理与自动工具调用。`;
      for (const text of response.match(/.{1,12}/gs) ?? []) {
        await delay(20, undefined, { signal: input.signal });
        input.onEvent({ type: 'token', text });
      }
      return { content: response };
    }
    const model = createModel(this.config);
    const definitions = toolCatalog.map(
      (t) =>
        new DynamicStructuredTool({
          name: t.id,
          description: t.description + '；工具输入必须完整，不知道时向用户询问。',
          schema: t.id === 'itinerary' ? toolSchemas.itinerary.innerType() : toolSchemas[t.id],
          func: async (args) => JSON.stringify(await this.tools.execute(t.id, args, input)),
        }),
    );
    const planner = model.bindTools(definitions);
    const messages = [
      new SystemMessage(buildSystemPrompt(input.memories, this.config.mode)),
      ...selectHistory(input.messages).map((m) =>
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
      ),
    ];
    return executeGraph({
      messages,
      signal: input.signal,
      decide: (m) => planner.invoke(m, { signal: input.signal }),
      execute: (id, args) => this.tools.execute(id as ToolId, args, input),
      final: async (m, emit) => {
        let content = '';
        for await (const chunk of await model.stream(m, { signal: input.signal })) {
          const text = typeof chunk.content === 'string' ? chunk.content : '';
          if (text) {
            content += text;
            emit(text);
          }
        }
        return content;
      },
      emit: input.onEvent,
    });
  }
}
