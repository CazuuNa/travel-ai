import { z } from 'zod';
import type { ToolId, ToolResult } from './tools';
export const ChatInputSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    requestId: z.string().uuid(),
    message: z.string().trim().min(1).max(8000),
  })
  .strict();
export type ChatInput = z.infer<typeof ChatInputSchema>;
export const memoryKeys = [
  'interests',
  'pace',
  'budgetLevel',
  'diet',
  'homeCity',
  'language',
] as const;
export const memoryLabels: Record<(typeof memoryKeys)[number], string> = {
  interests: '旅行兴趣',
  pace: '旅行节奏',
  budgetLevel: '预算偏好',
  diet: '饮食偏好',
  homeCity: '出发城市',
  language: '偏好语言',
};
export const MemorySchema = z
  .object({
    key: z.enum(memoryKeys),
    value: z.string().trim().min(1).max(300),
    confirmed: z.literal(true),
  })
  .strict();
export const AuthSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z
      .string()
      .min(12)
      .max(72)
      .refine(
        (s) => new TextEncoder().encode(s).length <= 72,
        '密码的 UTF-8 编码不能超过 72 字节（中文等多字节字符会占更多字节）',
      ),
  })
  .strict();
export type AgentEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_start'; toolId: ToolId }
  | { type: 'tool_result'; toolId: ToolId; result: ToolResult; durationMs: number };
export type StreamPayload =
  | AgentEvent
  | { type: 'meta'; conversationId: string; mode: 'demo' | 'live' }
  | { type: 'done'; status: 'complete' }
  | { type: 'error'; code: string; message: string };
export type StreamEvent = StreamPayload & { requestId: string; seq: number };
export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  status: string;
  createdAt: string;
}
export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}
export interface Memory {
  id: string;
  key: (typeof memoryKeys)[number];
  value: string;
}
