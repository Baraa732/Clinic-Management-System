import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
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
  AdminRevokeSessionsDto,
} from './dto/auth.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern({ cmd: 'auth_register' })
  register(@Payload() data: { dto: RegisterDto; ipAddress: string }) {
    return this.authService.register(data.dto, data.ipAddress);
  }

  @MessagePattern({ cmd: 'auth_login' })
  login(@Payload() data: { dto: LoginDto; ipAddress: string; userAgent: string }) {
    return this.authService.login(data.dto, data.ipAddress, data.userAgent);
  }

  @MessagePattern({ cmd: 'auth_refresh' })
  refresh(@Payload() data: { dto: RefreshTokenDto; ipAddress: string }) {
    return this.authService.refreshTokens(data.dto, data.ipAddress);
  }

  @MessagePattern({ cmd: 'auth_logout' })
  logout(@Payload() data: { userId: string; accessToken: string; refreshToken?: string }) {
    return this.authService.logout(data.userId, data.accessToken, data.refreshToken);
  }

  @MessagePattern({ cmd: 'auth_logout_all' })
  logoutAll(@Payload() data: { userId: string; accessToken: string; ipAddress: string }) {
    return this.authService.logoutAll(data.userId, data.accessToken, data.ipAddress);
  }

  @MessagePattern({ cmd: 'auth_verify_email' })
  verifyEmail(@Payload() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @MessagePattern({ cmd: 'auth_resend_verification' })
  resendVerification(@Payload() data: { dto: ResendVerificationDto; ipAddress: string }) {
    return this.authService.resendVerification(data.dto, data.ipAddress);
  }

  @MessagePattern({ cmd: 'auth_forgot_password' })
  forgotPassword(@Payload() data: { dto: ForgotPasswordDto; ipAddress: string }) {
    return this.authService.forgotPassword(data.dto, data.ipAddress);
  }

  @MessagePattern({ cmd: 'auth_reset_password' })
  resetPassword(@Payload() data: { dto: ResetPasswordDto; ipAddress: string }) {
    return this.authService.resetPassword(data.dto, data.ipAddress);
  }

  @MessagePattern({ cmd: 'auth_change_password' })
  changePassword(@Payload() data: { userId: string; dto: ChangePasswordDto; ipAddress: string }) {
    return this.authService.changePassword(data.userId, data.dto, data.ipAddress);
  }

  @MessagePattern({ cmd: 'auth_validate_token' })
  validateToken(@Payload() data: { token: string }) {
    return this.authService.validateToken(data.token);
  }

  @MessagePattern({ cmd: 'auth_get_profile' })
  getProfile(@Payload() data: { userId: string }) {
    return this.authService.getProfile(data.userId);
  }

  @MessagePattern({ cmd: 'auth_get_sessions' })
  getSessions(@Payload() data: { userId: string }) {
    return this.authService.getActiveSessions(data.userId);
  }

  @MessagePattern({ cmd: 'auth_revoke_session' })
  revokeSession(@Payload() data: { sessionId: string; userId: string; ipAddress: string }) {
    return this.authService.revokeSession(data.sessionId, data.userId, data.ipAddress);
  }

  @MessagePattern({ cmd: 'auth_get_login_history' })
  getLoginHistory(@Payload() data: { userId: string; limit?: number }) {
    return this.authService.getLoginHistory(data.userId, data.limit);
  }

  @MessagePattern({ cmd: 'admin_revoke_sessions' })
  adminRevokeSessions(@Payload() data: { targetUserId: string; adminId: string; ipAddress: string }) {
    return this.authService.adminRevokeSessions(data.targetUserId, data.adminId, data.ipAddress);
  }
}
