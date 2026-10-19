import { Controller, Get, Inject, Module, ServiceUnavailableException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { loadConfig, CONFIG } from './config';
import { DatabaseService } from './database/database.service';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './auth/auth.guard';
import { AuthController } from './auth/auth.controller';
import { ConversationsController } from './chat/conversations.controller';
import { StreamController } from './chat/stream.controller';
import { MemoryController } from './memory/memory.controller';
import { ToolsController } from './tools/tools.controller';
import { ToolsService } from './tools/tools.service';
import { AgentService } from './agent/agent.service';
const config = loadConfig();
@Controller('health')
class HealthController {
  constructor(@Inject(DatabaseService) private db: DatabaseService) {}
  @Get('live') live() {
    return { status: 'ok', mode: config.mode, name: 'travel-ai' };
  }
  @Get('ready') async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException('数据库未就绪');
    }
  }
}
@Module({
  imports: [
    JwtModule.register({
      secret: config.jwtSecret,
      signOptions: { expiresIn: '2h', issuer: 'travel-ai', audience: 'travel-web' },
      verifyOptions: { issuer: 'travel-ai', audience: 'travel-web' },
    }),
  ],
  controllers: [
    HealthController,
    AuthController,
    ConversationsController,
    MemoryController,
    ToolsController,
    StreamController,
  ],
  providers: [
    { provide: CONFIG, useValue: config },
    DatabaseService,
    AuthService,
    AuthGuard,
    ToolsService,
    AgentService,
  ],
})
export class AppModule {}
