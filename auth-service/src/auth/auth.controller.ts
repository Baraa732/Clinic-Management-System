import { Controller, Post, Get, Delete, Patch, Body, Param, Query, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  RefreshTokenDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req as any).ip || '0.0.0.0';
    return this.authService.register(dto, ip);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req as any).ip || '0.0.0.0';
    const userAgent = req.headers['user-agent'] || '';
    return this.authService.login(dto, ip, userAgent);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req as any).ip || '0.0.0.0';
    return this.authService.refreshTokens(dto, ip);
  }

  @Post('logout')
  logout(@Body() body: { userId: string; accessToken: string; refreshToken?: string }) {
    return this.authService.logout(body.userId, body.accessToken, body.refreshToken);
  }

  @Post('logout-all')
  logoutAll(@Body() body: { userId: string; accessToken: string }, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req as any).ip || '0.0.0.0';
    return this.authService.logoutAll(body.userId, body.accessToken, ip);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req as any).ip || '0.0.0.0';
    return this.authService.resendVerification(dto, ip);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req as any).ip || '0.0.0.0';
    return this.authService.forgotPassword(dto, ip);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req as any).ip || '0.0.0.0';
    return this.authService.resetPassword(dto, ip);
  }

  @Post('change-password')
  changePassword(@Body() body: { userId: string; dto: ChangePasswordDto }, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req as any).ip || '0.0.0.0';
    return this.authService.changePassword(body.userId, body.dto, ip);
  }

  @Post('validate-token')
  validateToken(@Body() body: { token: string }) {
    return this.authService.validateToken(body.token);
  }

  @Get('profile/:userId')
  getProfile(@Param('userId') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Get('sessions/:userId')
  getSessions(@Param('userId') userId: string) {
    return this.authService.getActiveSessions(userId);
  }

  @Get('login-history/:userId')
  getLoginHistory(@Param('userId') userId: string, @Query('limit') limit?: number) {
    return this.authService.getLoginHistory(userId, limit);
  }

  @Post('revoke-session')
  revokeSession(@Body() body: { sessionId: string; userId: string }, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req as any).ip || '0.0.0.0';
    return this.authService.revokeSession(body.sessionId, body.userId, ip);
  }

  @Post('admin/revoke-sessions')
  adminRevokeSessions(@Body() body: { targetUserId: string; adminId: string }, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req as any).ip || '0.0.0.0';
    return this.authService.adminRevokeSessions(body.targetUserId, body.adminId, ip);
  }
}
