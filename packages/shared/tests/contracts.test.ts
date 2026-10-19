import { describe, it, expect } from 'vitest';
import { toolSchemas, MemorySchema, ChatInputSchema } from '../src';
describe('shared contracts', () => {
  it('rejects passwords beyond bcrypt UTF-8 byte limit', async () => {
    const { AuthSchema } = await import('../src');
    expect(
      AuthSchema.safeParse({ email: 'u@example.com', password: '旅'.repeat(24) }).success,
    ).toBe(true);
    expect(
      AuthSchema.safeParse({ email: 'u@example.com', password: '旅'.repeat(24) + '甲' }).success,
    ).toBe(false);
  });
  it('rejects impossible dates and reversed itineraries', () => {
    expect(
      toolSchemas.itinerary.safeParse({
        destination: '杭州',
        startDate: '2026-02-30',
        endDate: '2026-03-01',
      }).success,
    ).toBe(false);
    expect(
      toolSchemas.itinerary.safeParse({
        destination: '杭州',
        startDate: '2026-04-05',
        endDate: '2026-04-01',
      }).success,
    ).toBe(false);
  });
  it('rejects negative budget and unknown memory fields', () => {
    expect(toolSchemas.budget.safeParse({ days: 3, people: 1, dailyHotel: -1 }).success).toBe(
      false,
    );
    expect(
      MemorySchema.safeParse({ key: 'passport', value: 'secret', confirmed: true }).success,
    ).toBe(false);
    expect(MemorySchema.safeParse({ key: 'pace', value: '慢游', confirmed: false }).success).toBe(
      false,
    );
  });
  it('rejects oversized chat and accepts defaults', () => {
    expect(
      ChatInputSchema.safeParse({ message: 'x'.repeat(8001), requestId: crypto.randomUUID() })
        .success,
    ).toBe(false);
    expect(toolSchemas.budget.parse({ days: 3 }).people).toBe(1);
  });
});
