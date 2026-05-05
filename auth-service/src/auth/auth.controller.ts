import { Controller, Post, Get, Delete, Patch, Body, Param, Query } from '@nestjs/common';
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
  register(@Body() body: { dto: RegisterDto; ipAddress: string }) {
    return this.authService.register(body.dto, body.ipAddress);
  }

  @Post('login')
  login(@Body() body: { dto: LoginDto; ipAddress: string; userAgent: string }) {
    return this.authService.login(body.dto, body.ipAddress, body.userAgent);
  }

  @Post('refresh')
  refresh(@Body() body: { dto: RefreshTokenDto; ipAddress: string }) {
    return this.authService.refreshTokens(body.dto, body.ipAddress);
  }

  @Post('logout')
  logout(@Body() body: { userId: string; accessToken: string; refreshToken?: string }) {
    return this.authService.logout(body.userId, body.accessToken, body.refreshToken);
  }

  @Post('logout-all')
  logoutAll(@Body() body: { userId: string; accessToken: string; ipAddress: string }) {
    return this.authService.logoutAll(body.userId, body.accessToken, body.ipAddress);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  resendVerification(@Body() body: { dto: ResendVerificationDto; ipAddress: string }) {
    return this.authService.resendVerification(body.dto, body.ipAddress);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: { dto: ForgotPasswordDto; ipAddress: string }) {
    return this.authService.forgotPassword(body.dto, body.ipAddress);
  }

  @Post('reset-password')
  resetPassword(@Body() body: { dto: ResetPasswordDto; ipAddress: string }) {
    return this.authService.resetPassword(body.dto, body.ipAddress);
  }

  @Post('change-password')
  changePassword(@Body() body: { userId: string; dto: ChangePasswordDto; ipAddress: string }) {
    return this.authService.changePassword(body.userId, body.dto, body.ipAddress);
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
  revokeSession(@Body() body: { sessionId: string; userId: string; ipAddress: string }) {
    return this.authService.revokeSession(body.sessionId, body.userId, body.ipAddress);
  }

  @Post('admin/revoke-sessions')
  adminRevokeSessions(@Body() body: { targetUserId: string; adminId: string; ipAddress: string }) {
    return this.authService.adminRevokeSessions(body.targetUserId, body.adminId, body.ipAddress);
  }
}
