import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from './app.module';
import { ApiErrorFilter } from './common/errors';
import { configureProxyAndRateLimit } from './common/rate-limit';
import { loadConfig } from './config';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(helmet());
  app.use(express.json({ limit: '32kb' }));
  app.setGlobalPrefix('api');
  configureProxyAndRateLimit(app.getHttpAdapter().getInstance(), loadConfig().proxyHops);
  app.useGlobalFilters(new ApiErrorFilter());
  app.enableShutdownHooks();
  const server = await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
  server.requestTimeout = 240000;
}
bootstrap().catch(() => {
  console.error('API 启动失败，请核对环境变量、数据库连接和迁移状态');
  process.exitCode = 1;
});
