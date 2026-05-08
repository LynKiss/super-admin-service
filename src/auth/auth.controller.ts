import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentSuperAdmin, CurrentUser, Public } from '../decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.login(dto, response, request.ip);
  }

  @Public()
  @Get('refresh')
  refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.super_refresh_token as string | undefined;
    return this.authService.refresh(refreshToken, response);
  }

  @Post('logout')
  logout(
    @CurrentUser() user: CurrentSuperAdmin,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.logout(user._id, response);
  }

  @Get('me')
  me(@CurrentUser() user: CurrentSuperAdmin) {
    return { user };
  }
}
