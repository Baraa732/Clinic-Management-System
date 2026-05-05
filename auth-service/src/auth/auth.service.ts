import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../entities/audit-log.entity';
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
import { AccountStatus, ClientType } from '../common/enums/user.enum';
import { LoginAttempt } from '../entities/login-attempt.entity';

@Injectable()
export class AuthService {
  private readonly bcryptRounds: number;
  private readonly maxLoginAttempts: number;
  private readonly lockoutMinutes: number;
  private readonly maxResendCount: number;
  private readonly resendCooldownMinutes: number;
  private redisAvailable = true;
  private redisCircuitOpenAt: number | null = null;
  private readonly CIRCUIT_OPEN_MS = 30_000; // 30s before retry

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(RefreshToken) private refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(LoginAttempt) private loginAttemptRepo: Repository<LoginAttempt>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {
    this.bcryptRounds = parseInt(this.configService.get('BCRYPT_ROUNDS', '12'));
    this.maxLoginAttempts = parseInt(this.configService.get('MAX_LOGIN_ATTEMPTS', '5'));
    this.lockoutMinutes = parseInt(this.configService.get('LOCKOUT_DURATION_MINUTES', '15'));
    this.maxResendCount = parseInt(this.configService.get('MAX_RESEND_VERIFICATION', '3'));
    this.resendCooldownMinutes = parseInt(this.configService.get('RESEND_COOLDOWN_MINUTES', '5'));

    this.redis.on('error', () => {
      this.redisAvailable = false;
      this.redisCircuitOpenAt = Date.now();
    });
    this.redis.on('ready', () => {
      this.redisAvailable = true;
      this.redisCircuitOpenAt = null;
    });
  }

  // Fail-open: if Redis is down, skip blacklist check (accept risk) rather than block all users
  private async safeRedisGet(key: string): Promise<string | null> {
    if (!this.redisAvailable) {
      if (this.redisCircuitOpenAt && Date.now() - this.redisCircuitOpenAt > this.CIRCUIT_OPEN_MS) {
        // probe
        try {
          const val = await this.redis.get(key);
          this.redisAvailable = true;
          this.redisCircuitOpenAt = null;
          return val;
        } catch {
          this.redisCircuitOpenAt = Date.now();
          return null;
        }
      }
      return null; // fail-open
    }
    try {
      return await this.redis.get(key);
    } catch {
      this.redisAvailable = false;
      this.redisCircuitOpenAt = Date.now();
      return null; // fail-open
    }
  }

  private async safeRedisSetex(key: string, ttl: number, value: string): Promise<void> {
    try {
      await this.redis.setex(key, ttl, value);
    } catch {
      // non-critical: token will expire naturally
    }
  }

  private rpc(exception: any): RpcException {
    const res = exception.getResponse?.() as any;
    return new RpcException({
      statusCode: exception.getStatus?.() ?? 500,
      error: res?.error ?? exception.name,
      message: res?.message ?? exception.message,
    });
  }

  async register(dto: RegisterDto, ipAddress: string) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw this.rpc(new ConflictException('Email already registered'));

    this.validateRoleClientTypeMatch(dto.role, dto.clientType);

    const hashedPassword = await bcrypt.hash(dto.password, this.bcryptRounds);
    const rawToken = uuidv4();
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = this.userRepo.create({
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      role: dto.role,
      clientType: dto.clientType,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      emailVerificationToken: tokenHash,
      emailVerificationExpires: verificationExpires,
      status: AccountStatus.PENDING_VERIFICATION,
    });

    await this.userRepo.save(user);

    await this.auditService.log(AuditAction.REGISTER, {
      userId: user.id,
      email: user.email,
      ipAddress,
      clientType: dto.clientType,
      success: true,
      details: `User registered with role: ${dto.role}`,
    });

