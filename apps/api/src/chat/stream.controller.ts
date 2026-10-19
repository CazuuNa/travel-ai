import {
  Body,
  ConflictException,
  Controller,
  Inject,
  NotFoundException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatInputSchema, type StreamPayload, type StreamEvent } from '@travel/shared';
import { DatabaseService } from '../database/database.service';
import { AuthGuard, type UserRequest } from '../auth/auth.guard';
import { AgentService } from '../agent/agent.service';
import { CONFIG, type AppConfig } from '../config';
import { randomUUID } from 'node:crypto';
@Controller('chat')
@UseGuards(AuthGuard)
export class StreamController {
  private active = new Set<string>();
  constructor(
    @Inject(DatabaseService) private db: DatabaseService,
    @Inject(AgentService) private agent: AgentService,
    @Inject(CONFIG) private config: AppConfig,
  ) {}
  @Post('stream') async stream(
    @Req() req: UserRequest,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const p = ChatInputSchema.parse(body);
    const userId = req.user.id;
    if (this.active.has(userId)) throw new ConflictException('已有回答正在生成，请等待或停止');
    // Reserve before the first await so different request IDs cannot race.
    this.active.add(userId);
    try {
      if (
        p.conversationId &&
        !(await this.db.conversation.findFirst({ where: { id: p.conversationId, userId } }))
      )
        throw new NotFoundException('会话不存在');
      if (await this.db.chatRequest.findUnique({ where: { id: p.requestId } }))
        throw new ConflictException('请求已存在，请读取会话消息');
    } catch (e) {
      this.active.delete(userId);
      throw e;
    }
    const ac = new AbortController();
    const abort = () => {
      if (!res.writableEnded) ac.abort(new Error('客户端断开'));
    };
    res.on('close', abort);
    const timeout = setTimeout(() => ac.abort(new Error('生成超时')), 180000);
    let conversationId = p.conversationId ?? randomUUID();
    const assistantId = randomUUID();
    let partial = '';
    let seq = 0;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const executions: {
      toolId: string;
      status: string;
      summary: { mode: string; code?: string };
      durationMs: number;
    }[] = [];
    let created = false;
    let finalStatus = 'failed';
    const emit = (payload: StreamPayload) => {
      if (ac.signal.aborted || res.destroyed || res.writableEnded) return;
      const event: StreamEvent = { ...payload, requestId: p.requestId, seq: ++seq };
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    try {
      await this.db.$transaction(async (tx) => {
        if (!p.conversationId)
          await tx.conversation.create({
            data: { id: conversationId, userId, title: p.message.slice(0, 40) },
          });
        await tx.chatRequest.create({ data: { id: p.requestId, userId, conversationId } });
        await tx.message.create({
          data: { conversationId, role: 'user', content: p.message, requestId: p.requestId },
        });
        await tx.message.create({
          data: {
            id: assistantId,
            conversationId,
            role: 'assistant',
            content: '',
            status: 'running',
            requestId: p.requestId,
          },
        });
      });
      created = true;
      ac.signal.throwIfAborted();
      res.status(200).set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();
      heartbeat = setInterval(() => {
        if (!res.destroyed && !res.writableEnded) res.write(': heartbeat\n\n');
      }, 15000);
      emit({ type: 'meta', conversationId, mode: this.config.mode });
      const [history, memories] = await Promise.all([
        this.db.message.findMany({
          where: { conversationId, id: { not: assistantId }, status: 'complete' },
          orderBy: [{ createdAt: 'desc' }, { role: 'asc' }],
          take: 40,
        }),
        this.db.userMemory.findMany({ where: { userId } }),
      ]);
      await this.agent.run({
        messages: history.reverse(),
        memories,
        userId,
        signal: ac.signal,
        onEvent: (e) => {
          if (e.type === 'token') partial += e.text;
          if (e.type === 'tool_result')
            executions.push({
              toolId: e.toolId,
              status: e.result.status,
              summary: {
                mode: e.result.mode,
                ...(e.result.error ? { code: e.result.error.code } : {}),
              },
              durationMs: e.durationMs,
            });
          emit(e);
        },
      });
      ac.signal.throwIfAborted();
      finalStatus = 'complete';
      await this.persist(
        p.requestId,
        assistantId,
        conversationId,
        partial,
        finalStatus,
        executions,
      );
      created = false;
      emit({ type: 'done', status: 'complete' });
    } catch (e) {
      finalStatus = ac.signal.aborted ? 'interrupted' : 'failed';
      if (!res.headersSent) {
        if ((e as { code?: string }).code === 'P2002') throw new ConflictException('请求已存在');
        throw e;
      }
      emit({
        type: 'error',
        code: finalStatus === 'interrupted' ? 'INTERRUPTED' : 'GENERATION_FAILED',
        message:
          finalStatus === 'interrupted'
            ? '生成已停止或超时，部分内容已保存'
            : '生成失败，请稍后重试',
      });
    } finally {
      clearTimeout(timeout);
      if (heartbeat) clearInterval(heartbeat);
      res.off('close', abort);
      try {
        if (created)
          await this.persist(
            p.requestId,
            assistantId,
            conversationId,
            partial,
            finalStatus,
            executions,
          );
      } finally {
        this.active.delete(userId);
        if (res.headersSent && !res.writableEnded) res.end();
      }
    }
  }
  private async persist(
    requestId: string,
    id: string,
    conversationId: string,
    content: string,
    status: string,
    executions: {
      toolId: string;
      status: string;
      summary: { mode: string; code?: string };
      durationMs: number;
    }[],
  ) {
    await this.db.$transaction(async (tx) => {
      await tx.message.update({ where: { id }, data: { content, status } });
      await tx.chatRequest.update({ where: { id: requestId }, data: { status } });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      if (executions.length)
        await tx.toolExecution.createMany({ data: executions.map((e) => ({ ...e, requestId })) });
    });
  }
}
