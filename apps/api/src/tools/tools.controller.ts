import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { toolCatalog, type ToolId } from '@travel/shared';
import { ToolsService } from './tools.service';
import { AuthGuard, type UserRequest } from '../auth/auth.guard';
@Controller('tools')
@UseGuards(AuthGuard)
export class ToolsController {
  constructor(@Inject(ToolsService) private tools: ToolsService) {}
  @Get() list() {
    return toolCatalog;
  }
  @Post(':id') async execute(
    @Param('id') id: ToolId,
    @Body() input: unknown,
    @Req() req: UserRequest,
  ) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 60000);
    try {
      return await this.tools.execute(id, input, { userId: req.user.id, signal: ac.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