    // rawToken is returned here for the email service to send — never stored in plain text
    return {
      message: 'Registration successful. Please verify your email.',
      userId: user.id,
      verificationToken: rawToken, // consumed by email service, not exposed to end-user
    };
  }

  async login(dto: LoginDto, ipAddress: string, userAgent: string) {
    await this.checkIpRateLimit(ipAddress);

    const user = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } });

    if (!user) {
      await this.recordLoginAttempt(null, dto.email, ipAddress, userAgent, false, 'User not found');
      await this.incrementIpAttempts(ipAddress);
      await this.auditService.log(AuditAction.LOGIN_FAILED, {
        email: dto.email.toLowerCase(),
        ipAddress,
        userAgent,
        clientType: dto.clientType,
        success: false,
        details: 'User not found',
      });
      throw this.rpc(new UnauthorizedException('Invalid credentials'));
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      await this.auditService.log(AuditAction.LOGIN_FAILED, {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
        clientType: dto.clientType,
        success: false,
        details: `Account locked for ${minutesLeft} more minutes`,
      });
      throw this.rpc(new ForbiddenException(`Account locked. Try again in ${minutesLeft} minutes`));
    }

    this.validateRoleClientTypeMatch(user.role, dto.clientType);

    if (user.clientType !== dto.clientType) {
      await this.recordLoginAttempt(user.id, dto.email, ipAddress, userAgent, false, 'Wrong client type');
      await this.auditService.log(AuditAction.LOGIN_FAILED, {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
        clientType: dto.clientType,
        success: false,
        details: 'Wrong client type',
      });
      throw this.rpc(new ForbiddenException('Access denied for this application'));
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      await this.handleFailedLogin(user, dto.email, ipAddress, userAgent);
      await this.auditService.log(AuditAction.LOGIN_FAILED, {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
        clientType: dto.clientType,
        success: false,
        details: `Failed attempt ${user.loginAttempts + 1}/${this.maxLoginAttempts}`,
      });
      throw this.rpc(new UnauthorizedException('Invalid credentials'));
    }

    if (user.status === AccountStatus.PENDING_VERIFICATION) {
      throw this.rpc(new ForbiddenException('Please verify your email before logging in'));
    }

    if (user.status === AccountStatus.INACTIVE) {
      throw this.rpc(new ForbiddenException('Account is deactivated. Contact support'));
    }

    // Reset attempts; restore ACTIVE status if it was LOCKED (timer expired)
    const now = new Date();
    await this.userRepo.update(user.id, {
      loginAttempts: 0,
      lockedUntil: null,
      status: AccountStatus.ACTIVE,
      lastLoginAt: now,
      lastLoginIp: ipAddress,
    });

    // Update local object to reflect changes in response
    user.lastLoginAt = now;
    user.status = AccountStatus.ACTIVE;

    await this.recordLoginAttempt(user.id, dto.email, ipAddress, userAgent, true, null);
    await this.resetIpAttempts(ipAddress);

    const tokens = await this.generateTokenPair(user, dto.clientType, dto.deviceInfo, ipAddress);

    await this.auditService.log(AuditAction.LOGIN_SUCCESS, {
      userId: user.id,
      email: user.email,
      ipAddress,
      userAgent,
      clientType: dto.clientType,
      sessionId: tokens.sessionId,
      success: true,
    });

    const { sessionId, ...tokenResponse } = tokens;
    return { message: 'Login successful', ...tokenResponse, user: this.sanitizeUser(user) };
  }

  async refreshTokens(dto: RefreshTokenDto, ipAddress: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw this.rpc(new UnauthorizedException('Invalid or expired refresh token'));
    }

    const isBlacklisted = await this.redis.get(`blacklist:${payload.jti}`);
    if (isBlacklisted) {
      // Token reuse — revoke all sessions for this user
      await this.revokeAllUserTokens(payload.sub);
      await this.auditService.log(AuditAction.TOKEN_REUSE_DETECTED, {
        userId: payload.sub,
        ipAddress,
        sessionId: payload.jti,
        success: false,
        details: 'Blacklisted refresh token reused — all sessions terminated',
      });
      throw this.rpc(new UnauthorizedException('Token reuse detected. All sessions terminated'));
    }

    const tokenRecord = await this.refreshTokenRepo.findOne({
      where: { id: payload.jti, userId: payload.sub, isRevoked: false },
      relations: ['user'],
    });

    if (!tokenRecord) throw this.rpc(new UnauthorizedException('Refresh token not found or revoked'));
    if (tokenRecord.expiresAt < new Date()) throw this.rpc(new UnauthorizedException('Refresh token expired'));

    const tokenValid = await bcrypt.compare(dto.refreshToken, tokenRecord.tokenHash);
    if (!tokenValid) {
      await this.revokeAllUserTokens(payload.sub);
      await this.auditService.log(AuditAction.TOKEN_REUSE_DETECTED, {
        userId: payload.sub,
        ipAddress,
        sessionId: payload.jti,
        success: false,
        details: 'Token hash mismatch — all sessions terminated',
      });
      throw this.rpc(new UnauthorizedException('Token reuse detected. All sessions terminated'));
    }

    // Rotate: revoke old token and blacklist it
    await this.refreshTokenRepo.update(tokenRecord.id, {
      isRevoked: true,
      revokedAt: new Date(),
      replacedByToken: payload.jti, // will be updated after new token is created
    });
    await this.redis.setex(`blacklist:${payload.jti}`, 7 * 24 * 3600, '1');

    const tokens = await this.generateTokenPair(
      tokenRecord.user,
      tokenRecord.clientType,
      tokenRecord.deviceInfo,
      ipAddress,
    );

    await this.auditService.log(AuditAction.TOKEN_REFRESH, {
      userId: payload.sub,
      ipAddress,
      clientType: tokenRecord.clientType,
      sessionId: tokens.sessionId,
      success: true,
      details: `Rotated from session ${payload.jti}`,
    });

    const { sessionId, ...tokenResponse } = tokens;
    return { message: 'Tokens refreshed', ...tokenResponse };
  }

  async logout(userId: string, accessToken: string, refreshToken?: string) {
    const accessPayload = this.jwtService.decode(accessToken) as any;
    if (accessPayload?.jti) {
      const ttl = Math.max(0, accessPayload.exp - Math.floor(Date.now() / 1000));
      await this.redis.setex(`blacklist:${accessPayload.jti}`, ttl + 60, '1');
    }

    let sessionId: string | undefined;
    if (refreshToken) {
      const refreshPayload = this.jwtService.decode(refreshToken) as any;
      if (refreshPayload?.jti) {
        sessionId = refreshPayload.jti;
        await this.refreshTokenRepo.update(
          { id: refreshPayload.jti, userId, isRevoked: false },
          { isRevoked: true, revokedAt: new Date() },
        );
        await this.redis.setex(`blacklist:${refreshPayload.jti}`, 7 * 24 * 3600, '1');
      }
    }

    await this.auditService.log(AuditAction.LOGOUT, {
      userId,
      ipAddress: '0.0.0.0',
      sessionId,
      success: true,
    });

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string, accessToken: string, ipAddress: string) {
    await this.revokeAllUserTokens(userId);
    const payload = this.jwtService.decode(accessToken) as any;
    if (payload?.jti) {
      const ttl = Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
      await this.redis.setex(`blacklist:${payload.jti}`, ttl + 60, '1');
    }

    await this.auditService.log(AuditAction.LOGOUT_ALL, {
      userId,
      ipAddress,
      success: true,
      details: 'All sessions terminated',
    });

    return { message: 'All sessions terminated' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    // Lookup by userId first to avoid full table scan — userId is passed in the email link
    const user = await this.userRepo.findOne({
      where: { id: dto.userId, isEmailVerified: false, status: AccountStatus.PENDING_VERIFICATION },
    });

    const invalid = !user
      || !user.emailVerificationToken
      || !user.emailVerificationExpires
      || user.emailVerificationExpires <= new Date();

    if (invalid) throw this.rpc(new BadRequestException('Invalid or expired verification token'));

    const match = await bcrypt.compare(dto.token, user.emailVerificationToken!);
    if (!match) throw this.rpc(new BadRequestException('Invalid or expired verification token'));

    await this.userRepo.update(user.id, {
      isEmailVerified: true,
      status: AccountStatus.ACTIVE,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

    await this.auditService.log(AuditAction.EMAIL_VERIFIED, {
      userId: user.id,
      email: user.email,
      ipAddress: '0.0.0.0',
      success: true,
    });

    return { message: 'Email verified successfully. You can now login.' };
  }

  async resendVerification(dto: ResendVerificationDto, ipAddress: string) {
    const user = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } });

    // Always return same message to prevent email enumeration
    const genericResponse = { message: 'If your email is pending verification, a new link has been sent.' };

    if (!user || user.isEmailVerified || user.status !== AccountStatus.PENDING_VERIFICATION) {
      return genericResponse;
    }

    if (user.resendVerificationCount >= this.maxResendCount) {
      throw this.rpc(new ForbiddenException('Maximum resend attempts reached. Contact support.'));
    }

    if (user.lastResendAt) {
      const cooldownMs = this.resendCooldownMinutes * 60 * 1000;
      const elapsed = Date.now() - user.lastResendAt.getTime();
      if (elapsed < cooldownMs) {
        const waitSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
        throw this.rpc(new BadRequestException(`Please wait ${waitSeconds} seconds before requesting another email.`));
      }
    }

    const rawToken = uuidv4();
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.userRepo.update(user.id, {
      emailVerificationToken: tokenHash,
      emailVerificationExpires: verificationExpires,
      resendVerificationCount: user.resendVerificationCount + 1,
      lastResendAt: new Date(),
    });

    await this.auditService.log(AuditAction.EMAIL_VERIFY_RESENT, {
      userId: user.id,
      email: user.email,
      ipAddress,
      success: true,
      details: `Resend attempt ${user.resendVerificationCount + 1}/${this.maxResendCount}`,
    });

    // rawToken consumed by email service
    return { ...genericResponse, verificationToken: rawToken };
  }

  async forgotPassword(dto: ForgotPasswordDto, ipAddress: string) {
    const user = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase() } });

    // Always return same message to prevent email enumeration
    const genericResponse = { message: 'If this email exists, a reset link has been sent.' };

    if (!user) return genericResponse;

    const rawToken = uuidv4();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    await this.userRepo.update(user.id, {
      passwordResetToken: await bcrypt.hash(rawToken, 10),
      passwordResetExpires: resetExpires,
    });

    await this.auditService.log(AuditAction.PASSWORD_RESET_REQ, {
      userId: user.id,
      email: user.email,
      ipAddress,
      success: true,
    });

    // rawToken consumed by email service — never returned to HTTP client
    return { ...genericResponse, resetToken: rawToken };
  }

  async resetPassword(dto: ResetPasswordDto, ipAddress: string) {
    // Lookup by userId to avoid full table scan — userId is embedded in the reset link
    const user = await this.userRepo.findOne({
      where: { id: dto.userId, passwordResetExpires: MoreThan(new Date()) },
    });

    if (!user || !user.passwordResetToken) {
      throw this.rpc(new BadRequestException('Invalid or expired reset token'));
    }

    const match = await bcrypt.compare(dto.token, user.passwordResetToken);
    if (!match) throw this.rpc(new BadRequestException('Invalid or expired reset token'));

    const hashedPassword = await bcrypt.hash(dto.newPassword, this.bcryptRounds);
    const newTokenVersion = user.tokenVersion + 1;

    await this.userRepo.update(user.id, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      loginAttempts: 0,
      lockoutCount: 0,
      lockedUntil: null,
      status: AccountStatus.ACTIVE,
      tokenVersion: newTokenVersion,
    });

    await this.revokeAllUserTokens(user.id);

    await this.auditService.log(AuditAction.PASSWORD_RESET_DONE, {
      userId: user.id,
      email: user.email,
      ipAddress,
      success: true,
    });

    return { message: 'Password reset successful. Please login with your new password.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto, ipAddress: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw this.rpc(new NotFoundException('User not found'));

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw this.rpc(new UnauthorizedException('Current password is incorrect'));

    const samePassword = await bcrypt.compare(dto.newPassword, user.password);
    if (samePassword) throw this.rpc(new BadRequestException('New password must be different from current password'));

    const hashedPassword = await bcrypt.hash(dto.newPassword, this.bcryptRounds);
    const newTokenVersion = user.tokenVersion + 1;
    await this.userRepo.update(userId, { password: hashedPassword, tokenVersion: newTokenVersion });
    await this.revokeAllUserTokens(userId);

    await this.auditService.log(AuditAction.PASSWORD_CHANGED, {
      userId,
      email: user.email,
      ipAddress,
      success: true,
    });

    return { message: 'Password changed successfully. Please login again.' };
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
      });

      if (payload.type !== 'access') throw new UnauthorizedException('Invalid token type');

      // Fail-open: if Redis is down, skip blacklist check rather than block all users
      const isBlacklisted = await this.safeRedisGet(`blacklist:${payload.jti}`);
      if (isBlacklisted) throw new UnauthorizedException('Token revoked');

      const user = await this.userRepo.findOne({ where: { id: payload.sub, isActive: true } });
      if (!user) throw new UnauthorizedException('User not found');
      if (user.status !== AccountStatus.ACTIVE) throw new UnauthorizedException('Account not active');

      // tokenVersion check: fast global invalidation without Redis
      if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
        throw new UnauthorizedException('Token invalidated');
      }

      return { valid: true, payload, user: this.sanitizeUser(user) };
    } catch {
      return { valid: false };
    }
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw this.rpc(new NotFoundException('User not found'));
    return this.sanitizeUser(user);
  }

  async getActiveSessions(userId: string) {
    const tokens = await this.refreshTokenRepo.find({
      where: { userId, isRevoked: false },
      order: { createdAt: 'DESC' },
    });
    return tokens.filter((t) => t.expiresAt > new Date()).map((t) => ({
      id: t.id,
      clientType: t.clientType,
      deviceInfo: t.deviceInfo,
      ipAddress: t.ipAddress,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
    }));
  }

  async getLoginHistory(userId: string, limit = 20) {
    return this.loginAttemptRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 100),
      select: ['id', 'ipAddress', 'userAgent', 'success', 'failureReason', 'createdAt'],
    });
  }

  async adminRevokeSessions(targetUserId: string, adminId: string, ipAddress: string) {
    const user = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) throw this.rpc(new NotFoundException('User not found'));

    await this.revokeAllUserTokens(targetUserId);
    const newTokenVersion = user.tokenVersion + 1;
    await this.userRepo.update(targetUserId, { tokenVersion: newTokenVersion });

    await this.auditService.log(AuditAction.ADMIN_REVOKE_SESSIONS, {
      userId: targetUserId,
      ipAddress,
      success: true,
      details: `All sessions force-revoked by admin ${adminId}`,
    });

    return { message: 'All sessions for the target user have been revoked.' };
  }

  async revokeSession(sessionId: string, userId: string, ipAddress: string) {
    const token = await this.refreshTokenRepo.findOne({
      where: { id: sessionId, userId, isRevoked: false },
    });
    if (!token) throw this.rpc(new NotFoundException('Session not found'));

    await this.refreshTokenRepo.update(token.id, { isRevoked: true, revokedAt: new Date() });
    await this.redis.setex(`blacklist:${token.id}`, 7 * 24 * 3600, '1');

    await this.auditService.log(AuditAction.SESSION_REVOKED, {
      userId,
      ipAddress,
      sessionId,
      success: true,
    });

    return { message: 'Session revoked successfully' };
  }

  private async generateTokenPair(
    user: User,
    clientType: ClientType,
    deviceInfo?: string,
    ipAddress?: string,
  ) {
    const jtiAccess = uuidv4();
    const jtiRefresh = uuidv4();

    // tokenVersion embedded so validateToken can detect global invalidation without Redis
    const accessPayload = {
      sub: user.id,
      role: user.role,
      clientType,
      jti: jtiAccess,
      type: 'access',
      tokenVersion: user.tokenVersion,
    };

    const refreshPayload = {
      sub: user.id,
      jti: jtiRefresh,
      type: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES', '15m'),
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES', '7d'),
    });

    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        id: jtiRefresh,
        tokenHash,
        userId: user.id,
        clientType,
        deviceInfo,
        ipAddress,
        expiresAt: refreshExpires,
      }),
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      tokenType: 'Bearer',
      sessionId: jtiRefresh,
    };
  }

  private async handleFailedLogin(user: User, email: string, ip: string, userAgent: string) {
    const attempts = user.loginAttempts + 1;
    const update: Partial<User> = { loginAttempts: attempts } as any;

    if (attempts >= this.maxLoginAttempts) {
      // Progressive backoff: 15m → 1h → 4h → 24h → 72h
      const backoffSteps = [15, 60, 240, 1440, 4320];
      const lockoutIdx = Math.min(user.lockoutCount, backoffSteps.length - 1);
      const lockoutDuration = backoffSteps[lockoutIdx];

      update.lockedUntil = new Date(Date.now() + lockoutDuration * 60 * 1000);
      update.status = AccountStatus.LOCKED;
      update.lockoutCount = user.lockoutCount + 1;
      update.loginAttempts = 0; // reset counter for next lockout cycle

      await this.auditService.log(AuditAction.ACCOUNT_LOCKED, {
        userId: user.id,
        email: user.email,
        ipAddress: ip,
        userAgent,
        success: true,
        details: `Locked for ${lockoutDuration}min (lockout #${user.lockoutCount + 1})`,
      });
    }

    await this.userRepo.update(user.id, update);
    await this.recordLoginAttempt(user.id, email, ip, userAgent, false, 'Invalid password');
    await this.incrementIpAttempts(ip);
  }

  private async revokeAllUserTokens(userId: string) {
    const tokens = await this.refreshTokenRepo.find({ where: { userId, isRevoked: false } });
    if (tokens.length > 0) {
      // Use pipeline to batch all Redis writes in a single round-trip
      const pipeline = this.redis.pipeline();
      for (const token of tokens) {
        pipeline.setex(`blacklist:${token.id}`, 7 * 24 * 3600, '1');
      }
      await pipeline.exec().catch(() => {/* non-critical — DB revocation still happens */});
    }
    await this.refreshTokenRepo.update({ userId, isRevoked: false }, { isRevoked: true, revokedAt: new Date() });
  }

  private async checkIpRateLimit(ip: string) {
    const key = `rate:login:${ip}`;
    const attempts = await this.safeRedisGet(key);
    // If Redis is down, fail-open (skip IP block) — account-level lock still protects
    if (attempts && parseInt(attempts) >= 20) {
      await this.auditService.log(AuditAction.SUSPICIOUS_ACTIVITY, {
        ipAddress: ip,
        success: false,
        details: `IP blocked: ${attempts} login attempts in 1 hour`,
      });
      throw this.rpc(new ForbiddenException('Too many login attempts from this IP. Try again later.'));
    }
  }

  private async incrementIpAttempts(ip: string) {
    try {
      const key = `rate:login:${ip}`;
      await this.redis.incr(key);
      await this.redis.expire(key, 3600);
    } catch { /* non-critical */ }
  }

  private async resetIpAttempts(ip: string) {
    try {
      await this.redis.del(`rate:login:${ip}`);
    } catch { /* non-critical */ }
  }

  private async recordLoginAttempt(
    userId: string | null,
    email: string,
    ip: string,
    userAgent: string,
    success: boolean,
    reason: string | null,
  ) {
    const attempt = new LoginAttempt();
    if (userId) attempt.userId = userId;
    attempt.email = email;
    attempt.ipAddress = ip;
    attempt.userAgent = userAgent;
    attempt.success = success;
    if (reason) attempt.failureReason = reason;
    await this.loginAttemptRepo.save(attempt);
  }

  private validateRoleClientTypeMatch(role: string, clientType: string) {
    const validMap: Record<string, string> = {
      doctor: ClientType.MOBILE_DOCTOR,
      patient: ClientType.MOBILE_PATIENT,
      clinic_admin: ClientType.WEB_ADMIN,
      secretary: ClientType.WEB_SECRETARY,
    };
    if (validMap[role] !== clientType) {
      throw this.rpc(new ForbiddenException(`Role "${role}" is not allowed on client "${clientType}"`));
    }
  }

  private sanitizeUser(user: User) {
    // Minimal user payload — strip all sensitive and internal fields
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      clientType: user.clientType,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
      isEmailVerified: user.isEmailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
