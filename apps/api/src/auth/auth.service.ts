import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcryptjs';
import { AuthSchema } from '@travel/shared';
import { DatabaseService } from '../database/database.service';
@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private db: DatabaseService,
    @Inject(JwtService) private jwt: JwtService,
  ) {}
  async register(input: unknown) {
    const p = AuthSchema.parse(input);
    const passwordHash = await hash(p.password, 12);
    try {
      const user = await this.db.user.create({ data: { email: p.email, passwordHash } });
      return this.session(user);
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException('邮箱已注册');
      throw e;
    }
  }
  async login(input: unknown) {
    const p = AuthSchema.parse(input);
    const user = await this.db.user.findUnique({ where: { email: p.email } });
    if (!user || !(await compare(p.password, user.passwordHash)))
      throw new UnauthorizedException('邮箱或密码错误');
    return this.session(user);
  }
  private async session(user: { id: string; email: string }) {
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id }),
      user: { id: user.id, email: user.email },
    };
  }
}
