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
import { MemorySchema } from '@travel/shared';
import { DatabaseService } from '../database/database.service';
import { AuthGuard, type UserRequest } from '../auth/auth.guard';
@Controller('memories')
@UseGuards(AuthGuard)
export class MemoryController {
  constructor(@Inject(DatabaseService) private db: DatabaseService) {}
  @Get() list(@Req() r: UserRequest) {
    return this.db.userMemory.findMany({
      where: { userId: r.user.id },
      orderBy: { updatedAt: 'desc' },
    });
  }
  @Post() save(@Req() r: UserRequest, @Body() body: unknown) {
    const p = MemorySchema.parse(body);
    return this.db.userMemory.upsert({
      where: { userId_key: { userId: r.user.id, key: p.key } },
      create: { userId: r.user.id, key: p.key, value: p.value },
      update: { value: p.value },
    });
  }
  @Delete(':id') async remove(@Req() r: UserRequest, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.db.userMemory.deleteMany({ where: { id, userId: r.user.id } });
    if (!result.count) throw new NotFoundException('记忆不存在');
    return { deleted: true };
  }
}
