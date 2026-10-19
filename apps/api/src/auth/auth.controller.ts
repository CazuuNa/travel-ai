import { Body, Controller, Delete, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard, type UserRequest } from './auth.guard';
import { DatabaseService } from '../database/database.service';
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private auth: AuthService,
    @Inject(DatabaseService) private db: DatabaseService,
  ) {}
  @Post('register') register(@Body() input: unknown) {
    return this.auth.register(input);
  }
  @Post('login') login(@Body() input: unknown) {
    return this.auth.login(input);
  }
  @Delete('account') @UseGuards(AuthGuard) async remove(@Req() req: UserRequest) {
    await this.db.user.delete({ where: { id: req.user.id } });
    return { deleted: true };
  }
}
