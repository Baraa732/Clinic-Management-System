import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { LoginAttempt } from '../entities/login-attempt.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../audit/session.service';
import Redis from 'ioredis';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, LoginAttempt, AuditLog]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get('JWT_ACCESS_EXPIRES', '15m') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuditService,
    SessionService,
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          return new Redis(redisUrl, { tls: redisUrl.startsWith('rediss://') ? {} : undefined, lazyConnect: true });
        }
        return new Redis({
          host: config.get('REDIS_HOST', 'localhost'),
          port: parseInt(config.get('REDIS_PORT', '6379')),
          password: config.get('REDIS_PASSWORD'),
          retryStrategy: (times) => Math.min(times * 50, 2000),
        });
      },
    },
  ],
})
export class AuthModule {}
