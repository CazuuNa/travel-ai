import { z } from 'zod';
const text = z.string().trim().min(1).max(200);
const money = z.number().finite().min(0).max(10_000_000);
const days = z.number().int().min(1).max(60);
const people = z.number().int().min(1).max(30).default(1);
const currency = z.string().regex(/^[A-Z]{3}$/, '使用三位大写币种代码');
export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, '日期不存在');
export const toolSchemas = {
  itinerary: z
    .object({
      destination: text,
      startDate: DateSchema,
      endDate: DateSchema,
      people,
      interests: text.default('美食与文化'),
      pace: z.enum(['轻松', '适中', '紧凑']).default('适中'),
      budget: money.default(3000),
    })
    .strict()
    .refine(
      (x) =>
        x.startDate <= x.endDate &&
        (Date.parse(x.endDate) - Date.parse(x.startDate)) / 86400000 < 60,
      '行程日期必须递增且不超过60天',
    ),
  weather: z.object({ city: text, date: DateSchema.optional() }).strict(),
  attractions: z
    .object({
      destination: text,
      interests: text.default('文化与自然'),
      count: z.number().int().min(1).max(10).default(5),
    })
    .strict(),
  budget: z
    .object({
      days,
      people,
      currency: currency.default('CNY'),
      dailyHotel: money.default(300),
      dailyFood: money.default(100),
      dailyTransport: money.default(50),
      tickets: money.default(200),
      reservePercent: z.number().min(0).max(100).default(10),
    })
    .strict(),
  visa: z.object({ nationality: text, destination: text, purpose: text.default('旅游') }).strict(),
  currency: z
    .object({ from: currency.default('CNY'), to: currency.default('USD'), amount: money })
    .strict(),
  packing: z
    .object({
      destination: text,
      days,
      weather: text.default('温和'),
      activities: text.default('城市漫步'),
      withChildren: z.boolean().default(false),
    })
    .strict(),
  translation: z
    .object({
      text: z.string().trim().min(1).max(3000),
      from: text.default('自动检测'),
      to: text,
      scene: text.default('旅游日常'),
    })
    .strict(),
};
export type ToolId = keyof typeof toolSchemas;
export const toolCatalog: { id: ToolId; name: string; description: string; icon: string }[] = [
  { id: 'itinerary', name: '行程规划', description: '把灵感变成每天的路线', icon: '⌘' },
  { id: 'weather', name: '天气查询', description: '出发前，看看目的地的天空', icon: '☀' },
  { id: 'attractions', name: '景点推荐', description: '发现值得绕路的风景', icon: '⌖' },
  { id: 'budget', name: '预算估算', description: '让每一笔花费心中有数', icon: '¥' },
  { id: 'visa', name: '签证查询', description: '整理出发前的入境准备', icon: '▣' },
  { id: 'currency', name: '货币换算', description: '用熟悉的币种理解价格', icon: '⇄' },
  { id: 'packing', name: '打包清单', description: '轻装出发，也不遗漏', icon: '▤' },
  { id: 'translation', name: '旅行翻译', description: '让陌生语言成为对话', icon: '文' },
];
export type DataMode = 'live' | 'demo' | 'estimated';
export interface Source {
  name: string;
  url?: string;
}
export interface ToolResult<T = unknown> {
  status: 'ok' | 'error';
  data?: T;
  sources: Source[];
  fetchedAt: string;
  mode: DataMode;
  warning?: string;
  error?: { code: string; message: string; retryable: boolean };
}
export const toolExamples: Record<ToolId, Record<string, unknown>> = {
  itinerary: {
    destination: '杭州',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    people: 2,
    budget: 3000,
    interests: '美食与文化',
    pace: '轻松',
  },
  weather: { city: '杭州' },
  attractions: { destination: '杭州', interests: '文化与自然', count: 5 },
  budget: {
    days: 3,
    people: 2,
    currency: 'CNY',
    dailyHotel: 300,
    dailyFood: 100,
    dailyTransport: 50,
    tickets: 200,
    reservePercent: 10,
  },
  visa: { nationality: '中国', destination: '日本', purpose: '旅游' },
  currency: { from: 'CNY', to: 'USD', amount: 1000 },
  packing: {
    destination: '杭州',
    days: 3,
    weather: '凉爽有雨',
    activities: '城市漫步',
    withChildren: false,
  },
  translation: { text: '请问去火车站怎么走？', from: '中文', to: '英语', scene: '问路' },
};
