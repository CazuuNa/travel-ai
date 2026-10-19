import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
export type UserRequest = Request & { user: { id: string } };
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private jwt: JwtService,
    @Inject(DatabaseService) private db: DatabaseService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<UserRequest>();
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) throw new UnauthorizedException('请先登录');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      if (
        !payload.sub ||
        !(await this.db.user.findUnique({ where: { id: payload.sub }, select: { id: true } }))
      )
        throw new Error();
      req.user = { id: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
  }
}
