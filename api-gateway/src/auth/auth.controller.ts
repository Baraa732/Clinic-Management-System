import {
  Controller, Post, Get, Body, Req, UseGuards,
  HttpCode, HttpStatus, Inject, Delete, Patch, Param,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
  constructor(@Inject('AUTH_SERVICE') private authClient: ClientProxy) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 3600000, limit: 5 } })
  async register(@Body() dto: any, @Req() req: Request) {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_register' }, { dto, ipAddress: this.getIp(req) })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 900000, limit: 5 } }) // 5 attempts per 15 minutes per IP
  async login(@Body() dto: any, @Req() req: Request) {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_login' }, {
          dto,
          ipAddress: this.getIp(req),
          userAgent: req.headers['user-agent'] || '',
        })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async refresh(@Body() dto: any, @Req() req: Request) {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_refresh' }, { dto, ipAddress: this.getIp(req) })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: any, @Req() req: Request, @Body() body: any) {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_logout' }, {
          userId: user.sub,
          accessToken: req['accessToken'],
          refreshToken: body.refreshToken,
        })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Delete('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser() user: any, @Req() req: Request) {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_logout_all' }, {
          userId: user.sub,
          accessToken: req['accessToken'],
          ipAddress: this.getIp(req),
        })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 3600000, limit: 10 } })
  async verifyEmail(@Body() dto: any) {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_verify_email' }, dto)
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 3600000, limit: 3 } }) // 3 resends per hour per IP
  async resendVerification(@Body() dto: any, @Req() req: Request) {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_resend_verification' }, { dto, ipAddress: this.getIp(req) })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  async forgotPassword(@Body() dto: any, @Req() req: Request) {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_forgot_password' }, { dto, ipAddress: this.getIp(req) })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 3600000, limit: 5 } })
  async resetPassword(@Body() dto: any, @Req() req: Request) {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_reset_password' }, { dto, ipAddress: this.getIp(req) })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@CurrentUser() user: any, @Body() dto: any, @Req() req: Request) {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_change_password' }, { userId: user.sub, dto, ipAddress: this.getIp(req) })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_get_profile' }, { userId: user.sub })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Get('sessions')
  async getSessions(@CurrentUser() user: any) {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_get_sessions' }, { userId: user.sub })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Get('login-history')
  async getLoginHistory(@CurrentUser() user: any, @Req() req: Request) {
    const limit = parseInt((req.query['limit'] as string) || '20', 10);
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_get_login_history' }, { userId: user.sub, limit })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_revoke_session' }, {
          sessionId,
          userId: user.sub,
          ipAddress: this.getIp(req),
        })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Get('admin/users')
  @Roles(UserRole.CLINIC_ADMIN)
  async getAllUsers() {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'auth_get_profile' }, {})
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Delete('admin/users/:targetUserId/sessions')
  @Roles(UserRole.CLINIC_ADMIN)
  @HttpCode(HttpStatus.OK)
  async adminRevokeSessions(
    @Param('targetUserId') targetUserId: string,
    @CurrentUser() admin: any,
    @Req() req: Request,
  ) {
    return firstValueFrom(
      this.authClient
        .send({ cmd: 'admin_revoke_sessions' }, {
          targetUserId,
          adminId: admin.sub,
          ipAddress: this.getIp(req),
        })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
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
    // Only trust x-forwarded-for if behind a known proxy — take the last trusted hop
    const forwarded = req.headers['x-forwarded-for'] as string;
    if (forwarded) {
      const ips = forwarded.split(',').map((s) => s.trim());
      // In production behind a single load balancer, the second-to-last IP is the real client
      // For simplicity here we take the first non-private IP
      const publicIp = ips.find((ip) => !this.isPrivateIp(ip));
      if (publicIp) return publicIp;
    }
    return req.socket?.remoteAddress || '0.0.0.0';
  }

  private isPrivateIp(ip: string): boolean {
    return (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    );
  }
}
