import {
  Controller, Post, Get, Body, Req, UseGuards,
  HttpCode, HttpStatus, Delete, Patch, Param, Inject,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../common/enums/user.enum';
import {
  BadRequestException, ConflictException, ForbiddenException,
  NotFoundException, UnauthorizedException, InternalServerErrorException,
} from '@nestjs/common';

@Controller('auth')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuthController {
  private authUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    const host = this.config.get('AUTH_SERVICE_HOST', 'localhost');
    const port = this.config.get('AUTH_SERVICE_PORT', '4001');
    this.authUrl = `http://${host}:${port}/internal/auth`;
  }

  private async call(method: 'post' | 'get', path: string, data?: any) {
    try {
      const res = method === 'get'
        ? await firstValueFrom(this.http.get(`${this.authUrl}${path}`))
        : await firstValueFrom(this.http.post(`${this.authUrl}${path}`, data));
      return res.data;
    } catch (err) {
      throw this.mapError(err?.response?.data || err);
    }
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 3600000, limit: 5 } })
  register(@Body() dto: any, @Req() req: Request) {
    return this.call('post', '/register', { dto, ipAddress: this.getIp(req) });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  login(@Body() dto: any, @Req() req: Request) {
    return this.call('post', '/login', { dto, ipAddress: this.getIp(req), userAgent: req.headers['user-agent'] || '' });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  refresh(@Body() dto: any, @Req() req: Request) {
    return this.call('post', '/refresh', { dto, ipAddress: this.getIp(req) });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser() user: any, @Req() req: Request, @Body() body: any) {
    return this.call('post', '/logout', { userId: user.sub, accessToken: req['accessToken'], refreshToken: body.refreshToken });
  }

  @Delete('logout-all')
  @HttpCode(HttpStatus.OK)
  logoutAll(@CurrentUser() user: any, @Req() req: Request) {
    return this.call('post', '/logout-all', { userId: user.sub, accessToken: req['accessToken'], ipAddress: this.getIp(req) });
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 3600000, limit: 10 } })
  verifyEmail(@Body() dto: any) {
    return this.call('post', '/verify-email', dto);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  resendVerification(@Body() dto: any, @Req() req: Request) {
    return this.call('post', '/resend-verification', { dto, ipAddress: this.getIp(req) });
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  forgotPassword(@Body() dto: any, @Req() req: Request) {
    return this.call('post', '/forgot-password', { dto, ipAddress: this.getIp(req) });
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 3600000, limit: 5 } })
  resetPassword(@Body() dto: any, @Req() req: Request) {
    return this.call('post', '/reset-password', { dto, ipAddress: this.getIp(req) });
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(@CurrentUser() user: any, @Body() dto: any, @Req() req: Request) {
    return this.call('post', '/change-password', { userId: user.sub, dto, ipAddress: this.getIp(req) });
  }

  @Get('me')
  getProfile(@CurrentUser() user: any) {
    return this.call('get', `/profile/${user.sub}`);
  }

  @Get('sessions')
  getSessions(@CurrentUser() user: any) {
    return this.call('get', `/sessions/${user.sub}`);
  }

  @Get('login-history')
  getLoginHistory(@CurrentUser() user: any, @Req() req: Request) {
    const limit = req.query['limit'] || '20';
    return this.call('get', `/login-history/${user.sub}?limit=${limit}`);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  revokeSession(@Param('sessionId') sessionId: string, @CurrentUser() user: any, @Req() req: Request) {
    return this.call('post', '/revoke-session', { sessionId, userId: user.sub, ipAddress: this.getIp(req) });
  }

  @Delete('admin/users/:targetUserId/sessions')
  @Roles(UserRole.CLINIC_ADMIN)
  @HttpCode(HttpStatus.OK)
  adminRevokeSessions(@Param('targetUserId') targetUserId: string, @CurrentUser() admin: any, @Req() req: Request) {
    return this.call('post', '/admin/revoke-sessions', { targetUserId, adminId: admin.sub, ipAddress: this.getIp(req) });
  }

  private mapError(err: any) {
    const message = err?.message || 'An error occurred';
    const status = err?.statusCode || err?.status;
    if (status === 400 || err?.error === 'Bad Request') return new BadRequestException(message);
    if (status === 401 || err?.error === 'Unauthorized') return new UnauthorizedException(message);
    if (status === 403 || err?.error === 'Forbidden') return new ForbiddenException(message);
    if (status === 404 || err?.error === 'Not Found') return new NotFoundException(message);
    if (status === 409 || err?.error === 'Conflict') return new ConflictException(message);
    return new InternalServerErrorException(message);
  }

  private getIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    if (forwarded) {
      const ips = forwarded.split(',').map((s) => s.trim());
      const publicIp = ips.find((ip) => !this.isPrivateIp(ip));
      if (publicIp) return publicIp;
    }
    return req.socket?.remoteAddress || '0.0.0.0';
  }

  private isPrivateIp(ip: string): boolean {
    return (
      ip === '127.0.0.1' || ip === '::1' ||
      ip.startsWith('10.') || ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    );
  }
}
