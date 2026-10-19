import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    // A single API instance owns local runs. Recover requests left by a previous crash.
    await this.$transaction(async (tx) => {
      const stale = await tx.chatRequest.findMany({
        where: { status: 'running' },
        select: { id: true },
      });
      if (stale.length) {
        const ids = stale.map((r) => r.id);
        await tx.message.updateMany({
          where: { requestId: { in: ids }, role: 'assistant', status: 'running' },
          data: { status: 'interrupted' },
        });
        await tx.chatRequest.updateMany({
          where: { id: { in: ids } },
          data: { status: 'interrupted' },
        });
      }
    });
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
