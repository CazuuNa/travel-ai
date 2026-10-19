import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';
import { randomUUID } from 'node:crypto';
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private logger = new Logger('API');
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) {
      res.end();
      return;
    }
    const status = e instanceof ZodError ? 400 : e instanceof HttpException ? e.getStatus() : 500;
    const code = e instanceof ZodError ? 'INVALID_INPUT' : `HTTP_${status}`;
    // Never log raw exception messages: database and upstream errors can contain secrets.
    if (status >= 500) this.logger.error(`Unhandled ${e instanceof Error ? e.name : 'error'}`);
    res.status(status).json({
      code,
      message:
        e instanceof ZodError
          ? e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
          : e instanceof HttpException
            ? e.message
            : '服务器暂时不可用',
      requestId: randomUUID(),
    });
  }
}
