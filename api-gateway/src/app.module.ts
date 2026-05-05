import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth/auth.controller';
import { UsersController } from './users/users.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ClientTypeGuard } from './common/guards/client-type.guard';
import Redis from 'ioredis';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{
          ttl: parseInt(config.get('THROTTLE_TTL', '60')) * 1000,
          limit: parseInt(config.get('THROTTLE_LIMIT', '30')),
        }],
        // Redis-backed storage: rate limit state is shared across all gateway instances
        storage: new ThrottlerStorageRedisService(
          new Redis({
            host: config.get('REDIS_HOST', 'localhost'),
            port: parseInt(config.get('REDIS_PORT', '6379')),
            password: config.get('REDIS_PASSWORD'),
          }),
        ),
      }),
    }),
    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get('AUTH_SERVICE_HOST', 'localhost'),
            port: parseInt(config.get('AUTH_SERVICE_PORT', '4001')),
          },
        }),
      },
      {
        name: 'USERS_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get('USERS_SERVICE_HOST', 'localhost'),
            port: parseInt(config.get('USERS_SERVICE_PORT', '4002')),
          },
        }),
      },
    ]),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    ClientTypeGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
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
export class AppModule {}
