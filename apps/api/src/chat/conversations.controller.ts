import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, type UserRequest } from '../auth/auth.guard';
import { DatabaseService } from '../database/database.service';
@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(@Inject(DatabaseService) private db: DatabaseService) {}
  @Get() list(@Req() r: UserRequest) {
    return this.db.conversation.findMany({
      where: { userId: r.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }
  @Post() create(@Req() r: UserRequest, @Body() body: unknown) {
    const p = z
      .object({ title: z.string().trim().min(1).max(80).optional() })
      .strict()
      .parse(body);
    return this.db.conversation.create({ data: { userId: r.user.id, title: p.title } });
  }
  @Get(':id/messages') async messages(
    @Req() r: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.owned(r.user.id, id);
    const messages = await this.db.message.findMany({
      where: { conversationId: id },
      orderBy: [{ createdAt: 'desc' }, { role: 'asc' }],
      take: 500,
    });
    return messages.reverse();
  }
  @Delete(':id') async remove(@Req() r: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.db.conversation.deleteMany({ where: { id, userId: r.user.id } });
    if (!result.count) throw new NotFoundException('会话不存在');
    return { deleted: true };
  }
  async owned(userId: string, id: string) {
    const c = await this.db.conversation.findFirst({ where: { id, userId } });
    if (!c) throw new NotFoundException('会话不存在');
    return c;
  }
}
