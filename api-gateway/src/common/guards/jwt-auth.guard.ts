import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import Redis from 'ioredis';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private redisAvailable = true;
  private redisCircuitOpenAt: number | null = null;
  private readonly CIRCUIT_OPEN_MS = 30_000;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private reflector: Reflector,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {
    this.redis.on('error', () => {
      this.redisAvailable = false;
      this.redisCircuitOpenAt = Date.now();
    });
    this.redis.on('ready', () => {
      this.redisAvailable = true;
      this.redisCircuitOpenAt = null;
    });
  }

  private async safeBlacklistCheck(jti: string): Promise<boolean> {
    if (!this.redisAvailable) {
      if (this.redisCircuitOpenAt && Date.now() - this.redisCircuitOpenAt > this.CIRCUIT_OPEN_MS) {
        try {
          const val = await this.redis.get(`blacklist:${jti}`);
          this.redisAvailable = true;
          this.redisCircuitOpenAt = null;
          return !!val;
        } catch {
          this.redisCircuitOpenAt = Date.now();
          return false; // fail-open
        }
      }
      return false; // fail-open: Redis down, allow request through
    }
    try {
      const val = await this.redis.get(`blacklist:${jti}`);
      return !!val;
    } catch {
      this.redisAvailable = false;
      this.redisCircuitOpenAt = Date.now();
      return false; // fail-open
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException('Access token required');

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
      });

      if (payload.type !== 'access') throw new UnauthorizedException('Invalid token type');

      const isBlacklisted = await this.safeBlacklistCheck(payload.jti);
      if (isBlacklisted) throw new UnauthorizedException('Token has been revoked');

      request['user'] = payload;
      request['accessToken'] = token;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    return null;
  }
}
