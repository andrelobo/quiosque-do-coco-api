import { Controller, Post, Body, Get, Req, Res, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserRole } from '../users/user.schema';
import { Roles } from './roles.decorator';

// Em produção o web (Vercel) e a API (VPS) ficam em sites diferentes.
// Cookies cross-site exigem SameSite=None + Secure.
const authCookieOptions = (): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };
};

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login' })
  async login(
    @Body() body: { username: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.authService.login(body.username, body.password);
    
    res.cookie('auth_token', token, {
      ...authCookieOptions(),
      maxAge: 12 * 60 * 60 * 1000, // 12h
    });

    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('auth_token', authCookieOptions());
    return { message: 'Desconectado' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuário logado' })
  me(@Req() req: any) {
    return req.user;
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar usuário (apenas admin)' })
  register(@Body() body: { name: string; username: string; password: string; role?: UserRole }) {
    return this.authService.register(body);
  }
}